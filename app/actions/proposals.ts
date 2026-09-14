"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { FIELDS, coerce } from "@/lib/fields";
import { isCodir } from "@/lib/rights";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Proposer une modification d'une fiche verrouillée : qui, quoi, pourquoi. Le pilote, le garant et la direction sont prévenus.
export async function proposeChange(editionId: string, field: string, proposed: string, reason: string): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: true, team: true } });
  if (!e) return { ok: false, error: "Édition introuvable." };
  const def = FIELDS.edition[field];
  if (!def || !def.layer || def.layer === "validation") return { ok: false, error: "Cette rubrique ne se propose pas." };
  if (!reason.trim()) return { ok: false, error: "Dites pourquoi : c'est ce qui manque aujourd'hui aux corrections silencieuses." };
  const allowed = isCodir(me.role) || e.project.pilotId === me.id || e.team.some((t) => t.personId === me.id);
  if (!allowed) return { ok: false, error: "Seuls le pilote, l'équipe et le CODIR proposent une modification." };
  const p = await prisma.changeProposal.create({ data: { editionId, field, proposed: proposed.trim(), reason: reason.trim(), authorId: me.id } });
  const label = def.label ?? field;
  const recipients = new Set<string>([e.project.pilotId, ...(e.project.guarantorId ? [e.project.guarantorId] : [])]);
  const director = await prisma.person.findFirst({ where: { role: "director", active: true } });
  if (director) recipients.add(director.id);
  recipients.delete(me.id);
  await prisma.notification.createMany({ data: [...recipients].map((personId) => ({ personId, senderId: me.id, kind: "info", title: `Modification proposée sur ${e.project.name} · ${e.year}`, body: `${label} — ${reason.trim().slice(0, 120)}`, link: `/edition/${editionId}?onglet=fiche` })) });
  await prisma.changeLog.create({ data: { editionId, field, before: null, after: `Proposition de modification (${me.name}) : ${reason.trim()}`.slice(0, 500), authorId: me.id } });
  revalidatePath(`/edition/${editionId}`);
  return { ok: true, data: { id: p.id } };
}

// Accepter (la valeur s'applique, l'historique le garde) ou refuser (avec un mot). Le pilote de l'édition ou la direction décident ; jamais l'auteur seul.
export async function decideChange(id: string, decision: "accepted" | "refused", comment: string): Promise<Result> {
  const me = await getCurrentPerson();
  const p = await prisma.changeProposal.findUnique({ where: { id }, include: { edition: { include: { project: true } } } });
  if (!p) return { ok: false, error: "Proposition introuvable." };
  if (p.status !== "pending") return { ok: false, error: "Cette proposition est déjà décidée." };
  const canDecide = me.role === "director" || p.edition.project.pilotId === me.id;
  if (!canDecide) return { ok: false, error: "Le pilote de l'édition ou la direction décide d'une proposition." };
  if (p.authorId === me.id && me.role !== "director") return { ok: false, error: "On n'accepte pas sa propre proposition : le pilote ou la direction tranche." };
  const def = FIELDS.edition[p.field];
  await prisma.$transaction(async (tx) => {
    if (decision === "accepted") {
      const before = await tx.edition.findUnique({ where: { id: p.editionId } });
      const prev = before ? (before as Record<string, unknown>)[p.field] : null;
      const value = coerce(def.type, p.proposed);
      await tx.edition.update({ where: { id: p.editionId }, data: { [p.field]: value } });
      await tx.changeLog.create({ data: { editionId: p.editionId, field: p.field, before: prev == null ? null : String(prev instanceof Date ? prev.toISOString() : prev).slice(0, 500), after: `${value == null ? "" : String(value instanceof Date ? value.toISOString() : value)}`.slice(0, 500), authorId: me.id } });
    }
    await tx.changeProposal.update({ where: { id }, data: { status: decision, decidedById: me.id, decidedAt: new Date(), comment: comment.trim() || null } });
  });
  if (p.authorId !== me.id) {
    await prisma.notification.create({ data: { personId: p.authorId, senderId: me.id, kind: "info", title: `Proposition ${decision === "accepted" ? "acceptée" : "refusée"} · ${p.edition.project.name} · ${p.edition.year}`, body: `${def?.label ?? p.field}${comment.trim() ? ` — ${comment.trim().slice(0, 120)}` : ""}`, link: `/edition/${p.editionId}?onglet=fiche` } });
  }
  revalidatePath(`/edition/${p.editionId}`);
  return { ok: true };
}

// Réalisations au fil de l'année : inscrits, publics, livrable produit… Le pilote, l'équipe, le responsable de pôle, la direction.
export async function addAchievement(editionId: string, input: { kind: string; label: string; value?: number | null; unit?: string | null; date?: string | null; actionId?: string | null }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: true } });
  if (!e) return { ok: false, error: "Édition introuvable." };
  const poles = [e.project.poleId, ...e.project.secondaryPoles.map((x) => x.poleId)];
  const allowed = me.role === "director" || me.role === "raf" || e.project.pilotId === me.id || e.team.some((t) => t.personId === me.id) || (me.role === "pole_lead" && me.poleId !== null && poles.includes(me.poleId));
  if (!allowed) return { ok: false, error: "Le pilote, l'équipe ou le CODIR consignent une réalisation." };
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Dites ce qui a été réalisé." };
  if (input.actionId) { const a = await prisma.action.findUnique({ where: { id: input.actionId } }); if (!a || a.editionId !== editionId) return { ok: false, error: "Action introuvable sur cette édition." }; }
  const date = input.date ? new Date(input.date) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Date invalide." };
  const a = await prisma.achievement.create({ data: { editionId, kind: input.kind || "other", label, value: input.value ?? null, unit: input.unit?.trim() || null, date, actionId: input.actionId || null, authorId: me.id } });
  revalidatePath(`/edition/${editionId}`);
  return { ok: true, data: { id: a.id } };
}

export async function deleteAchievement(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const a = await prisma.achievement.findUnique({ where: { id }, include: { edition: { include: { project: true } } } });
  if (!a) return { ok: false, error: "Réalisation introuvable." };
  if (a.authorId !== me.id && me.role !== "director" && a.edition.project.pilotId !== me.id) return { ok: false, error: "Seuls l'auteur, le pilote ou la direction retirent une réalisation." };
  await prisma.achievement.delete({ where: { id } });
  revalidatePath(`/edition/${a.editionId}`);
  return { ok: true };
}
