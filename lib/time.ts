import { dayjs } from "./format";
import { prisma } from "./db";

export function weekKey(d: dayjs.Dayjs): string {
  return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, "0")}`;
}

export function parseWeek(key: string | undefined): dayjs.Dayjs {
  const m = key?.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return dayjs().startOf("isoWeek");
  return dayjs(`${m[1]}-01-04`).isoWeek(Number(m[2])).startOf("isoWeek");
}

export function weekDays(start: dayjs.Dayjs, count = 5): dayjs.Dayjs[] {
  return Array.from({ length: count }, (_, i) => start.add(i, "day"));
}

// Rythmes de l'accord d'entreprise (S3.66, S3.A.5) : heures par jour lundi→dimanche, semaine paire / impaire.
export const DEFAULT_RHYTHMS = [
  { code: "option_a", label: "Option A · 36 h 30 (7,5 h lun-jeu, 6,5 h ven)", hoursEven: "7.5,7.5,7.5,7.5,6.5,0,0", hoursOdd: "7.5,7.5,7.5,7.5,6.5,0,0" },
  { code: "option_b", label: "Option B · 9 jours par quinzaine, 8,25 h (vendredi une semaine sur deux)", hoursEven: "8.25,8.25,8.25,8.25,8.25,0,0", hoursOdd: "8.25,8.25,8.25,8.25,0,0,0" },
  { code: "part_time", label: "Temps partiel 80 % · 28 h", hoursEven: "7,7,7,7,0,0,0", hoursOdd: "7,7,7,7,0,0,0" },
  { code: "apprentice", label: "Alternance · 35 h", hoursEven: "7,7,7,7,7,0,0", hoursOdd: "7,7,7,7,7,0,0" },
];

export type RhythmDef = { code: string; label: string; hoursEven: string; hoursOdd: string };

export function parseHours(s: string): number[] {
  const arr = s.split(",").map((x) => Number(x.replace(",", ".")) || 0);
  while (arr.length < 7) arr.push(0);
  return arr.slice(0, 7);
}

// Heures attendues un jour donné pour un rythme (semaine ISO paire ou impaire).
export function expectedHoursOn(r: RhythmDef, d: dayjs.Dayjs): number {
  const arr = parseHours(d.isoWeek() % 2 === 0 ? r.hoursEven : r.hoursOdd);
  return arr[d.isoWeekday() - 1] ?? 0;
}

export function expectedWeekHoursFor(r: RhythmDef, weekStart: dayjs.Dayjs): number {
  return weekDays(weekStart, 7).reduce((s, d) => s + expectedHoursOn(r, d), 0);
}

// Rythme d'une personne à une date : période d'effet la plus récente ; à défaut, le rythme par défaut de la fiche.
export type PersonRhythms = { workRhythm: string; rhythmPeriods: { from: Date; to: Date | null; rhythm: RhythmDef }[] };

export function rhythmAt(p: PersonRhythms, d: dayjs.Dayjs, all: RhythmDef[]): RhythmDef | null {
  const active = p.rhythmPeriods
    .filter((x) => !dayjs(x.from).isAfter(d, "day") && (!x.to || !dayjs(x.to).isBefore(d, "day")))
    .sort((a, b) => dayjs(b.from).valueOf() - dayjs(a.from).valueOf())[0];
  if (active) return active.rhythm;
  return all.find((r) => r.code === p.workRhythm) ?? null;
}

export async function loadRhythms(): Promise<RhythmDef[]> {
  return prisma.rhythm.findMany({ orderBy: { order: "asc" } });
}

// Jours ouvrés (lundi-vendredi) d'un mois AAAA-MM, jusqu'à aujourd'hui au plus.
export function workingDaysOfMonth(month: string, until: dayjs.Dayjs = dayjs()): dayjs.Dayjs[] {
  const start = dayjs(month + "-01");
  const end = start.endOf("month");
  const out: dayjs.Dayjs[] = [];
  for (let d = start; d.isBefore(end) || d.isSame(end, "day"); d = d.add(1, "day")) {
    if (d.isAfter(until, "day")) break;
    if (d.isoWeekday() <= 5) out.push(d);
  }
  return out;
}

// Jours attendus d'une personne sur un mois = jours où son rythme prévoit des heures.
export function expectedDaysOfMonth(p: PersonRhythms, month: string, all: RhythmDef[], until: dayjs.Dayjs = dayjs()): { days: dayjs.Dayjs[]; hours: number } {
  const days: dayjs.Dayjs[] = [];
  let hours = 0;
  for (const d of workingDaysOfMonth(month, until)) {
    const r = rhythmAt(p, d, all);
    const h = r ? expectedHoursOn(r, d) : 0;
    if (h > 0) { days.push(d); hours += h; }
  }
  return { days, hours };
}
