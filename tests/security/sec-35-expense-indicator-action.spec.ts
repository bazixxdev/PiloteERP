import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { cookieOf, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

// Dépenses et indicateurs rattachés à une action (26/09) : saveField (expense.actionId, indicator.actionId) et addExpense
// n'acceptent qu'une action du projet de l'année, dont la période chevauche l'année. Appelées en direct par la direction —
// qui a le droit d'écrire dépenses et indicateurs — comme le ferait un client falsifié : une action d'un AUTRE projet est
// refusée, une action du projet qui ne court pas l'année aussi ; le rattachement valide passe. Rien du seed ne bouge :
// les lignes (et l'année hors période, si elle manque) sont créées ici et supprimées après.
const actionId = readFileSync("tests/.security-outside-action-id", "utf8").trim();
const prisma = new PrismaClient({ datasources: { db: { url: process.env.SECURITY_DATABASE_URL } } });

async function call(baseURL: string, file: string, name: string, args: unknown[]) {
  const res = await postServerAction(baseURL, serverActionId(file, name), args, cookieOf(SECURITY_ACTORS.director));
  expect(res.status, `${name} : HTTP ${res.status}`).toBe(200);
  return res.text();
}
const saveField = (baseURL: string, model: string, id: string) => call(baseURL, "app/actions/fields.ts", "saveField", [model, id, "actionId", actionId]);

const ids = { own: "", foreign: "", late: "", foreignEdition: "", createdEdition: null as string | null };
const rows: { expense: string; indicator: string }[] = [];

test.afterAll(async () => {
  await prisma.expense.deleteMany({ where: { id: { in: rows.map((r) => r.expense) } } });
  await prisma.indicator.deleteMany({ where: { id: { in: rows.map((r) => r.indicator) } } });
  await prisma.expense.deleteMany({ where: { editionId: ids.foreignEdition, label: "SEC-35 ajout refusé" } });
  if (ids.createdEdition) await prisma.edition.delete({ where: { id: ids.createdEdition } });
  await prisma.$disconnect();
});

test.describe("SEC-35 — dépense et indicateur rattachés à une action", () => {
  let expenses: Record<"own" | "foreign" | "late", string> = { own: "", foreign: "", late: "" };
  let indicators: Record<"own" | "foreign" | "late", string> = { own: "", foreign: "", late: "" };

  test.beforeAll(async () => {
    const a = await prisma.action.findUniqueOrThrow({ where: { id: actionId }, select: { projectId: true, startDate: true, endDate: true } });
    const [from, to] = [a.startDate!.getUTCFullYear(), a.endDate!.getUTCFullYear()];
    const own = await prisma.edition.findFirst({ where: { projectId: a.projectId!, year: { gte: from, lte: to } }, orderBy: { year: "asc" }, select: { id: true } });
    const foreign = await prisma.edition.findFirst({ where: { projectId: { not: a.projectId! }, year: { gte: from, lte: to } }, orderBy: { id: "asc" }, select: { id: true } });
    if (!own || !foreign) throw new Error("Fixture SEC-35 : années introuvables (même projet sur la période, autre projet).");
    // Une année du même projet que la période ne touche pas : celle d'après la fin, créée si elle manque.
    const lateYear = to + 3;
    let late = await prisma.edition.findUnique({ where: { projectId_year: { projectId: a.projectId!, year: lateYear } }, select: { id: true } });
    if (!late) {
      late = await prisma.edition.create({ data: { projectId: a.projectId!, year: lateYear, status: "proposed" }, select: { id: true } });
      ids.createdEdition = late.id;
    }
    Object.assign(ids, { own: own.id, foreign: foreign.id, late: late.id, foreignEdition: foreign.id });
    for (const key of ["own", "foreign", "late"] as const) {
      const editionId = ids[key];
      const x = await prisma.expense.create({ data: { editionId, label: `SEC-35 ${key}`, spent: 10, status: "closed", reference: "SEC-35" }, select: { id: true } });
      const i = await prisma.indicator.create({ data: { editionId, label: `SEC-35 ${key}` }, select: { id: true } });
      rows.push({ expense: x.id, indicator: i.id });
      expenses = { ...expenses, [key]: x.id };
      indicators = { ...indicators, [key]: i.id };
    }
  });

  test("une action d'un autre projet est refusée, pour la dépense comme pour l'indicateur", async ({ baseURL }) => {
    for (const [model, id] of [["expense", expenses.foreign], ["indicator", indicators.foreign]] as const) {
      const body = await saveField(String(baseURL), model, id);
      expect(body, model).toContain('"ok":false');
      expect(body, model).toContain("autre projet");
    }
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenses.foreign } })).actionId).toBeNull();
    expect((await prisma.indicator.findUniqueOrThrow({ where: { id: indicators.foreign } })).actionId).toBeNull();
    // Même règle à la saisie d'une dépense : rien n'est créé.
    const body = await call(String(baseURL), "app/actions/edition.ts", "addExpense", [ids.foreignEdition, "SEC-35 ajout refusé", 10, "SEC-35", actionId]);
    expect(body).toContain('"ok":false');
    expect(await prisma.expense.count({ where: { editionId: ids.foreignEdition, label: "SEC-35 ajout refusé" } })).toBe(0);
  });

  test("une action du projet qui ne court pas l'année est refusée", async ({ baseURL }) => {
    for (const [model, id] of [["expense", expenses.late], ["indicator", indicators.late]] as const) {
      const body = await saveField(String(baseURL), model, id);
      expect(body, model).toContain('"ok":false');
      expect(body, model).toContain("ne court pas");
    }
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenses.late } })).actionId).toBeNull();
    expect((await prisma.indicator.findUniqueOrThrow({ where: { id: indicators.late } })).actionId).toBeNull();
  });

  test("une action du projet qui court l'année est acceptée", async ({ baseURL }) => {
    for (const [model, id] of [["expense", expenses.own], ["indicator", indicators.own]] as const) {
      const body = await saveField(String(baseURL), model, id);
      expect(body, model).toContain('"ok":true');
    }
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenses.own } })).actionId).toBe(actionId);
    expect((await prisma.indicator.findUniqueOrThrow({ where: { id: indicators.own } })).actionId).toBe(actionId);
  });
});
