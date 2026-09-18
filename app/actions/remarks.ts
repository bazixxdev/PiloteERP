"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { FIELDS } from "@/lib/fields";
import { canActAsPilot, isCodir, type Actor } from "@/lib/rights";
import { V, cap, le, du, de } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Poser une remarque sur une fiche est un droit du CODIR (direction, RAF, responsables de pôle) : la relecture des fiches s'y fait.
export async function canRemark(me: Actor, _e?: unknown): Promise<boolean> {
  void _e;
  return isCodir(me);
}

const REASONS = ["funder", "strategy", "feasibility", "form", "other"];

export async function addRemark(editionId: string, field: string, body: string, reason = "other"): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true, pilot: true } } } });
  if (!e) return { ok: false, error: `${cap(V.edition)} introuvable.` };
  if (!FIELDS.edition[field]) return { ok: false, error: "Rubrique inconnue." };
  if (!(await canRemark(me))) return { ok: false, error: `Les remarques sur la fiche sont un droit ${du(V.codir)} : ${V.direction.one}, ${V.raf.one}, responsables ${de(V.pole)}.` };
  const text = body.trim();
  if (!text) return { ok: false, error: "Écrivez la remarque." };
  if (!REASONS.includes(reason)) return { ok: false, error: "Motif inconnu." };
  const r = await prisma.fieldRemark.create({ data: { editionId, field, body: text, reason, authorId: me.id } });
  await prisma.changeLog.create({ data: { editionId, field, before: null, after: `Remarque : ${text}`.slice(0, 500), authorId: me.id } });
  // Le pilote est prévenu dans l'outil (cloche + Ma semaine), sauf s'il est lui-même l'auteur.
  if (e.project.pilotId !== me.id) {
    await prisma.notification.create({ data: { personId: e.project.pilotId, senderId: me.id, kind: "info", title: `Remarque sur la fiche ${e.project.name} · ${e.year}`, body: `${FIELDS.edition[field].label ?? field} (${{ funder: "financeur", strategy: "stratégie", feasibility: "faisabilité", form: "forme", other: "autre" }[reason]}) : ${text.slice(0, 140)}`, link: `/edition/${editionId}?onglet=fiche` } });
  }
  revalidatePath(`/edition/${editionId}`);
  return { ok: true, data: { id: r.id } };
}

// Traiter : le pilote, l'équipe, ou l'auteur. Rouvrir : les mêmes.
export async function resolveRemark(id: string, resolved: boolean): Promise<Result> {
  const me = await getCurrentPerson();
  const r = await prisma.fieldRemark.findUnique({ where: { id }, include: { edition: { include: { project: { include: { secondaryPoles: true } }, team: true } } } });
  if (!r) return { ok: false, error: "Remarque introuvable." };
  const e = r.edition;
  const allowed = r.authorId === me.id || e.project.pilotId === me.id || e.team.some((t) => t.personId === me.id) || (await canRemark(me));
  if (!allowed) return { ok: false, error: `Seuls ${le(V.pilote)}, l'équipe ou l'auteur traitent une remarque.` };
  await prisma.fieldRemark.update({ where: { id }, data: { resolvedAt: resolved ? new Date() : null, resolvedById: resolved ? me.id : null } });
  revalidatePath(`/edition/${r.editionId}`);
  return { ok: true };
}

export async function deleteRemark(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const r = await prisma.fieldRemark.findUnique({ where: { id } });
  if (!r) return { ok: false, error: "Remarque introuvable." };
  if (r.authorId !== me.id && !canActAsPilot(me, false)) return { ok: false, error: `Seul l'auteur (ou ${le(V.direction)}) supprime une remarque.` };
  await prisma.fieldRemark.delete({ where: { id } });
  revalidatePath(`/edition/${r.editionId}`);
  return { ok: true };
}
