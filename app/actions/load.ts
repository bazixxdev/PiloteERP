"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";
import { dayjs } from "@/lib/format";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };


// Après le figeage d'une année, toute modification de la charge est tracée (historique de l'édition) et signalée.
async function traceIfFrozen(editionId: string, personId: string, me: { id: string; name: string }, label: string, before: number, after: number) {
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: true } });
  if (!e) return;
  const frozen = await prisma.loadFreeze.findUnique({ where: { year: e.year } });
  if (!frozen) return;
  const person = await prisma.person.findUnique({ where: { id: personId } });
  await prisma.changeLog.create({ data: { editionId, field: `plannedLoad:${personId}`, before: String(before), after: `${after} · ${label} · ${person?.name ?? ""} · après validation du plan de charge`.slice(0, 500), authorId: me.id } });
  const targets = await prisma.person.findMany({ where: { active: true, role: { in: ["director", "raf"] }, id: { not: me.id } } });
  await prisma.notification.createMany({ data: targets.map((t) => ({ personId: t.id, senderId: me.id, kind: "info", title: `Plan de charge ${e.year} modifié après validation`, body: `${person?.name ?? ""} · ${e.project.name} · ${label} : ${before} → ${after} j`, link: `/plan-de-charge?debut=${e.year}-01&horizon=12` })) });
}

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
  const previous = await prisma.editionPersonDays.findUnique({ where: { editionId_personId: { editionId, personId } } });
  await prisma.$transaction([
    prisma.plannedLoad.deleteMany({ where: { editionId, personId } }),
    ...clean.filter(([, d]) => d > 0).map(([month, days]) => prisma.plannedLoad.create({ data: { editionId, personId, month, days } })),
    prisma.editionPersonDays.upsert({ where: { editionId_personId: { editionId, personId } }, create: { editionId, personId, plannedDays: total }, update: { plannedDays: total } }),
  ]);
  if ((previous?.plannedDays ?? 0) !== total) await traceIfFrozen(editionId, personId, me, "ventilation annuelle", previous?.plannedDays ?? 0, total);
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
  const beforeMonth = existing.get(month) ?? (existing.size === 0 && e.personDays[0]?.plannedDays ? Math.round((e.personDays[0].plannedDays / 12) * 100) / 100 : 0);
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
  if (beforeMonth !== value) await traceIfFrozen(editionId, personId, me, dayjs(month + "-01").format("MMMM YYYY"), beforeMonth, value);
  revalidatePath("/", "layout");
  return { ok: true, data: { total } };
}

// Figer le plan de charge d'une année (au séminaire) : direction ou RAF. Ensuite, chaque modification reste possible mais est tracée
// dans l'historique de l'édition et signalée à la RAF et à la direction — rien ne bouge en silence.
export async function freezeLoad(year: number, freeze: boolean, note?: string): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me.role)) return { ok: false, error: "La direction ou la RAF fige le plan de charge." };
  if (freeze) await prisma.loadFreeze.upsert({ where: { year }, create: { year, frozenById: me.id, note: note?.trim() || null }, update: { frozenById: me.id, frozenAt: new Date(), note: note?.trim() || null } });
  else await prisma.loadFreeze.deleteMany({ where: { year } });
  revalidatePath("/plan-de-charge");
  return { ok: true };
}
