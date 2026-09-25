import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { pageFor, SECURITY_ACTORS } from "./fixtures";

// Délégation (25/09) : lue par la personne, la direction (lit toutes) ou qui la rédige sur son pôle ; jamais par un tiers.
// Les tâches de la personne sont personnelles : absentes de la page et de l'export lus par quelqu'un d'autre.
const personId = readFileSync("tests/.security-delegation-person-id", "utf8").trim();
const SECRET = "Six conférences tenues";
const TASK = "SEC31_TASK_SENTINEL_4b1e";

test.describe("SEC-31 — délégations", () => {
  test("un contributeur ne lit ni la page ni l'export d'une délégation qui n'est pas la sienne", async ({ browser, baseURL }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.contributor, baseURL);
    const res = await page.goto(`/delegation?personne=${personId}`, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    const html = await page.content();
    expect(html).not.toContain(SECRET);
    expect(html).not.toContain(TASK);
    expect((await page.request.get(`/delegation/export?personne=${personId}`)).status()).toBe(404);
    await page.context().close();
  });

  test("la direction lit la délégation, sans les tâches de la personne", async ({ browser, baseURL }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.director, baseURL);
    await page.goto(`/delegation?personne=${personId}&periode=annee`, { waitUntil: "networkidle" });
    const html = await page.content();
    expect(html).toContain(SECRET);
    expect(html).not.toContain(TASK);
    const doc = await page.request.get(`/delegation/export?personne=${personId}&periode=annee`);
    expect(doc.status()).toBe(200);
    await page.context().close();
  });

  test("la personne voit ses propres tâches ; l'anonyme n'exporte rien", async ({ browser, baseURL, request }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.pilot, baseURL);
    await page.goto(`/delegation?periode=annee`, { waitUntil: "networkidle" });
    expect(await page.content()).toContain(TASK);
    await page.context().close();
    expect((await request.get(`/delegation/export?personne=${personId}`)).status()).toBe(401);
  });
});
