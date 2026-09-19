import { daysFromNow, dayjs } from "./format";

// Appels à projets (lot B, module « veille »). Règles reprises d'erp-tlst : le statut d'équipe appartient à la CRESS, l'état
// de l'échéance se calcule à l'affichage, un appel n'est jamais supprimé (actif = false), pas de doublon à la promotion.
export type CallLike = { deadline: Date | null; rolling: boolean; active: boolean; createdAt: Date; teamStatus: string | null; conventionId: string | null };

export const CALL_STATUSES = [
  { value: "study", label: "À étudier", color: "warning" },
  { value: "apply", label: "On dépose", color: "mint" },
  { value: "dismissed", label: "Écarté", color: "muted" },
] as const;

export type CallStatus = (typeof CALL_STATUSES)[number]["value"];

export function callStatusLabel(v: string | null): string {
  return CALL_STATUSES.find((s) => s.value === v)?.label ?? "Pas encore regardé";
}

export type DeadlineState = { key: "closed" | "soon" | "open" | "rolling" | "unknown"; label: string; tone: "danger" | "warning" | "mint" | "primary" | "muted"; rank: number; daysLeft: number | null };

// État de l'échéance : clôturé (date passée), proche (≤ soonDays), ouvert, au fil de l'eau, inconnu.
export function deadlineState(c: Pick<CallLike, "deadline" | "rolling">, soonDays = 30): DeadlineState {
  if (c.rolling) return { key: "rolling", label: "Au fil de l'eau", tone: "primary", rank: 2, daysLeft: null };
  if (!c.deadline) return { key: "unknown", label: "Date à confirmer", tone: "muted", rank: 3, daysLeft: null };
  const n = daysFromNow(c.deadline);
  if (n < 0) return { key: "closed", label: `Clôturé depuis ${-n} j`, tone: "danger", rank: 4, daysLeft: n };
  if (n <= soonDays) return { key: "soon", label: n === 0 ? "Aujourd'hui" : `Proche · J-${n}`, tone: "warning", rank: 0, daysLeft: n };
  return { key: "open", label: `Ouvert · J-${n}`, tone: "mint", rank: 1, daysLeft: n };
}

// Nouveau : repéré depuis moins de sept jours, pas encore regardé.
export function isNewCall(c: Pick<CallLike, "createdAt" | "teamStatus">, days = 7): boolean {
  return !c.teamStatus && dayjs().diff(c.createdAt, "day") < days;
}

// Tri : actifs d'abord, puis par état d'échéance (proche, ouvert, fil de l'eau, inconnu, clôturé), puis jours restants.
export function sortCalls<T extends Pick<CallLike, "deadline" | "rolling" | "active"> & { label: string }>(calls: T[], soonDays = 30): T[] {
  return [...calls].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const sa = deadlineState(a, soonDays), sb = deadlineState(b, soonDays);
    if (sa.rank !== sb.rank) return sa.rank - sb.rank;
    if (sa.daysLeft !== null && sb.daysLeft !== null && sa.daysLeft !== sb.daysLeft) return sa.daysLeft - sb.daysLeft;
    return a.label.localeCompare(b.label, "fr");
  });
}

// Référence de convention proposée à la promotion : FINANCEUR-ANNÉE, en majuscules sans accents ni espaces.
export function suggestedReference(funderName: string, year: number): string {
  const base = funderName.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 12);
  return `${base || "AAP"}-${year}`;
}

// « 42 000 € / an · 2 ans », « 30 000 € global », ou null si rien n'est visé.
export function fmtCallAmount(c: { amountValue: number | null; amountKind: string; durationYears: number | null }): string | null {
  if (c.amountValue == null) return null;
  const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(c.amountValue);
  const years = c.durationYears && c.durationYears > 1 ? ` · ${c.durationYears} ans` : "";
  return `${euro} ${c.amountKind === "annual" ? "/ an" : "global"}${years}`;
}
