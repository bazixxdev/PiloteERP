// L'action, composante du projet (spec 2026-09-26) : une période décide des années où elle apparaît. Fonctions pures, sans base.
export type Period = { startDate: Date; endDate: Date };

const yearOf = (d: Date) => d.getFullYear();
// Jour calendaire local (année/mois/jour), pour comparer des dates « à la journée près » sans que l'heure ne compte :
// un jalon ou une fin datés d'aujourd'hui ne sont pas en retard, seulement ce qui est strictement avant.
// Convention du calendrier local, comme yearOf ci-dessus : correcte sur un hôte Europe/Paris ou UTC (pas testé au-delà).
const dayOf = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
const beforeDay = (a: Date, b: Date) => dayOf(a) < dayOf(b);

export function runsIn(p: Period, year: number): boolean {
  return yearOf(p.startDate) <= year && year <= yearOf(p.endDate);
}

export function defaultPeriod(year: number): Period {
  return { startDate: new Date(`${year}-01-01`), endDate: new Date(`${year}-12-31`) };
}

export function validPeriod(start: Date, end: Date): string | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Date invalide.";
  return end < start ? "La fin précède le début." : null;
}

export function yearsOf(p: Period): number[] {
  const out: number[] = [];
  for (let y = yearOf(p.startDate); y <= yearOf(p.endDate); y++) out.push(y);
  return out;
}

export function spanLabel(p: Period, year: number): string | null {
  const from = yearOf(p.startDate) < year ? `depuis ${yearOf(p.startDate)}` : null;
  const to = yearOf(p.endDate) > year ? `jusqu'en ${yearOf(p.endDate)}` : null;
  return [from, to].filter(Boolean).join(" · ") || null;
}

// Reconduire l'année `year` : les actions qui continuent l'année suivante sont déjà là ; on propose celles qui finissent.
// « Terminées » n'ajoute rien à ce filtre : une action « done » qui court encore l'année suivante y apparaît déjà
// (la reconduire créerait le doublon que la règle interdit), et une action « done » finie avant `year` n'est pas
// dans `year` du tout — seule reste la fin dans l'année source.
export function toRenew<A extends Period & { state: string }>(actions: A[], year: number): A[] {
  return actions.filter((a) => a.state !== "abandoned" && runsIn(a, year) && yearOf(a.endDate) === year);
}

export function shiftYear(p: Period): Period {
  const s = new Date(p.startDate), e = new Date(p.endDate);
  s.setFullYear(s.getFullYear() + 1); e.setFullYear(e.getFullYear() + 1);
  return { startDate: s, endDate: e };
}

// Lier une action à une ligne d'un dossier : les lignes du même dossier, du même projet, sur les années que l'action couvre.
export function propagationTargets(action: Period & { projectId: string }, lines: { id: string; conventionId: string | null; editionYear: number; projectId: string }[], conventionId: string): string[] {
  return lines.filter((l) => l.conventionId === conventionId && l.projectId === action.projectId && runsIn(action, l.editionYear)).map((l) => l.id);
}

export function fundingOverflow(line: { amountGranted: number | null; amountRequested: number | null }, amounts: (number | null)[]): number | null {
  const ceiling = line.amountGranted ?? line.amountRequested;
  if (ceiling === null) return null;
  const sum = amounts.reduce<number>((s, a) => s + (a ?? 0), 0);
  return sum > ceiling + 0.001 ? sum - ceiling : null;
}

export function actionAlerts(a: { name: string; state: string; endDate: Date; timeTarget: number | null; hours: number; milestones: { date: Date; done: boolean; label: string }[] }, today: Date) {
  const out: { kind: "milestone_overdue" | "action_overdue" | "time_over"; level: "danger" | "warning"; label: string; when?: Date }[] = [];
  if (a.state === "done" || a.state === "abandoned") return out;
  // Comparaison à la journée (pas à l'horodatage) : un jalon ou une fin datés d'aujourd'hui ne sont pas en retard.
  for (const m of a.milestones) if (!m.done && beforeDay(m.date, today)) out.push({ kind: "milestone_overdue", level: "danger", label: `Jalon dépassé : ${a.name} · ${m.label}`, when: m.date });
  if (beforeDay(a.endDate, today)) out.push({ kind: "action_overdue", level: "danger", label: `Fin dépassée : ${a.name}`, when: a.endDate });
  if (a.timeTarget && a.hours > a.timeTarget) out.push({ kind: "time_over", level: "warning", label: `Temps dépassé : ${a.name} (${Math.round(a.hours)} h / ${a.timeTarget} h)` });
  return out;
}

export function balance(x: { fundings: (number | null)[]; expenses: { committed: number; spent: number }[]; hours: number; hourlyCost: number | null }) {
  const income = x.fundings.reduce<number>((s, a) => s + (a ?? 0), 0);
  // Même règle que lib/budget.ts (budgetOf, lignes 9-10) : réalisé + engagements restants, sans double comptage —
  // remainingCommitments = max(0, committed − spent) ; ici sans distinction de statut « ouvert » (absent de cette forme
  // légère), donc chaque dépense pèse pour spent + max(0, committed − spent) = max(committed, spent).
  const spending = x.expenses.reduce((s, e) => s + e.spent + Math.max(0, e.committed - e.spent), 0);
  const timeCost = x.hourlyCost === null ? null : Math.round(x.hours * x.hourlyCost);
  return { income, spending, timeCost, gap: income - spending - (timeCost ?? 0) };
}
