import { prisma } from "./db";
import { dayjs } from "./format";
import { realizedForEdition } from "./ledger-db";
import { expectedDaysOfMonth, loadRhythms, type PersonRhythms } from "./time";
import { budgetTable, canSeePersonnelDetail, ledgerByCategory, monthlyCost, personnelActual, type Category } from "./budget-plan";
import type { Actor } from "./rights";

export async function loadCategories(): Promise<Category[]> {
  const rows = await prisma.budgetCategory.findMany({ orderBy: { order: "asc" } });
  return rows.map((c) => ({ ...c, source: (["time", "ledger", "none"].includes(c.source) ? c.source : "ledger") as Category["source"] }));
}

// Tout ce qu'il faut pour le tableau d'une édition. Le détail Personnel par personne (heures × coût = salaire) n'est
// renvoyé qu'à qui a le droit de le voir : le filtre est ici, avant toute sérialisation vers le navigateur.
export async function loadBudgetPlan(edition: { id: string; year: number; projectId: string }, me: Actor) {
  const [ed, categories, lines, overrides, expenses, settings, rules, rhythms, entries] = await Promise.all([
    prisma.edition.findUnique({ where: { id: edition.id }, select: { budgetPlanStatus: true, budgetPlanValidatedAt: true, budgetPlanValidatedById: true } }),
    loadCategories(),
    prisma.budgetLine.findMany({ where: { editionId: edition.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.budgetActualOverride.findMany({ where: { editionId: edition.id } }),
    prisma.expense.findMany({ where: { editionId: edition.id }, select: { budgetCategoryId: true, committed: true, spent: true, status: true } }),
    prisma.settings.findUnique({ where: { id: 1 }, select: { realizedSource: true } }),
    prisma.cashRule.findMany({ where: { kind: "hr" } }),
    loadRhythms(),
    prisma.timeEntry.findMany({ where: { projectId: edition.projectId, date: { gte: new Date(`${edition.year}-01-01`), lt: new Date(`${edition.year + 1}-01-01`) } }, select: { personId: true, date: true, hours: true } }),
  ]);

  // Réalisé hors Personnel : grand livre si c'est la source réglée, sinon les dépenses rangées dans une catégorie (jamais les deux).
  let computed = new Map<string, number>();
  let unclassified = 0;
  if (settings?.realizedSource === "ledger") {
    const { realized } = await realizedForEdition(edition);
    const r = ledgerByCategory(realized.byAccount.map((a) => ({ accountNumber: a.accountNumber, amount: a.amount })), categories);
    computed = r.byCategory;
    unclassified = r.unclassified;
  } else {
    for (const x of expenses) if (x.budgetCategoryId) computed.set(x.budgetCategoryId, (computed.get(x.budgetCategoryId) ?? 0) + x.spent);
  }

  // Personnel : temps × coût horaire du mois (coût mensuel chargé ÷ heures attendues du mois selon le rythme).
  const people = await prisma.person.findMany({ where: { id: { in: [...new Set(entries.map((e) => e.personId))] } }, select: { id: true, name: true, workRhythm: true, rhythmPeriods: { include: { rhythm: true } } } });
  const personOf = new Map(people.map((p) => [p.id, p]));
  const hourly = new Map<string, number | null>();
  const costOf = (personId: string, month: string) => {
    const key = `${personId}:${month}`;
    if (hourly.has(key)) return hourly.get(key)!;
    const monthly = monthlyCost(personId, month, rules);
    const p = personOf.get(personId);
    const hours = p ? expectedDaysOfMonth(p as PersonRhythms, month, rhythms, dayjs(`${month}-01`).endOf("month")).hours : 0;
    const v = monthly !== null && hours > 0 ? monthly / hours : null;
    hourly.set(key, v);
    return v;
  };
  const personnel = personnelActual(entries.map((e) => ({ personId: e.personId, month: dayjs(e.date).format("YYYY-MM"), hours: e.hours })), costOf);
  for (const c of categories) if (c.source === "time") computed.set(c.id, (computed.get(c.id) ?? 0) + personnel.amount);

  const engaged = new Map<string, number>();
  for (const x of expenses) if (x.budgetCategoryId && x.status === "open") engaged.set(x.budgetCategoryId, (engaged.get(x.budgetCategoryId) ?? 0) + Math.max(0, x.committed - x.spent));

  const table = budgetTable({ categories, lines, computed, overrides, engaged, unclassified });
  const detailed = canSeePersonnelDetail(me);
  const validator = ed?.budgetPlanValidatedById ? await prisma.person.findUnique({ where: { id: ed.budgetPlanValidatedById }, select: { name: true } }) : null;
  return {
    status: ed?.budgetPlanStatus ?? "draft",
    validatedAt: ed?.budgetPlanValidatedAt ?? null,
    validatedBy: validator?.name ?? null,
    categories,
    lines: lines.map((l) => ({ id: l.id, categoryId: l.categoryId, label: l.label, amount: l.amount, note: l.note })),
    table,
    personnel: {
      hours: personnel.hours,
      unvaluedHours: personnel.unvalued.reduce((s, u) => s + u.hours, 0),
      detail: detailed ? personnel.byPerson.map((p) => ({ name: personOf.get(p.personId)?.name ?? "—", hours: p.hours, amount: p.amount })) : null,
      unvaluedPeople: detailed ? personnel.unvalued.map((u) => personOf.get(u.personId)?.name ?? "—") : null,
    },
  };
}

export type BudgetPlanView = Awaited<ReturnType<typeof loadBudgetPlan>>;
