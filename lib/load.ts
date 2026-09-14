import { prisma } from "./db";
import { dayjs } from "./format";
import { expectedDaysOfMonth, loadRhythms, type PersonRhythms, type RhythmDef } from "./time";

// Plan de charge : jours prévus par personne et par mois, toutes éditions, face à une capacité mensuelle.
// Capacité du mois = jours disponibles de l'année (admin, congés déjà déduits) × part du mois dans les jours attendus du
// rythme sur l'année. Un 80 % a donc une capacité plus faible, un mois de 23 jours ouvrés un peu plus qu'un mois de 20.

export const monthKeys = (from: string, count: number): string[] => Array.from({ length: count }, (_, i) => dayjs(from + "-01").add(i, "month").format("YYYY-MM"));

// Les jours de fonctionnement (réunions transverses, café, entretiens — réglage admin) sont déduits au prorata du rythme :
// un 80 % en perd 80 %. Capacité nette, jamais négative.
export function monthCapacity(p: PersonRhythms & { availableDays: number }, month: string, rhythms: RhythmDef[], operatingDaysPerMonth = 0): number {
  const year = month.slice(0, 4);
  const endOf = (m: string) => dayjs(m + "-01").endOf("month");
  const inMonth = expectedDaysOfMonth(p, month, rhythms, endOf(month)).days.length;
  const inYear = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).reduce((s, m) => s + expectedDaysOfMonth(p, m, rhythms, endOf(m)).days.length, 0);
  if (!inYear) return 0;
  const gross = (p.availableDays * inMonth) / inYear;
  const operating = operatingDaysPerMonth * Math.min(1, inMonth / 21);
  return Math.max(0, Math.round((gross - operating) * 10) / 10);
}

export type LoadCell = { editionId: string; project: string; year: number; status: string; days: number; ventilated: boolean };

// Charge effective d'une (édition, personne) par mois : les mois ventilés s'ils existent, sinon le total annuel lissé sur l'année.
export function effectiveMonths(e: { id: string; year: number; project: { name: string }; status: string }, plannedDays: number, loads: { month: string; days: number }[]): Map<string, LoadCell> {
  const out = new Map<string, LoadCell>();
  if (loads.length > 0) {
    for (const l of loads) if (l.days > 0) out.set(l.month, { editionId: e.id, project: e.project.name, year: e.year, status: e.status, days: l.days, ventilated: true });
    return out;
  }
  if (plannedDays > 0) {
    const per = Math.round((plannedDays / 12) * 100) / 100;
    for (let i = 1; i <= 12; i++) out.set(`${e.year}-${String(i).padStart(2, "0")}`, { editionId: e.id, project: e.project.name, year: e.year, status: e.status, days: per, ventilated: false });
  }
  return out;
}

export type PersonLoad = {
  person: { id: string; name: string; role: string; poleId: string | null; poleName: string | null; availableDays: number };
  months: Record<string, { planned: number; capacity: number; realized: number | null; cells: LoadCell[] }>;
};

// Charge de toutes les personnes actives sur une fenêtre de mois, avec le réalisé (heures saisies ÷ coefficient) sur les mois passés.
export async function loadPlan(months: string[], opts: { statuses: string[]; hoursPerDay: number; poleId?: string | null; operatingDaysPerMonth?: number }): Promise<PersonLoad[]> {
  const [rhythms, people, editions, entries] = await Promise.all([
    loadRhythms(),
    prisma.person.findMany({ where: { active: true, role: { not: "assistant" }, ...(opts.poleId ? { poleId: opts.poleId } : {}) }, include: { pole: true, rhythmPeriods: { include: { rhythm: true } } }, orderBy: [{ pole: { name: "asc" } }, { order: "asc" }] }),
    prisma.edition.findMany({ where: { status: { in: opts.statuses }, year: { in: [...new Set(months.map((m) => Number(m.slice(0, 4))))] } }, include: { project: true, personDays: true, plannedLoads: true } }),
    prisma.timeEntry.findMany({ where: { date: { gte: dayjs(months[0] + "-01").toDate(), lt: dayjs(months[months.length - 1] + "-01").add(1, "month").toDate() } }, select: { personId: true, date: true, hours: true } }),
  ]);
  const today = dayjs().format("YYYY-MM");
  return people.map((p) => {
    const monthsOut: PersonLoad["months"] = {};
    for (const m of months) monthsOut[m] = { planned: 0, capacity: monthCapacity(p, m, rhythms, opts.operatingDaysPerMonth ?? 0), realized: m <= today ? 0 : null, cells: [] };
    for (const e of editions) {
      const pd = e.personDays.find((d) => d.personId === p.id);
      const loads = e.plannedLoads.filter((l) => l.personId === p.id);
      if (!pd && loads.length === 0) continue;
      for (const [m, cell] of effectiveMonths(e, pd?.plannedDays ?? 0, loads)) {
        if (!monthsOut[m]) continue;
        monthsOut[m].planned = Math.round((monthsOut[m].planned + cell.days) * 10) / 10;
        monthsOut[m].cells.push(cell);
      }
    }
    for (const t of entries) {
      if (t.personId !== p.id) continue;
      const m = dayjs(t.date).format("YYYY-MM");
      if (monthsOut[m] && monthsOut[m].realized !== null) monthsOut[m].realized = Math.round(((monthsOut[m].realized ?? 0) + t.hours / opts.hoursPerDay) * 10) / 10;
    }
    return { person: { id: p.id, name: p.name, role: p.role, poleId: p.poleId, poleName: p.pole?.name ?? null, availableDays: p.availableDays }, months: monthsOut };
  });
}
