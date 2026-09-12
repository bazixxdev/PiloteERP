"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canLockMonths } from "@/lib/rights";
import { dayjs, monthKey } from "@/lib/format";
import { weekKey } from "@/lib/time";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export type TimeCellKey = { projectId?: string | null; actionId?: string | null; timeCodeId?: string | null };

// Une saisie = personne × projet (ou action, ou code) × date × heures (EF-D1, EF-D7).
export async function saveTime(input: TimeCellKey & { date: string; hours: number; comment?: string | null; personId?: string }): Promise<Result> {
  const me = await getCurrentPerson();
  const personId = input.personId ?? me.id;
  if (personId !== me.id && !canLockMonths(me.role)) return { ok: false, error: "Vous ne saisissez que vos propres temps." };
  const date = dayjs(input.date).startOf("day");
  const locked = await prisma.monthLock.findUnique({ where: { personId_month: { personId, month: monthKey(date.toDate()) } } });
  if (locked) return { ok: false, error: "Ce mois est verrouillé : demandez à la RAF de le déverrouiller." };

  const where = { personId, date: date.toDate(), projectId: input.projectId ?? null, actionId: input.actionId ?? null, timeCodeId: input.timeCodeId ?? null };
  const existing = await prisma.timeEntry.findFirst({ where });
  const hours = Math.round((Number(input.hours) || 0) * 100) / 100;
  if (hours <= 0 && !input.comment) {
    if (existing) await prisma.timeEntry.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.timeEntry.update({ where: { id: existing.id }, data: { hours, comment: input.comment === undefined ? existing.comment : input.comment } });
  } else {
    await prisma.timeEntry.create({ data: { ...where, hours, comment: input.comment ?? null } });
  }
  // Toute modification après déclaration de complétude annule cette déclaration sur la semaine.
  await prisma.weekDeclaration.deleteMany({ where: { personId, week: weekKey(date) } });
  revalidatePath("/temps");
  return { ok: true };
}

// « Cette semaine est complète » : déclaration de la personne, lue par la RAF à la clôture ; ne verrouille rien.
export async function declareWeek(week: string): Promise<Result> {
  const me = await getCurrentPerson();
  await prisma.weekDeclaration.upsert({ where: { personId_week: { personId: me.id, week } }, create: { personId: me.id, week }, update: { declaredAt: new Date() } });
  revalidatePath("/temps");
  revalidatePath("/cloture");
  return { ok: true };
}

// Propose les valeurs de la semaine précédente (EF-D1) : copie les lignes non renseignées.
export async function copyPreviousWeek(weekStart: string): Promise<Result<{ copied: number }>> {
  const me = await getCurrentPerson();
  const start = dayjs(weekStart).startOf("isoWeek");
  const prev = start.subtract(1, "week");
  const month = monthKey(start.toDate());
  const locked = await prisma.monthLock.findUnique({ where: { personId_month: { personId: me.id, month } } });
  if (locked) return { ok: false, error: "Ce mois est verrouillé." };
  const prevEntries = await prisma.timeEntry.findMany({ where: { personId: me.id, date: { gte: prev.toDate(), lt: start.toDate() } } });
  const current = await prisma.timeEntry.findMany({ where: { personId: me.id, date: { gte: start.toDate(), lt: start.add(1, "week").toDate() } } });
  let copied = 0;
  for (const p of prevEntries) {
    const date = dayjs(p.date).add(1, "week");
    if (date.isAfter(dayjs(), "day")) continue;
    const dup = current.find((c) => dayjs(c.date).isSame(date, "day") && c.projectId === p.projectId && c.actionId === p.actionId && c.timeCodeId === p.timeCodeId);
    if (dup) continue;
    await prisma.timeEntry.create({ data: { personId: me.id, date: date.toDate(), projectId: p.projectId, actionId: p.actionId, timeCodeId: p.timeCodeId, hours: p.hours } });
    copied++;
  }
  revalidatePath("/temps");
  return { ok: true, data: { copied } };
}

// Verrouillage mensuel par la RAF (EF-D5) ; déverrouillage possible.
export async function lockMonth(personId: string, month: string, lock: boolean): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canLockMonths(me.role)) return { ok: false, error: "Seule la RAF (ou la direction) verrouille un mois." };
  const start = dayjs(month + "-01");
  const range = { gte: start.toDate(), lt: start.add(1, "month").toDate() };
  if (lock) {
    await prisma.monthLock.upsert({ where: { personId_month: { personId, month } }, create: { personId, month, lockedById: me.id }, update: { lockedById: me.id, lockedAt: new Date() } });
    await prisma.timeEntry.updateMany({ where: { personId, date: range }, data: { locked: true } });
  } else {
    await prisma.monthLock.deleteMany({ where: { personId, month } });
    await prisma.timeEntry.updateMany({ where: { personId, date: range }, data: { locked: false } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function lockMonthForAll(month: string, personIds: string[]): Promise<Result<{ count: number }>> {
  let count = 0;
  for (const id of personIds) {
    const r = await lockMonth(id, month, true);
    if (!r.ok) return r;
    count++;
  }
  return { ok: true, data: { count } };
}
