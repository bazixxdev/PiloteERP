import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { contextFor, SECURITY_ACTORS, INVALID_COOKIE } from "./fixtures";

const EDITION_ID = readFileSync("tests/.security-edition-id", "utf8").trim();
const paths = [
  `/plan-operationnel/export?annee=2027`,
  `/edition/${EDITION_ID}/export?format=docx`,
];

test.describe("SEC-02 — exports documentaires", () => {
  for (const path of paths) {
    test(`anonyme sans jeton, jeton vide et jeton arbitraire refusés (${path})`, async ({ request }) => {
      for (const suffix of ["", "&jeton=", "&jeton=x"]) {
        const response = await request.get(`${path}${suffix}`);
        expect(response.status()).toBe(401);
        expect(response.headers()["content-type"]).toContain("application/json");
        expect(await response.text()).not.toContain("Fiche projet");
      }
    });

    test(`cookie invalide refusé (${path})`, async ({ playwright, baseURL }) => {
      const context = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: INVALID_COOKIE } });
      const response = await context.get(path);
      expect(response.status()).toBe(401);
      expect(await response.text()).not.toContain("Fiche projet");
      await context.dispose();
    });

    test(`session active autorisée (${path})`, async ({ browser, baseURL }) => {
      const context = await contextFor(browser, SECURITY_ACTORS.contributor, baseURL);
      const response = await context.request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(/wordprocessingml\.document/);
      expect((await response.body()).byteLength).toBeGreaterThan(100);
      await context.close();
    });
  }

  test("édition inexistante : une session autorisée reçoit 404 sans génération", async ({ browser, baseURL }) => {
    const context = await contextFor(browser, SECURITY_ACTORS.contributor, baseURL);
    const response = await context.request.get("/edition/inexistant/export?format=docx");
    expect(response.status()).toBe(404);
    expect(await response.text()).toBe("Introuvable");
    await context.close();
  });
});
