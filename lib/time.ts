import { dayjs } from "./format";
import { RHYTHM_HOURS } from "./refs";

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

export function expectedWeekHours(rhythm: string): number {
  return RHYTHM_HOURS[rhythm] ?? 35;
}

export function expectedDayHours(rhythm: string): number {
  return Math.round((expectedWeekHours(rhythm) / 5) * 10) / 10;
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
