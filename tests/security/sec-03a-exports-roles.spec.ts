import { test, expect } from "@playwright/test";
import { contextFor, SECURITY_ACTORS, INVALID_COOKIE } from "./fixtures";

const exports = [
  { name: "admin", path: "/admin/export?table=personnes", allowed: ["raf", "director"] as const, content: /text\/csv/ },
  { name: "cloture", path: "/cloture/export?mois=2027-01&par=projet", allowed: ["raf", "director"] as const, content: /text\/csv/ },
  { name: "matrice", path: "/matrice/export?annee=2027", allowed: ["raf", "director"] as const, content: /text\/csv/ },
];

test.describe("SEC-03A — autorisation des exports globaux", () => {
  for (const item of exports) {
    test(`${item.name} refuse l'anonyme et le cookie invalide`, async ({ request, playwright, baseURL }) => {
      const anon = await request.get(item.path);
      expect(anon.status()).toBe(401);
      const invalid = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: INVALID_COOKIE } });
      const bad = await invalid.get(item.path);
      expect([401, 403]).toContain(bad.status());
      expect(await bad.text()).not.toContain("Lucas Perrin");
      await invalid.dispose();
    });

    for (const actor of ["contributor", "pilot"] as const) {
      test(`${item.name} refuse ${actor}`, async ({ browser, baseURL }) => {
        const context = await contextFor(browser, SECURITY_ACTORS[actor], baseURL);
        const response = await context.request.get(item.path);
        expect(response.status()).toBe(403);
        expect(await response.text()).not.toContain("Projet");
        await context.close();
      });
    }

    for (const actor of item.allowed) {
      test(`${item.name} reste accessible à ${actor}`, async ({ browser, baseURL }) => {
        const context = await contextFor(browser, SECURITY_ACTORS[actor], baseURL);
        const response = await context.request.get(item.path);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toMatch(item.content);
        expect((await response.body()).byteLength).toBeGreaterThan(10);
        await context.close();
      });
    }
  }
});
