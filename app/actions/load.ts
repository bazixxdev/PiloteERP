"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Ventilation mensuelle des jours prévus d'une personne sur une édition. Mêmes droits que la charge planifiée :
// le pilote de l'édition, la RAF, la direction, les responsables de pôle. La somme des mois devient le total annuel.
export async function setPlannedLoad(editionId: string, personId: string, months: Record<string, number>): Promise<Result<{ total: number }>> {
  const me = await getCurrentPerson();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: true } });
  if (!e) return { ok: false, error: "Édition introuvable." };
  const allowed = e.project.pilotId === me.id || canEditFunding(me.role) || me.role === "pole_lead";
  if (!allowed) return { ok: false, error: "La charge est proposée par le pilote et ajustée par la RAF ou le responsable de pôle." };
  const clean = Object.entries(months).filter(([m, d]) => /^\d{4}-\d{2}$/.test(m) && Number.isFinite(d) && d >= 0).map(([m, d]) => [m, Math.round(d * 10) / 10] as const);
  const total = Math.round(clean.reduce((s, [, d]) => s + d, 0) * 10) / 10;
  await prisma.$transaction([
    prisma.plannedLoad.deleteMany({ where: { editionId, personId } }),
    ...clean.filter(([, d]) => d > 0).map(([month, days]) => prisma.plannedLoad.create({ data: { editionId, personId, month, days } })),
    prisma.editionPersonDays.upsert({ where: { editionId_personId: { editionId, personId } }, create: { editionId, personId, plannedDays: total }, update: { plannedDays: total } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, data: { total } };
}
