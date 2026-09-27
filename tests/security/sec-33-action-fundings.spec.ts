import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { cookieOf, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

// Financements de l'action (26/09) : lier une ligne, régler son montant, retirer le lien exigent le droit de modifier l'action.
// Une personne hors du projet (l'action « outside » de SEC-32) est refusée par les trois commandes, appelées en direct comme le
// ferait un client falsifié ; et même la direction, qui a ce droit, ne lie pas une ligne d'un AUTRE projet, ni d'une année que
// la période ne couvre pas. Plus bas, la même base sert de contrôle d'intégration (spec actions § 2) : une ligne ajoutée ensuite
// au dossier (rattachement d'une année, reconduction) rejoint les actions qui courent cette année-là, et elles seules.
const actionId = readFileSync("tests/.security-outside-action-id", "utf8").trim();
const FILE = "app/actions/actions.ts";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.SECURITY_DATABASE_URL } } });

async function call(baseURL: string, name: string, args: unknown[], actor = SECURITY_ACTORS.contributor, file = FILE) {
  const res = await postServerAction(baseURL, serverActionId(file, name), args, cookieOf(actor));
  expect(res.status, `${name} : HTTP ${res.status}`).toBe(200);
  return res.text();
}

test.afterAll(async () => { await prisma.$disconnect(); });

let ownLineId = "";
let foreignLineId = "";

test.describe("SEC-33 — financements de l'action", () => {
  test.beforeAll(async () => {
    const a = await prisma.action.findUniqueOrThrow({ where: { id: actionId }, select: { projectId: true, startDate: true, endDate: true } });
    const [from, to] = [a.startDate!.getUTCFullYear(), a.endDate!.getUTCFullYear()];
    const own = await prisma.fundingLine.findFirst({ where: { edition: { projectId: a.projectId!, year: { gte: from, lte: to } } }, orderBy: { id: "asc" }, select: { id: true } });
    const foreign = await prisma.fundingLine.findFirst({ where: { edition: { projectId: { not: a.projectId! } } }, orderBy: { id: "asc" }, select: { id: true } });
    if (!own || !foreign) throw new Error("Fixture SEC-33 : lignes de financement introuvables (même projet sur la période, autre projet).");
    ownLineId = own.id;
    foreignLineId = foreign.id;
    // Un lien existant, posé par la base : la cible de setFundingAmount et unlinkFunding.
    await prisma.actionFunding.upsert({ where: { actionId_fundingLineId: { actionId, fundingLineId: ownLineId } }, create: { actionId, fundingLineId: ownLineId, amount: 100 }, update: { amount: 100 } });
  });

  test.afterAll(async () => {
    await prisma.actionFunding.deleteMany({ where: { actionId } });
  });

  test("une personne hors du projet ne lie pas de ligne, ne règle pas de montant, ne retire pas de lien", async ({ baseURL }) => {
    const url = String(baseURL);
    const attempts: [string, unknown[]][] = [
      ["linkFunding", [actionId, ownLineId, 5_000]],
      ["setFundingAmount", [actionId, ownLineId, 999_999]],
      ["unlinkFunding", [actionId, ownLineId]],
    ];
    for (const [name, args] of attempts) {
      const body = await call(url, name, args);
      expect(body, name).toContain('"ok":false');
      expect(body, name).toMatch(/Vous ne pouvez pas/);
    }
    const links = await prisma.actionFunding.findMany({ where: { actionId } });
    expect(links.map((l) => [l.fundingLineId, l.amount])).toEqual([[ownLineId, 100]]);
  });

  test("la direction, qui modifie l'action, ne lie pas une ligne d'un autre projet", async ({ baseURL }) => {
    const body = await call(String(baseURL), "linkFunding", [actionId, foreignLineId, null], SECURITY_ACTORS.director);
    expect(body).toContain('"ok":false');
    expect(body).toContain("introuvable sur ce projet");
    expect(await prisma.actionFunding.count({ where: { actionId, fundingLineId: foreignLineId } })).toBe(0);
  });

  test("témoin : la direction règle le montant d'un lien de l'action (la commande est servie, la garde passe)", async ({ baseURL }) => {
    const body = await call(String(baseURL), "setFundingAmount", [actionId, ownLineId, 250], SECURITY_ACTORS.director);
    expect(body).toContain('"ok":true');
    expect((await prisma.actionFunding.findUniqueOrThrow({ where: { actionId_fundingLineId: { actionId, fundingLineId: ownLineId } } })).amount).toBe(250);
  });
});

// Données propres au test (base de sécurité jetable) : un projet 2026–2027, un dossier 2026–2028 et sa ligne 2026 ; une action
// A sur 2026–2027 et une action B sur 2026 seulement, toutes deux financées par la ligne 2026.
test.describe.serial("SEC-33 — lignes ajoutées ensuite au dossier", () => {
  const Y = 2026;
  const ids = { project: "", e1: "", e2: "", conv: "", line1: "", a: "", b: "" };
  const link = (actionId: string, fundingLineId: string) => prisma.actionFunding.findUnique({ where: { actionId_fundingLineId: { actionId, fundingLineId } } });
  const lineOf = async (editionId: string) => (await prisma.fundingLine.findFirstOrThrow({ where: { editionId, conventionId: ids.conv }, select: { id: true } })).id;

  test.beforeAll(async () => {
    const base = await prisma.project.findFirstOrThrow({ orderBy: { id: "asc" }, select: { poleId: true, pilotId: true, missionId: true } });
    const funder = await prisma.fundingLine.findFirstOrThrow({ orderBy: { id: "asc" }, select: { funderId: true } });
    const p = await prisma.project.create({ data: { ...base, name: "SEC33 projet du dossier pluriannuel", analyticCode: "SEC33-PRO" } });
    const e1 = await prisma.edition.create({ data: { projectId: p.id, year: Y, status: "in_progress" } });
    const e2 = await prisma.edition.create({ data: { projectId: p.id, year: Y + 1, status: "proposed" } });
    const conv = await prisma.convention.create({ data: { funderId: funder.funderId, reference: "SEC33-DOSSIER-2026-2028", startYear: Y, endYear: Y + 2, status: "contracted", amountNotified: 30_000 } });
    const line1 = await prisma.fundingLine.create({ data: { editionId: e1.id, funderId: funder.funderId, conventionId: conv.id, status: "contracted", amountGranted: 10_000 } });
    const period = (to: number) => ({ startDate: new Date(Date.UTC(Y, 0, 1)), endDate: new Date(Date.UTC(to, 11, 31)) });
    const a = await prisma.action.create({ data: { editionId: e1.id, projectId: p.id, name: "SEC33 action sur deux années", ownerId: base.pilotId, ...period(Y + 1) } });
    const b = await prisma.action.create({ data: { editionId: e1.id, projectId: p.id, name: "SEC33 action d'une année", ownerId: base.pilotId, ...period(Y) } });
    Object.assign(ids, { project: p.id, e1: e1.id, e2: e2.id, conv: conv.id, line1: line1.id, a: a.id, b: b.id });
  });

  test.afterAll(async () => {
    await prisma.action.deleteMany({ where: { projectId: ids.project } });
    await prisma.changeLog.deleteMany({ where: { edition: { projectId: ids.project } } });
    await prisma.edition.deleteMany({ where: { projectId: ids.project } });
    await prisma.convention.deleteMany({ where: { id: ids.conv } });
    await prisma.project.deleteMany({ where: { id: ids.project } });
  });

  test("lier : la ligne 2026 avec son montant ; un nouveau lien sans montant n'efface pas celui posé", async ({ baseURL }) => {
    const url = String(baseURL);
    for (const [id, amount] of [[ids.a, 4_000], [ids.b, 1_000]] as const) {
      const body = await call(url, "linkFunding", [id, ids.line1, amount], SECURITY_ACTORS.director);
      expect(body).toContain('"ok":true');
      expect(body).toContain('"linked":1');
    }
    expect(await call(url, "linkFunding", [ids.a, ids.line1, null], SECURITY_ACTORS.director)).toContain('"ok":true');
    expect((await link(ids.a, ids.line1))?.amount).toBe(4_000);
  });

  test("rattacher l'année 2027 au dossier : sa nouvelle ligne rejoint l'action qui court en 2027, sans montant, pas l'autre", async ({ baseURL }) => {
    const body = await call(String(baseURL), "addFundingLineFromConvention", [ids.e2, ids.conv], SECURITY_ACTORS.director, "app/actions/edition.ts");
    expect(body).toContain('"ok":true');
    const line2 = await lineOf(ids.e2);
    const l = await link(ids.a, line2);
    expect(l).not.toBeNull();
    expect(l!.amount).toBeNull();
    expect(await link(ids.b, line2)).toBeNull();
    expect((await link(ids.a, ids.line1))?.amount).toBe(4_000);
  });

  test("une ligne du même projet sur une année que la période ne couvre pas est refusée", async ({ baseURL }) => {
    const line2 = await lineOf(ids.e2);
    const body = await call(String(baseURL), "linkFunding", [ids.b, line2, 500], SECURITY_ACTORS.director);
    expect(body).toContain('"ok":false');
    expect(body).toContain("ne couvre pas");
    expect(await link(ids.b, line2)).toBeNull();
    expect(await prisma.actionFunding.count({ where: { actionId: ids.b } })).toBe(1);
  });

  test("reconduire 2027 : la ligne gardée sur le dossier en 2028 rejoint l'action qui court en 2028", async ({ baseURL }) => {
    await prisma.action.update({ where: { id: ids.a }, data: { endDate: new Date(Date.UTC(Y + 2, 11, 31)) } });
    const body = await call(String(baseURL), "renewEdition", [ids.e2], SECURITY_ACTORS.director, "app/actions/edition.ts");
    expect(body).toContain('"ok":true');
    const e3 = await prisma.edition.findUniqueOrThrow({ where: { projectId_year: { projectId: ids.project, year: Y + 2 } }, select: { id: true } });
    const line3 = await lineOf(e3.id);
    const l3 = await link(ids.a, line3);
    expect(l3).not.toBeNull();
    expect(l3!.amount).toBeNull();
    expect(await link(ids.b, line3)).toBeNull();
  });
});

// I1 (revue finale) : rattacher une ligne à un dossier par saveField (sélecteur « convention » de components/funding/line-panel.tsx)
// est un second chemin vers la même mutation qu'addFundingLineFromConvention ; il doit obéir au même invariant (spec actions § 2)
// et lier la ligne rattachée aux actions du projet déjà financées par ce dossier qui courent l'année de cette ligne.
test.describe.serial("SEC-33 — rattacher par saveField propage aussi aux actions (I1)", () => {
  const Y = 2026;
  const ids = { project: "", e1: "", e2: "", conv: "", line1: "", line2: "", a: "" };
  const link = (actionId: string, fundingLineId: string) => prisma.actionFunding.findUnique({ where: { actionId_fundingLineId: { actionId, fundingLineId } } });

  test.beforeAll(async () => {
    const base = await prisma.project.findFirstOrThrow({ orderBy: { id: "asc" }, select: { poleId: true, pilotId: true, missionId: true } });
    const funder = await prisma.fundingLine.findFirstOrThrow({ orderBy: { id: "asc" }, select: { funderId: true } });
    const p = await prisma.project.create({ data: { ...base, name: "SEC33 projet rattachement saveField", analyticCode: "SEC33-SAVEFIELD" } });
    const e1 = await prisma.edition.create({ data: { projectId: p.id, year: Y, status: "in_progress" } });
    const e2 = await prisma.edition.create({ data: { projectId: p.id, year: Y + 1, status: "proposed" } });
    const conv = await prisma.convention.create({ data: { funderId: funder.funderId, reference: "SEC33-SAVEFIELD-2026-2027", startYear: Y, endYear: Y + 1, status: "contracted", amountNotified: 20_000 } });
    const line1 = await prisma.fundingLine.create({ data: { editionId: e1.id, funderId: funder.funderId, conventionId: conv.id, status: "contracted", amountGranted: 8_000 } });
    // La ligne 2027, pas encore rattachée au dossier — celle que le sélecteur « convention » du line-panel rattache par saveField.
    const line2 = await prisma.fundingLine.create({ data: { editionId: e2.id, funderId: funder.funderId, status: "notified" } });
    const a = await prisma.action.create({ data: { editionId: e1.id, projectId: p.id, name: "SEC33 action sur deux années (saveField)", ownerId: base.pilotId, startDate: new Date(Date.UTC(Y, 0, 1)), endDate: new Date(Date.UTC(Y + 1, 11, 31)) } });
    await prisma.actionFunding.create({ data: { actionId: a.id, fundingLineId: line1.id, amount: 4_000 } });
    Object.assign(ids, { project: p.id, e1: e1.id, e2: e2.id, conv: conv.id, line1: line1.id, line2: line2.id, a: a.id });
  });

  test.afterAll(async () => {
    await prisma.action.deleteMany({ where: { projectId: ids.project } });
    await prisma.changeLog.deleteMany({ where: { edition: { projectId: ids.project } } });
    await prisma.edition.deleteMany({ where: { projectId: ids.project } });
    await prisma.convention.deleteMany({ where: { id: ids.conv } });
    await prisma.project.deleteMany({ where: { id: ids.project } });
  });

  test("rattacher la ligne 2027 au dossier par saveField lie aussi l'action déjà financée par ce dossier qui court en 2027", async ({ baseURL }) => {
    expect(await link(ids.a, ids.line2)).toBeNull();
    const body = await call(String(baseURL), "saveField", ["fundingLine", ids.line2, "conventionId", ids.conv], SECURITY_ACTORS.director, "app/actions/fields.ts");
    expect(body).toContain('"ok":true');
    const l2 = await link(ids.a, ids.line2);
    expect(l2).not.toBeNull();
    expect(l2!.amount).toBeNull();
    // La ligne d'origine garde son montant : le rattachement n'écrase rien.
    expect((await prisma.fundingLine.findUniqueOrThrow({ where: { id: ids.line1 } })).amountGranted).toBe(8_000);
  });
});
