import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { pageFor, SECURITY_ACTORS } from "./fixtures";

// Mes actions (26/09) remplace la délégation comme objet à part : lue par la personne elle-même, par qui a le droit de
// voir le temps de l'équipe sur son périmètre (direction, responsable du pôle de la personne — même garde que
// /temps?personne=), jamais par un tiers. Les tâches de la personne restent personnelles : absentes de la page et de
// l'export lus par quelqu'un d'autre. Garde vérifiée avant toute lecture : 404 sur la page (la ressource ne « s'affiche »
// pas), 403 sur l'export (une session valide, mais pas le droit).
const personId = readFileSync("tests/.security-mes-actions-person-id", "utf8").trim();
const SECRET = "SEC31_ENTRUSTED_SECRET_7c2b";
const TASK = "SEC31_TASK_SENTINEL_4b1e";

test.describe("SEC-31 — Mes actions", () => {
  test("un contributeur ne lit ni la page ni l'export des actions d'un tiers", async ({ browser, baseURL }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.contributor, baseURL);
    const res = await page.goto(`/mes-actions?personne=${personId}`, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(404);
    const html = await page.content();
    expect(html).not.toContain(SECRET);
    expect(html).not.toContain(TASK);
    expect((await page.request.get(`/mes-actions/export?personne=${personId}`)).status()).toBe(403);
    await page.context().close();
  });

  test("la direction lit ce qui est confié, sans les tâches de la personne", async ({ browser, baseURL }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.director, baseURL);
    const res = await page.goto(`/mes-actions?personne=${personId}&periode=annee`, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    const html = await page.content();
    expect(html).toContain(SECRET);
    expect(html).not.toContain(TASK);
    const doc = await page.request.get(`/mes-actions/export?personne=${personId}&periode=annee`);
    expect(doc.status()).toBe(200);
    expect(doc.headers()["content-type"]).toContain("wordprocessingml");
    await page.context().close();
  });

  test("la personne voit ses propres tâches ; l'anonyme n'exporte rien", async ({ browser, baseURL, request }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.pilot, baseURL);
    await page.goto(`/mes-actions?periode=annee`, { waitUntil: "networkidle" });
    expect(await page.content()).toContain(TASK);
    await page.context().close();
    expect((await request.get(`/mes-actions/export?personne=${personId}`)).status()).toBe(401);
  });
});
