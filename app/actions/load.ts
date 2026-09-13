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

// Depuis la grille du plan de charge : poser les jours d'un mois pour une (édition, personne). Si l'affectation était lissée
// (pas de ventilation), les 12 mois sont d'abord matérialisés à partir du total annuel, puis le mois demandé est remplacé.
// Une personne absente de l'édition y est ajoutée (équipe + ligne RH). Le total annuel suit la somme des mois.
export async function setPlannedLoadMonth(editionId: string, personId: string, month: string, days: number): Promise<Result<{ total: number }>> {
  const me = await getCurrentPerson();
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(days) || days < 0) return { ok: false, error: "Valeur invalide." };
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: true, plannedLoads: { where: { personId } }, personDays: { where: { personId } }, team: { where: { personId } } } });
  if (!e) return { ok: false, error: "Édition introuvable." };
  const allowed = e.project.pilotId === me.id || canEditFunding(me.role) || me.role === "pole_lead";
  if (!allowed) return { ok: false, error: `${e.project.name} : seuls son pilote, la RAF, la direction ou un responsable de pôle modifient la charge.` };
  if (month.slice(0, 4) !== String(e.year)) return { ok: false, error: `${e.project.name} · ${e.year} : ce mois n'est pas dans l'année de l'édition.` };
  const value = Math.round(days * 10) / 10;
  const existing = new Map(e.plannedLoads.map((l) => [l.month, l.days]));
  if (existing.size === 0 && e.personDays[0]?.plannedDays) {
    const per = Math.round((e.personDays[0].plannedDays / 12) * 100) / 100;
    for (let i = 1; i <= 12; i++) existing.set(`${e.year}-${String(i).padStart(2, "0")}`, per);
  }
  existing.set(month, value);
  const total = Math.round([...existing.values()].reduce((s, d) => s + d, 0) * 10) / 10;
  await prisma.$transaction([
    prisma.plannedLoad.deleteMany({ where: { editionId, personId } }),
    ...[...existing.entries()].filter(([, d]) => d > 0).map(([m, d]) => prisma.plannedLoad.create({ data: { editionId, personId, month: m, days: d } })),
    prisma.editionPersonDays.upsert({ where: { editionId_personId: { editionId, personId } }, create: { editionId, personId, plannedDays: total }, update: { plannedDays: total } }),
    ...(e.team.length === 0 ? [prisma.editionTeam.create({ data: { editionId, personId } })] : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, data: { total } };
}
