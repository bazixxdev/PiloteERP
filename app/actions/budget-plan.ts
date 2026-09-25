"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin, canTrackExpenses, canWriteLayer } from "@/lib/rights";
import { projectPoleIds } from "@/lib/scope";
import { canPlanBudget, canValidateBudgetOn, nextStatusAfterEdit } from "@/lib/budget-plan";
import { reportInternalError } from "@/lib/errors";
import { fmtEuro } from "@/lib/format";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
type Me = Awaited<ReturnType<typeof getCurrentPerson>>;

const DENIED = "Vous ne préparez pas le budget de ce projet.";
const validAmount = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

async function editionFor(editionId: string) {
  return prisma.edition.findUnique({ where: { id: editionId }, select: { id: true, budgetPlanStatus: true, project: { select: { pilotId: true, poleId: true, secondaryPoles: { select: { poleId: true } } } }, team: { select: { personId: true } } } });
}
type Ed = NonNullable<Awaited<ReturnType<typeof editionFor>>>;
const validateAllowed = (me: Me, ed: Ed) => canValidateBudgetOn(me, { poleIds: projectPoleIds(ed.project) });
const planAllowed = (me: Me, ed: Ed) => canPlanBudget(me, { pilotId: ed.project.pilotId, poleIds: projectPoleIds(ed.project), teamIds: ed.team.map((t) => t.personId) });

async function activeCategory(id: string) {
  const c = await prisma.budgetCategory.findUnique({ where: { id } });
  return c && c.active ? c : null;
}

// Trace d'une écriture du budget, dans la même transaction que l'écriture (historique de la fiche).
const trace = (editionId: string, field: string, before: string | null, after: string | null, authorId: string) =>
  prisma.changeLog.create({ data: { editionId, field, before, after, authorId } });

// Après une modification du prévu : un budget validé repasse « à valider », sauf pour qui valide.
function statusAfter(ed: Ed, me: Me) {
  const next = nextStatusAfterEdit(ed.budgetPlanStatus, me);
  return next === ed.budgetPlanStatus ? [] : [prisma.edition.update({ where: { id: ed.id }, data: { budgetPlanStatus: next } }), trace(ed.id, "budget:statut", ed.budgetPlanStatus, next, me.id)];
}

export async function addBudgetLine(editionId: string, input: { categoryId: string; label?: string | null; amount: number; note?: string | null }): Promise<Result<{ id: string }>> {
  try {
    const me = await getCurrentPerson();
    const ed = await editionFor(editionId);
    if (!ed) return { ok: false, error: "Projet introuvable." };
    if (!planAllowed(me, ed)) return { ok: false, error: DENIED };
    if (!validAmount(input.amount)) return { ok: false, error: "Le montant doit être un nombre positif ou nul." };
    const cat = await activeCategory(input.categoryId);
    if (!cat) return { ok: false, error: "Catégorie inconnue ou désactivée." };
    const [line] = await prisma.$transaction([
      prisma.budgetLine.create({ data: { editionId, categoryId: cat.id, label: input.label?.trim() || null, amount: input.amount, note: input.note?.trim() || null } }),
      trace(editionId, `budget:${cat.label}`, null, fmtEuro(input.amount), me.id),
      ...statusAfter(ed, me),
    ]);
    revalidatePath(`/edition/${editionId}`);
    return { ok: true, data: { id: line.id } };
  } catch (e) {
    return { ok: false, ...reportInternalError("addBudgetLine", e) };
  }
}

export async function updateBudgetLine(id: string, input: { categoryId?: string; label?: string | null; amount?: number; note?: string | null }): Promise<Result> {
  try {
    const me = await getCurrentPerson();
    const line = await prisma.budgetLine.findUnique({ where: { id }, include: { category: true } });
    if (!line) return { ok: false, error: "Ligne introuvable." };
    const ed = await editionFor(line.editionId);
    if (!ed || !planAllowed(me, ed)) return { ok: false, error: DENIED };
    if (input.amount !== undefined && !validAmount(input.amount)) return { ok: false, error: "Le montant doit être un nombre positif ou nul." };
    const cat = input.categoryId ? await activeCategory(input.categoryId) : line.category;
    if (!cat) return { ok: false, error: "Catégorie inconnue ou désactivée." };
    const amount = input.amount ?? line.amount;
    await prisma.$transaction([
      prisma.budgetLine.update({ where: { id }, data: { categoryId: cat.id, label: input.label === undefined ? line.label : input.label?.trim() || null, amount, note: input.note === undefined ? line.note : input.note?.trim() || null } }),
      trace(line.editionId, `budget:${cat.label}${line.label ? ` · ${line.label}` : ""}`, `${line.category.label} ${fmtEuro(line.amount)}`, `${cat.label} ${fmtEuro(amount)}`, me.id),
      ...statusAfter(ed, me),
    ]);
    revalidatePath(`/edition/${line.editionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, ...reportInternalError("updateBudgetLine", e) };
  }
}

export async function deleteBudgetLine(id: string): Promise<Result> {
  try {
    const me = await getCurrentPerson();
    const line = await prisma.budgetLine.findUnique({ where: { id }, include: { category: true } });
    if (!line) return { ok: false, error: "Ligne introuvable." };
    const ed = await editionFor(line.editionId);
    if (!ed || !planAllowed(me, ed)) return { ok: false, error: DENIED };
    await prisma.$transaction([
      prisma.budgetLine.delete({ where: { id } }),
      trace(line.editionId, `budget:${line.category.label}${line.label ? ` · ${line.label}` : ""}`, fmtEuro(line.amount), null, me.id),
      ...statusAfter(ed, me),
    ]);
    revalidatePath(`/edition/${line.editionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, ...reportInternalError("deleteBudgetLine", e) };
  }
}

export async function submitBudgetPlan(editionId: string): Promise<Result> {
  const me = await getCurrentPerson();
  const ed = await editionFor(editionId);
  if (!ed || !planAllowed(me, ed)) return { ok: false, error: DENIED };
  if (ed.budgetPlanStatus !== "draft") return { ok: false, error: "Le budget est déjà soumis ou validé." };
  if ((await prisma.budgetLine.count({ where: { editionId } })) === 0) return { ok: false, error: "Ajoutez au moins une ligne avant de soumettre." };
  await prisma.$transaction([prisma.edition.update({ where: { id: editionId }, data: { budgetPlanStatus: "submitted" } }), trace(editionId, "budget:statut", "draft", "submitted", me.id)]);
  revalidatePath(`/edition/${editionId}`);
  return { ok: true };
}

export async function validateBudgetPlan(editionId: string): Promise<Result> {
  const me = await getCurrentPerson();
  const ed = await editionFor(editionId);
  if (!ed || !validateAllowed(me, ed)) return { ok: false, error: "Vous ne validez pas le budget de ce projet." };
  if ((await prisma.budgetLine.count({ where: { editionId } })) === 0) return { ok: false, error: "Le budget est vide." };
  // Claim atomique (SEC-29) : deux validations simultanées n'en font qu'une.
  const claimed = await prisma.$transaction(async (tx) => {
    const r = await tx.edition.updateMany({ where: { id: editionId, budgetPlanStatus: { not: "validated" } }, data: { budgetPlanStatus: "validated", budgetPlanValidatedAt: new Date(), budgetPlanValidatedById: me.id } });
    if (r.count === 1) await tx.changeLog.create({ data: { editionId, field: "budget:statut", before: null, after: "validated", authorId: me.id } });
    return r.count === 1;
  });
  if (!claimed) return { ok: false, error: "Ce budget est déjà validé." };
  revalidatePath(`/edition/${editionId}`);
  return { ok: true };
}

export async function setActualOverride(editionId: string, categoryId: string, amount: number, reason: string): Promise<Result> {
  const me = await getCurrentPerson();
  const ed = await editionFor(editionId);
  if (!ed || !validateAllowed(me, ed)) return { ok: false, error: "Seul qui valide le budget de ce projet saisit un réalisé à la main." };
  if (!validAmount(amount)) return { ok: false, error: "Le montant doit être un nombre positif ou nul." };
  if (!reason.trim()) return { ok: false, error: "Indiquez le motif de la saisie manuelle." };
  const cat = await prisma.budgetCategory.findUnique({ where: { id: categoryId } });
  if (!cat) return { ok: false, error: "Catégorie introuvable." };
  const before = await prisma.budgetActualOverride.findUnique({ where: { editionId_categoryId: { editionId, categoryId } } });
  await prisma.$transaction([
    prisma.budgetActualOverride.upsert({ where: { editionId_categoryId: { editionId, categoryId } }, create: { editionId, categoryId, amount, reason: reason.trim(), authorId: me.id }, update: { amount, reason: reason.trim(), authorId: me.id } }),
    trace(editionId, `budget:surcharge:${cat.label}`, before ? fmtEuro(before.amount) : null, `${fmtEuro(amount)} — ${reason.trim()}`.slice(0, 500), me.id),
  ]);
  revalidatePath(`/edition/${editionId}`);
  return { ok: true };
}

export async function clearActualOverride(editionId: string, categoryId: string): Promise<Result> {
  const me = await getCurrentPerson();
  const ed = await editionFor(editionId);
  if (!ed || !validateAllowed(me, ed)) return { ok: false, error: "Seul qui valide le budget de ce projet retire une saisie manuelle." };
  const o = await prisma.budgetActualOverride.findUnique({ where: { editionId_categoryId: { editionId, categoryId } }, include: { category: true } });
  if (!o) return { ok: true };
  await prisma.$transaction([prisma.budgetActualOverride.delete({ where: { id: o.id } }), trace(editionId, `budget:surcharge:${o.category.label}`, fmtEuro(o.amount), null, me.id)]);
  revalidatePath(`/edition/${editionId}`);
  return { ok: true };
}

export async function setExpenseCategory(expenseId: string, categoryId: string | null): Promise<Result> {
  const me = await getCurrentPerson();
  const x = await prisma.expense.findUnique({ where: { id: expenseId }, select: { id: true, editionId: true } });
  if (!x) return { ok: false, error: "Dépense introuvable." };
  if (!canTrackExpenses(me) && !canWriteLayer(me, "budget", false, false)) return { ok: false, error: "Vous ne suivez pas les dépenses." };
  if (categoryId && !(await activeCategory(categoryId))) return { ok: false, error: "Catégorie inconnue ou désactivée." };
  await prisma.expense.update({ where: { id: expenseId }, data: { budgetCategoryId: categoryId } });
  revalidatePath(`/edition/${x.editionId}`);
  return { ok: true };
}

export async function saveBudgetCategory(input: { id?: string; label: string; accountPrefixes: string; source: string; order: number; active: boolean }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration." };
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Le libellé est obligatoire." };
  if (!["time", "ledger", "none"].includes(input.source)) return { ok: false, error: "Source inconnue." };
  const accountPrefixes = input.accountPrefixes.split(",").map((p) => p.trim()).filter(Boolean);
  if (accountPrefixes.some((p) => !/^[0-9]{1,8}$/.test(p))) return { ok: false, error: "Les préfixes sont des numéros de compte (chiffres), séparés par des virgules." };
  const data = { label, accountPrefixes: accountPrefixes.join(","), source: input.source, order: Math.round(input.order) || 0, active: input.active };
  const c = input.id ? await prisma.budgetCategory.update({ where: { id: input.id }, data }) : await prisma.budgetCategory.create({ data });
  revalidatePath("/admin");
  return { ok: true, data: { id: c.id } };
}
