// L'action, composante du projet (spec 2026-09-26) : une période décide des années où elle apparaît. Fonctions pures, sans base.
import { expenseTotals, type ExpenseLike } from "./budget";

export type Period = { startDate: Date; endDate: Date };

const yearOf = (d: Date) => d.getFullYear();
// Jour calendaire local (année/mois/jour), pour comparer des dates « à la journée près » sans que l'heure ne compte :
// un jalon ou une fin datés d'aujourd'hui ne sont pas en retard, seulement ce qui est strictement avant.
// Convention du calendrier local, comme yearOf ci-dessus : correcte sur un hôte Europe/Paris ou UTC (pas testé au-delà).
const dayOf = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
// Exportée (26/09, frise) : seule implémentation du « en retard » à la journée près, réutilisée hors de ce module.
export const beforeDay = (a: Date, b: Date) => dayOf(a) < dayOf(b);

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
// pas un jour du calendrier (« 2026-02-30 » compris) ou si l'année sort de 1900–2099 : un champ date natif en cours de
// frappe émet « 0002-03-18 », qui étendrait la période jusqu'à l'an 2. Période et jalons passent tous par ici.
export const dayInvalid = (what = "Date") => `${what} invalide : un jour du calendrier, année entre 1900 et 2099.`;
export const DAY_INVALID = dayInvalid();
// Même garde côté navigateur (champs date de la page de l'action) : n'envoyer qu'une date complète et plausible.
export const plausibleDay = (s: string): boolean => /^(19|20)\d{2}-\d{2}-\d{2}$/.test(s);

export function parseDay(s: string): Date | null {
  if (!plausibleDay(s)) return null;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? d : null;
}

// Un jalon hors de la période l'étend (une seule règle : création d'action avec échéance, addMilestone, updateMilestone) ;
// une date déjà dans la période la laisse telle quelle.
export function periodIncluding(p: Period, date: Date): Period {
  return { startDate: date < p.startDate ? date : p.startDate, endDate: date > p.endDate ? date : p.endDate };
}

// L'autre sens de la même règle (la période contient toujours ses jalons) : les dates de jalon qu'une nouvelle période
// laisserait dehors — comparées au jour (dayOf), pas à l'heure.
export function milestonesOutside(p: Period, dates: Date[]): Date[] {
  return dates.filter((d) => beforeDay(d, p.startDate) || beforeDay(p.endDate, d));
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

// Une date un an plus tard : même règle pour la période et pour les jalons d'une action reconduite, pour que chaque jalon
// décalé reste dans la période décalée.
export function shiftDate(d: Date): Date {
  const s = new Date(d);
  s.setFullYear(s.getFullYear() + 1);
  return s;
}

export function shiftYear(p: Period): Period {
  return { startDate: shiftDate(p.startDate), endDate: shiftDate(p.endDate) };
}

// Période d'une copie reconduite dans `newYear` : un an plus tard, mais jamais avant le 1er janvier de `newYear` — une action
// 2025–2026 reconduite depuis 2026 donne 2027-01-01 → 2027-06-30, pas 2026–2027 (la copie apparaîtrait dans l'année source,
// à côté de l'originale). La fin, dans l'année source (toRenew), tombe toujours dans `newYear`.
export function renewedPeriod(p: Period, newYear: number): Period {
  const s = shiftYear(p);
  return { startDate: yearOf(s.startDate) < newYear ? defaultPeriod(newYear).startDate : s.startDate, endDate: s.endDate };
}

// Date d'un jalon de la copie : un an plus tard ; un jalon qui tomberait avant `newYear` (avant la période de la copie) est
// abandonné (null), pas ramené au 1er janvier — il appartenait à la partie de l'action déjà faite.
export function renewedMilestoneDate(d: Date, newYear: number): Date | null {
  const s = shiftDate(d);
  return yearOf(s) < newYear ? null : s;
}

// Action d'un indicateur recopié dans la nouvelle année : la copie si l'action a été recopiée, la même action si elle court
// encore l'année suivante (`continuing`), sinon aucune.
export function renewedIndicatorAction(actionId: string | null, copies: Map<string, string>, continuing: Set<string>): string | null {
  if (!actionId) return null;
  return copies.get(actionId) ?? (continuing.has(actionId) ? actionId : null);
}

// Ce que montre le dialogue de reconduction de l'année `year` : les actions à recopier (toRenew) et celles qui continuent
// l'année suivante, déjà là (hors abandonnées : on ne les annonce pas comme « déjà là »).
export function renewPlan<A extends Period & { state: string }>(actions: A[], year: number): { renew: A[]; continuing: A[] } {
  return { renew: toRenew(actions, year), continuing: actions.filter((a) => a.state !== "abandoned" && runsIn(a, year + 1)) };
}

// Ce que la reconduction recopie : parmi les actions à reconduire (toRenew), celles cochées (`chosen`, défaut : toutes). Un
// identifiant hors de toRenew (action qui continue, abandonnée, d'un autre projet) est ignoré : jamais de doublon.
export function renewSelection<A extends Period & { id: string; state: string }>(actions: A[], year: number, chosen?: string[] | null): A[] {
  const eligible = toRenew(actions, year);
  return chosen ? eligible.filter((a) => chosen.includes(a.id)) : eligible;
}

// Les liens de financement d'une copie reconduite : chaque ligne d'origine (un financeur, un dossier éventuel) donne la ligne
// recréée du même financeur dans la nouvelle année — celle du même dossier s'il y en a plusieurs ; aucune si le financeur n'y
// est plus. Sans doublon (deux lignes d'origine du même financeur donnent une seule cible). Seuls comptent les liens vers
// une ligne de l'année source (`sourceEditionId`) : ceux d'une autre année que l'action couvre ne sont pas les siens à suivre.
type LineRef = { funderId: string; conventionId: string | null };
export function renewedLineIds(sources: (LineRef & { editionId: string })[], lines: (LineRef & { id: string })[], sourceEditionId: string): string[] {
  const out = new Set<string>();
  for (const src of sources.filter((l) => l.editionId === sourceEditionId)) {
    const same = lines.filter((l) => l.funderId === src.funderId);
    const target = (src.conventionId ? same.find((l) => l.conventionId === src.conventionId) : undefined) ?? same[0];
    if (target) out.add(target.id);
  }
  return [...out];
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

// Rattacher quelque chose d'une année à une action (26/09) — dépense, indicateur (saveField), réalisation, demande, tâche
// (actionRunsInEdition) : l'action est du même projet, sa période chevauche l'année (actionsOfYear), et elle n'est pas
// abandonnée — ni terminée pour une tâche (mêmes règles que les sélecteurs, attachable / openForWork). Garder la valeur
// actuelle (`current`, réenregistrée telle quelle) passe toujours : attachOptions la propose même si elle ne l'est plus.
export type AttachAction = { id: string; projectId: string | null; startDate: Date | null; endDate: Date | null; state: string };
export function attachRefusal(a: AttachAction | null, e: { projectId: string; year: number }, opts: { use?: "record" | "task"; current?: string | null } = {}): "missing" | "project" | "year" | "state" | null {
  if (!a) return "missing";
  if (opts.current && a.id === opts.current) return null;
  if (a.projectId !== e.projectId) return "project";
  if (actionsOfYear([a], e).length === 0) return "year";
  return (opts.use === "task" ? openForWork(a) : attachable(a)) ? null : "state";
}

// Une action proposée dans un sélecteur (26/09) : une abandonnée ne l'est jamais ; pour du travail à faire (tâche), une
// terminée non plus. Une dépense, un indicateur, une réalisation ou une demande se rattachent encore à une action terminée
// (la facture, le résultat arrivent après la fin).
export const openForWork = (a: { state: string }) => a.state !== "done" && a.state !== "abandoned";
export const attachable = (a: { state: string }) => a.state !== "abandoned";
// Options du sélecteur « action » d'une dépense ou d'un indicateur : les actions rattachables de l'année, plus l'actuelle
// si elle n'en est plus (abandonnée, ou période raccourcie) — sinon la liste afficherait « — » au lieu du rattachement réel.
export function attachOptions(actions: { id: string; name: string; state: string }[], current: { id: string; name: string } | null): { value: string; label: string }[] {
  const opts = actions.filter(attachable).map((a) => ({ value: a.id, label: a.name }));
  return current && !opts.some((o) => o.value === current.id) ? [...opts, { value: current.id, label: current.name }] : opts;
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

// Temps valorisé : heures × coût horaire unique, ou `timeCost` déjà calculé (page de l'action : coût horaire de chaque
// personne chaque mois, lib/budget-plan-db.ts actionTimeCost) — null quand on ne le valorise pas (module, droit).
export function balance(x: { fundings: (number | null)[]; expenses: ExpenseLike[]; hours: number; hourlyCost: number | null; timeCost?: number | null }) {
  const income = x.fundings.reduce<number>((s, a) => s + (a ?? 0), 0);
  // La règle de l'onglet Budget (lib/budget.ts, expenseTotals) : réalisé + engagements restants, sans double comptage ;
  // une dépense soldée ne pèse plus que son réalisé.
  const { realizedLinked, remainingCommitments } = expenseTotals(x.expenses);
  const spending = realizedLinked + remainingCommitments;
  const timeCost = x.timeCost !== undefined ? (x.timeCost === null ? null : Math.round(x.timeCost)) : x.hourlyCost === null ? null : Math.round(x.hours * x.hourlyCost);
  return { income, spending, timeCost, gap: income - spending - (timeCost ?? 0) };
}
