import dayjs from "dayjs";
import "dayjs/locale/fr";
import isoWeek from "dayjs/plugin/isoWeek";
import relativeTime from "dayjs/plugin/relativeTime";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.locale("fr");
dayjs.extend(isoWeek);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);

export { dayjs };

export function fmtDate(d: Date | string | null | undefined, format = "D MMM YYYY"): string {
  if (!d) return "—";
  return dayjs(d).format(format);
}

export function fmtDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  return dayjs(d).format("YYYY-MM-DD");
}

export function fmtEuro(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(n);
}

export function fmtNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(n);
}

export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  return `${fmtNumber(h, 1)} h`;
}

export function fmtDays(d: number | null | undefined): string {
  if (d === null || d === undefined) return "—";
  return `${fmtNumber(d, 1)} j`;
}

export function daysFromNow(d: Date | string): number {
  return dayjs(d).startOf("day").diff(dayjs().startOf("day"), "day");
}

export function monthKey(d: Date | string): string {
  return dayjs(d).format("YYYY-MM");
}

export function monthLabel(key: string): string {
  const s = dayjs(key + "-01").format("MMMM YYYY");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
