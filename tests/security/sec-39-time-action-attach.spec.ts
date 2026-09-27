import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { dayjs } from "../../lib/format";
import { cookieOf, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

// I3 (revue finale du 26/09) : la saisie du temps sur une action passe désormais par la même garde que les autres
// rattachements (attachRefusal, lib/actions.ts) — l'action doit être du projet déclaré et courir sur l'année de la date.
// Avant ce correctif, saveTime, copyPreviousWeek et saveWeekSplit acceptaient n'importe quel actionId : ni la cohérence
// projectId/actionId, ni la période, n'étaient vérifiées, alors que les heures par action alimentent l'équilibre de
// l'action et l'export « temps par action financée » remis aux financeurs. L'action « outside » de SEC-32 sert de cible :
// elle appartient à un projet que l'acteur du test (la direction) ne pilote pas et n'a pas besoin de piloter, seule sa
// période et son projet réel comptent ici.
const actionId = readFileSync("tests/.security-outside-action-id", "utf8").trim();
const FILE = "app/actions/time.ts";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.SECURITY_DATABASE_URL } } });
const actor = SECURITY_ACTORS.director;

async function call(baseURL: string, name: string, args: unknown[]) {
  const res = await postServerAction(baseURL, serverActionId(FILE, name), args, cookieOf(actor));
  expect(res.status, `${name} : HTTP ${res.status}`).toBe(200);
  return res.text();
}

test.describe("SEC-39 — la saisie du temps n'accepte pas n'importe quel actionId", () => {
  let personId: string;
  let action: { id: string; projectId: string; year: number };
  let otherProjectId: string;

  test.beforeAll(async () => {
    const p = await prisma.person.findUniqueOrThrow({ where: { email: actor.email }, select: { id: true } });
    personId = p.id;
    const a = await prisma.action.findUniqueOrThrow({ where: { id: actionId }, select: { projectId: true, startDate: true, endDate: true } });
    if (!a.projectId || !a.startDate || !a.endDate) throw new Error("Fixture SEC-39 : action sans projet ni période.");
    action = { id: actionId, projectId: a.projectId, year: a.startDate.getUTCFullYear() };
    const other = await prisma.project.findFirstOrThrow({ where: { id: { not: action.projectId } }, select: { id: true } });
    otherProjectId = other.id;
  });

  test.afterEach(async () => {
    await prisma.timeEntry.deleteMany({ where: { personId, comment: "SEC39" } });
  });

  test.afterAll(async () => { await prisma.$disconnect(); });

  test("saveTime refuse une action qui n'est pas du projet déclaré", async ({ baseURL }) => {
    const date = `${action.year}-03-10`;
    const body = await call(String(baseURL), "saveTime", [{ date, hours: 1, comment: "SEC39", projectId: otherProjectId, actionId: action.id }]);
    expect(body).toContain('"ok":false');
    expect(body).toContain("autre projet");
    expect(await prisma.timeEntry.count({ where: { personId, actionId: action.id } })).toBe(0);
  });

  test("saveTime refuse une action dont la période ne couvre pas l'année de la date", async ({ baseURL }) => {
    const date = `${action.year + 50}-03-10`;
    const body = await call(String(baseURL), "saveTime", [{ date, hours: 1, comment: "SEC39", projectId: action.projectId, actionId: action.id }]);
    expect(body).toContain('"ok":false');
    expect(body).toContain("ne court pas");
    expect(await prisma.timeEntry.count({ where: { personId, actionId: action.id } })).toBe(0);
  });

  test("saveWeekSplit refuse une part rattachée à une action d'un autre projet, avant toute écriture", async ({ baseURL }) => {
    const monday = dayjs().startOf("isoWeek").format("YYYY-MM-DD");
    const before = await prisma.timeEntry.count({ where: { personId } });
    const body = await call(String(baseURL), "saveWeekSplit", [monday, [{ projectId: otherProjectId, actionId: action.id, timeCodeId: null, percent: 100 }]]);
    expect(body).toContain('"ok":false');
    expect(body).toContain("autre projet");
    expect(await prisma.timeEntry.count({ where: { personId } })).toBe(before);
  });

  test("témoin : saveTime accepte l'action du bon projet, sur une année qu'elle couvre", async ({ baseURL }) => {
    const date = `${action.year}-03-10`;
    const body = await call(String(baseURL), "saveTime", [{ date, hours: 1, comment: "SEC39", projectId: action.projectId, actionId: action.id }]);
    expect(body).toContain('"ok":true');
    expect(await prisma.timeEntry.count({ where: { personId, actionId: action.id, comment: "SEC39" } })).toBe(1);
  });

  test("copyPreviousWeek ignore (sans bloquer le reste) une saisie déjà posée sur une action qui n'est pas de son projet", async ({ baseURL }) => {
    // Une entrée déjà en base avec un projectId falsifié (comme le laisserait un ancien client, avant ce correctif) :
    // sa copie une semaine plus tard ne doit pas la reconduire.
    const thisMonday = dayjs().startOf("isoWeek");
    const prevMonday = thisMonday.subtract(1, "week");
    await prisma.timeEntry.create({ data: { personId, date: prevMonday.toDate(), projectId: otherProjectId, actionId: action.id, hours: 2, comment: "SEC39" } });
    const before = await prisma.timeEntry.count({ where: { personId, actionId: action.id, projectId: otherProjectId } });
    const body = await call(String(baseURL), "copyPreviousWeek", [thisMonday.format("YYYY-MM-DD")]);
    expect(body).toContain('"ok":true');
    expect(await prisma.timeEntry.count({ where: { personId, actionId: action.id, projectId: otherProjectId } })).toBe(before);
  });
});

// Correctif re-revue (I3) : saveWeekSplit appelait la garde pour CHAQUE part reçue, y compris une part à 0 % (le dialogue
// envoie systématiquement toutes les lignes de la grille, cf. app/temps/split.tsx) et sans tolérer une action déjà saisie
// cette semaine mais qui ne qualifie plus (abandonnée, période raccourcie) — contrairement à saveTime (`current`). Une action
// abandonnée avec des heures déjà posées cette semaine devenait donc impossible à mettre à 0 % : toute la répartition était
// refusée. Scénario dédié (projet et action créés ici, jamais le seed) pour ne pas dépendre d'une action « abandonnée » du
// jeu de démo.
test.describe.serial("SEC-39 — saveWeekSplit tolère une part à 0 % déjà saisie sur une action qui ne qualifie plus", () => {
  const ids = { project: "", action: "" };
  let personId: string;
  let thisMonday: ReturnType<typeof dayjs>;

  test.beforeAll(async () => {
    const p = await prisma.person.findUniqueOrThrow({ where: { email: actor.email }, select: { id: true } });
    personId = p.id;
    const base = await prisma.project.findFirstOrThrow({ orderBy: { id: "asc" }, select: { poleId: true, pilotId: true, missionId: true } });
    const proj = await prisma.project.create({ data: { ...base, name: "SEC39 projet action abandonnée", analyticCode: "SEC39-ABANDON" } });
    const year = dayjs().year();
    const ed = await prisma.edition.create({ data: { projectId: proj.id, year, status: "in_progress" } });
    const abandoned = await prisma.action.create({ data: {
      editionId: ed.id, projectId: proj.id, name: "SEC39 action abandonnée", ownerId: base.pilotId, state: "abandoned",
      startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31)),
    } });
    Object.assign(ids, { project: proj.id, action: abandoned.id });
    thisMonday = dayjs().startOf("isoWeek");
    // Des heures déjà posées cette semaine, sur l'action qui vient d'être abandonnée entre-temps.
    await prisma.timeEntry.create({ data: { personId, date: thisMonday.toDate(), projectId: proj.id, actionId: abandoned.id, hours: 3 } });
  });

  test.afterAll(async () => {
    await prisma.timeEntry.deleteMany({ where: { personId, date: { gte: thisMonday.toDate(), lt: thisMonday.add(1, "week").toDate() } } });
    await prisma.action.deleteMany({ where: { projectId: ids.project } });
    await prisma.edition.deleteMany({ where: { projectId: ids.project } });
    await prisma.project.deleteMany({ where: { id: ids.project } });
    await prisma.$disconnect();
  });

  test("une part à 0 % sur l'action abandonnée qui a déjà des heures cette semaine s'enregistre (les heures sont supprimées, pas refusées)", async ({ baseURL }) => {
    const before = await prisma.timeEntry.count({ where: { personId, actionId: ids.action } });
    expect(before).toBe(1);
    const body = await call(String(baseURL), "saveWeekSplit", [thisMonday.format("YYYY-MM-DD"), [
      { projectId: ids.project, actionId: ids.action, timeCodeId: null, percent: 0 },
      { projectId: null, actionId: null, timeCodeId: null, percent: 100 },
    ]]);
    expect(body).toContain('"ok":true');
    expect(await prisma.timeEntry.count({ where: { personId, actionId: ids.action } })).toBe(0);
  });

  test("une part non nulle sur cette même action, une fois sans heures déjà posées cette semaine, reste refusée : rien n'est écrit", async ({ baseURL }) => {
    const before = await prisma.timeEntry.findMany({ where: { personId, date: { gte: thisMonday.toDate(), lt: thisMonday.add(1, "week").toDate() } }, select: { id: true } });
    const body = await call(String(baseURL), "saveWeekSplit", [thisMonday.format("YYYY-MM-DD"), [{ projectId: ids.project, actionId: ids.action, timeCodeId: null, percent: 100 }]]);
    expect(body).toContain('"ok":false');
    expect(body).toContain("abandonn");
    const after = await prisma.timeEntry.findMany({ where: { personId, date: { gte: thisMonday.toDate(), lt: thisMonday.add(1, "week").toDate() } }, select: { id: true } });
    expect(after.map((e) => e.id).sort()).toEqual(before.map((e) => e.id).sort());
  });
});
