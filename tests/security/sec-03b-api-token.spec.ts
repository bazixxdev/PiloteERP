import { test, expect } from "@playwright/test";
import { pageFor, SECURITY_ACTORS } from "./fixtures";

test.describe("SEC-03B — token d'export global", () => {
  test("un contributeur et un compte désactivé ne reçoivent jamais le token", async ({ browser, baseURL }) => {
    for (const actor of [SECURITY_ACTORS.contributor, SECURITY_ACTORS.disabled]) {
      const page = await pageFor(browser, actor, baseURL);
      await page.goto("/admin?section=donnees", { waitUntil: "networkidle" });
      const html = await page.content();
      expect(html).not.toContain("setting-api-token-value");
      expect(html).not.toContain("api-url-matrice");
      expect(html).not.toContain("Régénérer");
      await page.context().close();
    }
  });

  test("le token valide fonctionne sans session, l'invalide est refusé", async ({ browser, baseURL, request }) => {
    const admin = await pageFor(browser, SECURITY_ACTORS.director, baseURL);
    await admin.goto("/admin?section=donnees", { waitUntil: "networkidle" });
    const oldToken = (await admin.getByTestId("setting-api-token-value").textContent())!.trim();
    expect(oldToken.length).toBeGreaterThan(20);
    const anonymous = await request.get(`/matrice/export?annee=2027&jeton=${encodeURIComponent(oldToken)}`);
    expect(anonymous.status()).toBe(200);
    expect(await anonymous.text()).toContain("pole;projet");
    const invalid = await request.get("/matrice/export?annee=2027&jeton=token-invalide");
    expect([401, 403]).toContain(invalid.status());
    await admin.context().close();
  });

  test("la rotation invalide l'ancien token et accepte le nouveau", async ({ browser, baseURL, request }) => {
    const admin = await pageFor(browser, SECURITY_ACTORS.director, baseURL);
    await admin.goto("/admin?section=donnees", { waitUntil: "networkidle" });
    const oldToken = (await admin.getByTestId("setting-api-token-value").textContent())!.trim();
    await admin.getByTestId("api-token-rotate").click();
    await expect(admin.getByTestId("setting-api-token-value")).not.toHaveText(oldToken);
    const newToken = (await admin.getByTestId("setting-api-token-value").textContent())!.trim();
    expect(newToken).not.toBe(oldToken);
    expect([401, 403]).toContain((await request.get(`/matrice/export?annee=2027&jeton=${encodeURIComponent(oldToken)}`)).status());
    expect((await request.get(`/matrice/export?annee=2027&jeton=${encodeURIComponent(newToken)}`)).status()).toBe(200);
    await admin.context().close();
  });
});
