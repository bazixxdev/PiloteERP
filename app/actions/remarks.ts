"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { FIELDS } from "@/lib/fields";
import { inMyPole } from "@/lib/scope";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Qui peut poser une remarque sur une fiche : la direction, la RAF, le responsable de pôle du projet (garant ou pôle associé).
export async function canRemark(me: { id: string; role: string; poleId: string | null }, e: { project: { poleId: string; guarantorId: string | null; secondaryPoles: { poleId: string }[] } }): Promise<boolean> {
  if (me.role === "director" || me.role === "raf") return true;
  if (me.role === "pole_lead") return e.project.guarantorId === me.id || inMyPole(me, e.project);
  return false;
}

export async function addRemark(editionId: string, field: string, body: string): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true, pilot: true } } } });
  if (!e) return { ok: false, error: "Édition introuvable." };
  if (!FIELDS.edition[field]) return { ok: false, error: "Rubrique inconnue." };
  if (!(await canRemark(me, e))) return { ok: false, error: "Les remarques sur la fiche sont réservées à la direction, à la RAF et au responsable de pôle." };
  const text = body.trim();
  if (!text) return { ok: false, error: "Écrivez la remarque." };
  const r = await prisma.fieldRemark.create({ data: { editionId, field, body: text, authorId: me.id } });
  await prisma.changeLog.create({ data: { editionId, field, before: null, after: `Remarque : ${text}`.slice(0, 500), authorId: me.id } });
  // Le pilote est prévenu dans l'outil (cloche + Ma semaine), sauf s'il est lui-même l'auteur.
  if (e.project.pilotId !== me.id) {
    await prisma.notification.create({ data: { personId: e.project.pilotId, senderId: me.id, kind: "info", title: `Remarque sur la fiche ${e.project.name} · ${e.year}`, body: `${FIELDS.edition[field].label ?? field} : ${text.slice(0, 140)}`, link: `/edition/${editionId}?onglet=fiche` } });
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
  const allowed = r.authorId === me.id || e.project.pilotId === me.id || e.team.some((t) => t.personId === me.id) || (await canRemark(me, e));
  if (!allowed) return { ok: false, error: "Seuls le pilote, l'équipe ou l'auteur traitent une remarque." };
  await prisma.fieldRemark.update({ where: { id }, data: { resolvedAt: resolved ? new Date() : null, resolvedById: resolved ? me.id : null } });
  revalidatePath(`/edition/${r.editionId}`);
  return { ok: true };
}

export async function deleteRemark(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const r = await prisma.fieldRemark.findUnique({ where: { id } });
  if (!r) return { ok: false, error: "Remarque introuvable." };
  if (r.authorId !== me.id && me.role !== "director") return { ok: false, error: "Seul l'auteur (ou la direction) supprime une remarque." };
  await prisma.fieldRemark.delete({ where: { id } });
  revalidatePath(`/edition/${r.editionId}`);
  return { ok: true };
}
