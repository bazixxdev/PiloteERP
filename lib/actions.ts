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

// Un jour saisi « AAAA-MM-JJ » (champ date) → minuit UTC, comme saveField (lib/fields.ts, coerce) ; null si le texte n'est
// pas un jour du calendrier (« 2026-02-30 » compris). Période et jalons passent tous par ici.
export function parseDay(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? d : null;
}

// Un jalon hors de la période l'étend (une seule règle : création d'action avec échéance, addMilestone, updateMilestone,
// setNextMilestoneDate) ; une date déjà dans la période la laisse telle quelle.
export function periodIncluding(p: Period, date: Date): Period {
  return { startDate: date < p.startDate ? date : p.startDate, endDate: date > p.endDate ? date : p.endDate };
}

export function yearsOf(p: Period): number[] {
  const out: number[] = [];
  for (let y = yearOf(p.startDate); y <= yearOf(p.endDate); y++) out.push(y);
  return out;
}

// « 2026 » ou « 2025–2027 » : les années d'une période, pour nommer une action hors d'une année donnée.
export function yearsLabel(p: Period): string {
  const [a, b] = [yearOf(p.startDate), yearOf(p.endDate)];
  return a === b ? String(a) : `${a}–${b}`;
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

// Titre d'un jalon hors de sa page : « action · libellé », ou le nom seul quand le libellé le répète (jalons repris de
// l'ancien champ unique, ou posés sans libellé propre : la migration leur donne le nom de l'action).
export function milestoneTitle(actionName: string, label: string): string {
  return label.trim() === "" || label.trim() === actionName.trim() ? actionName : `${actionName} · ${label}`;
}

// Les actions d'une année (même projet, période qui chevauche l'année) ; une action sans projet ni période n'est nulle part.
export function actionsOfYear<A extends { projectId: string | null; startDate: Date | null; endDate: Date | null }>(actions: A[], e: { projectId: string; year: number }): (A & Period & { projectId: string })[] {
  return actions.filter((a): a is A & Period & { projectId: string } => a.projectId === e.projectId && a.startDate !== null && a.endDate !== null && runsIn({ startDate: a.startDate, endDate: a.endDate }, e.year));
}

// Partie pure d'attachYearActions : chaque année reçoit ses actions, avec les heures saisies dans CETTE année et le total.
export function withYearActions<E extends { projectId: string; year: number }, A extends { id: string; projectId: string | null; startDate: Date | null; endDate: Date | null }>(
  editions: E[], actions: A[], hoursByYear: Map<number, Map<string | null, number>>, hoursTotal: Map<string | null, number>,
) {
  return editions.map((e) => ({ ...e, actions: actionsOfYear(actions, e).map((a) => ({ ...a, hoursYear: hoursByYear.get(e.year)?.get(a.id) ?? 0, hoursTotal: hoursTotal.get(a.id) ?? 0 })) }));
}

// Une action qui court sur plusieurs années apparaît dans chacune : un jalon ne doit pourtant sortir qu'une fois (relance,
// agenda). Il se rattache à l'année de sa date si l'action y court et qu'elle est parmi `editions`, sinon à la première.
export function editionForMilestone<E extends { projectId: string; year: number }>(m: { date: Date }, action: { projectId: string | null; startDate: Date | null; endDate: Date | null }, editions: E[]): E | null {
  const mine = editions.filter((e) => actionsOfYear([action], e).length > 0).sort((a, b) => a.year - b.year);
  return mine.find((e) => e.year === yearOf(m.date)) ?? mine[0] ?? null;
}

export function actionAlerts(a: { name: string; state: string; endDate: Date; timeTarget: number | null; hours: number; milestones: { date: Date; done: boolean; label: string }[] }, today: Date) {
  const out: { kind: "milestone_overdue" | "action_overdue" | "time_over"; level: "danger" | "warning"; label: string; when?: Date }[] = [];
  if (a.state === "done" || a.state === "abandoned") return out;
  // Comparaison à la journée (pas à l'horodatage) : un jalon ou une fin datés d'aujourd'hui ne sont pas en retard.
  for (const m of a.milestones) if (!m.done && beforeDay(m.date, today)) out.push({ kind: "milestone_overdue", level: "danger", label: `Jalon dépassé : ${milestoneTitle(a.name, m.label)}`, when: m.date });
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
