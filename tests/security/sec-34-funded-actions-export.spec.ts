import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { contextFor, SECURITY_ACTORS, INVALID_COOKIE } from "./fixtures";

// Export des actions financées et de leur temps (26/09) : la garde de « Qui finance quoi » (exportDenial, codir.access) —
// anonyme, cookie invalide ou jeton faux → 401 ; contributeur ou chargé de mission → 403 ; direction et RAF → CSV. Les heures
// par personne suivent en plus la visibilité du temps de qui exporte : réglée sur « chacun les siennes », la direction ne lit
// plus que l'agrégat. Données propres au test (base de sécurité jetable) : une ligne 2026 finançant une action au nom piégé
// (formule), avec 7 h saisies par le chargé de mission. Le jeton d'API valide donne tout le détail ; un paramètre mal formé → 400.
const prisma = new PrismaClient({ datasources: { db: { url: process.env.SECURITY_DATABASE_URL } } });
const HEADER = "projet;action;personne;heures;montant";

test.describe.serial("SEC-34 — export des actions financées", () => {
  const ids = { project: "", edition: "", line: "", action: "" };
  let visibility = "";
  let previousToken: string | null = null;
  const TOKEN = "sec34-jeton-de-recette-0000000000";
  const path = () => `/financements/export?ligne=${ids.line}`;

  test.beforeAll(async () => {
    const base = await prisma.project.findFirstOrThrow({ orderBy: { id: "asc" }, select: { poleId: true, pilotId: true, missionId: true } });
    const funder = await prisma.fundingLine.findFirstOrThrow({ orderBy: { id: "asc" }, select: { funderId: true } });
    const pilot = await prisma.person.findFirstOrThrow({ where: { name: SECURITY_ACTORS.pilot.name }, select: { id: true } });
    const p = await prisma.project.create({ data: { ...base, name: "-SEC34 projet financé", analyticCode: "SEC34-PRO" } });
    const e = await prisma.edition.create({ data: { projectId: p.id, year: 2026, status: "in_progress" } });
    const line = await prisma.fundingLine.create({ data: { editionId: e.id, funderId: funder.funderId, status: "contracted", amountGranted: 5_000 } });
    const a = await prisma.action.create({ data: { editionId: e.id, projectId: p.id, name: "=HYPERLINK(\"http://x\")", ownerId: base.pilotId, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: new Date(Date.UTC(2026, 11, 31)) } });
    await prisma.actionFunding.create({ data: { actionId: a.id, fundingLineId: line.id, amount: 1_500 } });
    await prisma.timeEntry.create({ data: { personId: pilot.id, projectId: p.id, actionId: a.id, date: new Date(Date.UTC(2026, 2, 10)), hours: 7 } });
    const settings = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { timeVisibility: true, apiToken: true } });
    visibility = settings.timeVisibility;
    previousToken = settings.apiToken;
    await prisma.settings.update({ where: { id: 1 }, data: { apiToken: TOKEN } });
    Object.assign(ids, { project: p.id, edition: e.id, line: line.id, action: a.id });
  });

  test.afterAll(async () => {
    await prisma.settings.update({ where: { id: 1 }, data: { timeVisibility: visibility, apiToken: previousToken } });
    await prisma.timeEntry.deleteMany({ where: { actionId: ids.action } });
    await prisma.action.deleteMany({ where: { projectId: ids.project } });
    await prisma.changeLog.deleteMany({ where: { edition: { projectId: ids.project } } });
    await prisma.edition.deleteMany({ where: { projectId: ids.project } });
    await prisma.project.deleteMany({ where: { id: ids.project } });
    await prisma.$disconnect();
  });

  test("anonyme, jeton vide ou faux, cookie invalide : 401 sans contenu", async ({ request, playwright, baseURL }) => {
    for (const suffix of ["", "&jeton=", "&jeton=x"]) {
      const res = await request.get(`${path()}${suffix}`);
      expect(res.status(), suffix || "sans jeton").toBe(401);
      expect(await res.text()).not.toContain("SEC34");
    }
    const invalid = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: INVALID_COOKIE } });
    const bad = await invalid.get(path());
    expect(bad.status()).toBe(401);
    expect(await bad.text()).not.toContain("SEC34");
    await invalid.dispose();
  });

  for (const actor of ["contributor", "pilot"] as const) {
    test(`${actor} sans le droit : 403, rien de lu (ligne comme dossier)`, async ({ browser, baseURL }) => {
      const context = await contextFor(browser, SECURITY_ACTORS[actor], baseURL);
      for (const p of [path(), `/financements/export?dossier=inexistant&annee=2026`]) {
        const res = await context.request.get(p);
        expect(res.status(), p).toBe(403);
        expect(await res.text()).not.toContain("SEC34");
      }
      await context.close();
    });
  }

  test("direction et RAF : CSV, en-tête exact, formules neutralisées, heures et montant de la ligne", async ({ browser, baseURL }) => {
    for (const actor of ["director", "raf"] as const) {
      const context = await contextFor(browser, SECURITY_ACTORS[actor], baseURL);
      const res = await context.request.get(path());
      expect(res.status(), actor).toBe(200);
      expect(res.headers()["content-type"]).toMatch(/text\/csv/);
      const lines = (await res.text()).replace(/^﻿/, "").split("\n");
      expect(lines[0]).toBe(HEADER);
      expect(lines).toContain(`'-SEC34 projet financé;"'=HYPERLINK(""http://x"")";${SECURITY_ACTORS.pilot.name};7,00;1500`);
      expect(lines.slice(1).every((l) => !/^[=+\-@]/.test(l) && !/;[=+\-@]/.test(l.replace(/"[^"]*"/g, "")))).toBe(true);
      await context.close();
    }
  });

  test("le droit sur les montants n'ouvre pas le temps des autres : « chacun les siennes » → agrégat seul", async ({ browser, baseURL }) => {
    await prisma.settings.update({ where: { id: 1 }, data: { timeVisibility: "self" } });
    const context = await contextFor(browser, SECURITY_ACTORS.director, baseURL);
    const text = await (await context.request.get(path())).text();
    expect(text).not.toContain(SECURITY_ACTORS.pilot.name);
    expect(text).toContain("1 autre personne : détail non visible;7,00;1500");
    await context.close();
    await prisma.settings.update({ where: { id: 1 }, data: { timeVisibility: visibility } });
  });

  test("jeton d'API valide, sans session : tout le détail (nom et heures), même réglé sur « chacun les siennes »", async ({ request }) => {
    await prisma.settings.update({ where: { id: 1 }, data: { timeVisibility: "self" } });
    const res = await request.get(`${path()}&jeton=${TOKEN}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/text\/csv/);
    const lines = (await res.text()).replace(/^\uFEFF/, "").split("\n");
    expect(lines[0]).toBe(HEADER);
    expect(lines).toContain(`'-SEC34 projet financé;"'=HYPERLINK(""http://x"")";${SECURITY_ACTORS.pilot.name};7,00;1500`);
    expect(lines.join("\n")).not.toContain("détail non visible");
    await prisma.settings.update({ where: { id: 1 }, data: { timeVisibility: visibility } });
  });

  test("paramètres invalides : 400 avec un message clair, jamais 500", async ({ browser, baseURL }) => {
    const context = await contextFor(browser, SECURITY_ACTORS.director, baseURL);
    for (const [p, msg] of [
      [`/financements/export?dossier=${ids.line}&annee=abc`, "annee"],
      [`/financements/export?dossier=x&annee=1999`, "annee"],
      [`/financements/export?ligne=${encodeURIComponent("x' OR 1=1")}`, "ligne"],
      [`/financements/export`, "requis"],
    ] as const) {
      const res = await context.request.get(p);
      expect(res.status(), p).toBe(400);
      expect(await res.text(), p).toContain(msg);
    }
    await context.close();
  });
});
