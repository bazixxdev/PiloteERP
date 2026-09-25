import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { pageFor, SECURITY_ACTORS } from "./fixtures";

// Budget prévisionnel (25/09) : le détail Personnel (heures × coût horaire = rémunération) n'est sérialisé que pour la trésorerie
// ou la validation du budget. Le contrôle porte sur le HTML et le flux RSC renvoyés, pas sur l'affichage.
const editionId = readFileSync("tests/.security-budget-edition-id", "utf8").trim();

test.describe("SEC-30 — budget prévisionnel : rémunérations", () => {
  test("un contributeur ne reçoit ni le détail par personne ni les noms des heures non valorisées", async ({ browser, baseURL }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.contributor, baseURL);
    const response = await page.goto(`/edition/${editionId}?onglet=budget`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("budget-plan-table")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("budget-personnel-detail");
    expect(html).not.toContain('"detail":[{');
    await page.context().close();
  });

  test("la RAF reçoit le détail par personne", async ({ browser, baseURL }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.raf, baseURL);
    await page.goto(`/edition/${editionId}?onglet=budget`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("budget-personnel-detail")).toBeVisible();
    await page.context().close();
  });

  test("l'export CSV refuse l'anonyme et ne contient jamais de nom", async ({ browser, baseURL, request }) => {
    expect((await request.get(`/edition/${editionId}/budget-plan/export`)).status()).toBe(401);
    const page = await pageFor(browser, SECURITY_ACTORS.raf, baseURL);
    const csv = await page.request.get(`/edition/${editionId}/budget-plan/export`);
    expect(csv.status()).toBe(200);
    expect(await csv.text()).not.toMatch(/Inès|Cabral/);
    await page.context().close();
  });
});
