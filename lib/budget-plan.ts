// Budget prévisionnel par catégorie (25/09, docs/superpowers/specs/2026-09-25-budget-previsionnel-design.md) — fonctions pures.
// Le prévu vit sur l'édition ; le réalisé Personnel vient du temps valorisé, le reste du grand livre classé par préfixe de compte.
import { has, type Actor } from "./rights";
import type { Viewer } from "./scope";

export type Category = { id: string; label: string; accountPrefixes: string; source: "time" | "ledger" | "none"; order: number; active: boolean };

const prefixesOf = (c: Category) => c.accountPrefixes.split(",").map((p) => p.trim()).filter(Boolean);

// Préfixe le plus long qui correspond ; seules les charges (6x) et l'investissement (2x) se classent.
export function classifyAccount(account: string, categories: Category[]): Category | null {
  if (!account.startsWith("6") && !account.startsWith("2")) return null;
  let best: { c: Category; len: number } | null = null;
  for (const c of categories) for (const p of prefixesOf(c)) if (account.startsWith(p) && (!best || p.length > best.len)) best = { c, len: p.length };
  return best?.c ?? null;
}

// Grand livre → catégories « ledger ». Un compte classé dans une catégorie « time » (le 64 du Personnel) n'est pas compté ici :
// le Personnel se lit dans le temps valorisé. Ce qu'aucune catégorie ne reconnaît va en non classé, visible.
export function ledgerByCategory(accounts: { accountNumber: string; amount: number }[], categories: Category[]) {
  const byCategory = new Map<string, number>();
  let unclassified = 0;
  for (const a of accounts) {
    const c = classifyAccount(a.accountNumber, categories);
    if (!c) { if (a.accountNumber.startsWith("6") || a.accountNumber.startsWith("2")) unclassified += a.amount; continue; }
    if (c.source !== "ledger") continue;
    byCategory.set(c.id, (byCategory.get(c.id) ?? 0) + a.amount);
  }
  return { byCategory, unclassified };
}

export type HrRule = { personId: string | null; amount: number; period: string; startMonth: string; endMonth: string | null; active: boolean; kind: string };

const PER_MONTH: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

// Coût mensuel chargé d'une personne un mois donné (règle « ressource humaine » de la trésorerie active ce mois-là).
export function monthlyCost(personId: string, month: string, rules: HrRule[]): number | null {
  const r = rules.find((x) => x.kind === "hr" && x.active && x.personId === personId && x.startMonth <= month && (!x.endMonth || month <= x.endMonth) && PER_MONTH[x.period]);
  return r ? r.amount / PER_MONTH[r.period] : null;
}

// Temps du projet × coût horaire du mois. Une heure sans coût connu est comptée et signalée, jamais valorisée à un coût deviné.
export function personnelActual(entries: { personId: string; month: string; hours: number }[], costOf: (personId: string, month: string) => number | null) {
  const per = new Map<string, { hours: number; amount: number; unvalued: number }>();
  for (const e of entries) {
    const p = per.get(e.personId) ?? { hours: 0, amount: 0, unvalued: 0 };
    p.hours += e.hours;
    const c = costOf(e.personId, e.month);
    if (c === null) p.unvalued += e.hours; else p.amount += e.hours * c;
    per.set(e.personId, p);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const byPerson = [...per].map(([personId, p]) => ({ personId, hours: p.hours, amount: round(p.amount) }));
  return {
    amount: round(byPerson.reduce((s, p) => s + p.amount, 0)),
    hours: byPerson.reduce((s, p) => s + p.hours, 0),
    byPerson,
    unvalued: [...per].filter(([, p]) => p.unvalued > 0).map(([personId, p]) => ({ personId, hours: p.unvalued })),
  };
}

export type PlanRow = { categoryId: string; label: string; source: string; planned: number; computed: number; override: { amount: number; reason: string } | null; actual: number; engaged: number; gap: number; pct: number | null };

// Écart = prévu − réalisé retenu − engagé restant ; % consommé = (réalisé + engagé) ÷ prévu, jamais plafonné.
export function budgetTable(input: { categories: Category[]; lines: { categoryId: string; amount: number }[]; computed: Map<string, number>; overrides: { categoryId: string; amount: number; reason: string }[]; engaged: Map<string, number>; unclassified: number }) {
  const used = new Set([...input.lines.map((l) => l.categoryId), ...input.overrides.map((o) => o.categoryId), ...input.computed.keys(), ...input.engaged.keys()]);
  const rows: PlanRow[] = [...input.categories]
    .filter((c) => c.active || used.has(c.id))
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const planned = input.lines.filter((l) => l.categoryId === c.id).reduce((s, l) => s + l.amount, 0);
      const computed = input.computed.get(c.id) ?? 0;
      const o = input.overrides.find((x) => x.categoryId === c.id);
      const actual = o ? o.amount : computed;
      const engaged = Math.max(0, input.engaged.get(c.id) ?? 0);
      return { categoryId: c.id, label: c.label, source: c.source, planned, computed, override: o ? { amount: o.amount, reason: o.reason } : null, actual, engaged, gap: planned - actual - engaged, pct: planned > 0 ? Math.round(((actual + engaged) / planned) * 100) : null };
    });
  const sum = (k: "planned" | "actual" | "engaged" | "gap") => rows.reduce((s, r) => s + r[k], 0);
  return { rows, unclassified: input.unclassified, totals: { planned: sum("planned"), actual: sum("actual") + input.unclassified, engaged: sum("engaged"), gap: sum("gap") - input.unclassified } };
}

export const overBudget = (rows: PlanRow[]) => rows.filter((r) => r.planned > 0 && r.actual + r.engaged > r.planned);

// Préparer : le droit budget.plan, et l'édition est la sienne (pilote, équipe), de son pôle pour qui le gère, ou partout avec scope.all.
export function canPlanBudget(me: Viewer, ed: { pilotId: string; poleIds: string[]; teamIds: string[] }): boolean {
  if (!has(me, "budget.plan")) return false;
  if (has(me, "scope.all")) return true;
  if (ed.pilotId === me.id || ed.teamIds.includes(me.id)) return true;
  return has(me, "pole.manage") && me.poleId !== null && ed.poleIds.includes(me.poleId);
}

export const canValidateBudget = (me: Actor) => has(me, "budget.validate");

// Valider (ou saisir un réalisé à la main) sur une édition précise : le droit, et l'édition est dans son périmètre
// (tout avec scope.all, sinon son pôle). Le droit seul ne suffit pas : autorisation par ressource.
export function canValidateBudgetOn(me: Viewer, ed: { poleIds: string[] }): boolean {
  if (!canValidateBudget(me)) return false;
  return has(me, "scope.all") || (me.poleId !== null && ed.poleIds.includes(me.poleId));
}

// Le détail Personnel par personne révèle une rémunération : trésorerie ou validation du budget seulement.
export const canSeePersonnelDetail = (me: Actor) => has(me, "treasury.view") || has(me, "budget.validate");

export function nextStatusAfterEdit(current: string, me: Actor): string {
  return current === "validated" && !canValidateBudget(me) ? "submitted" : current;
}
