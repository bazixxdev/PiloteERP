import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { expectAnonymous, pageFor, SECURITY_ACTORS } from "./fixtures";

// « Mes actions » remplace « Ma délégation » (26/09) : app/delegation/export/route.ts ne sert plus les textes de
// délégation (expectations, limits, controls) — il redirige (308) vers /mes-actions, comme app/delegation/page.tsx.
// Personne ne doit plus jamais recevoir le document : ni un contributeur (qui n'y avait pas droit avant non plus), ni
// l'anonyme (qui n'atteint même pas la route : le middleware répond 401 sur une adresse en /export sans session).
const personId = readFileSync("tests/.security-mes-actions-person-id", "utf8").trim();

test.describe("SEC-31 — /delegation/export ne sert plus de délégation", () => {
  test("un contributeur reçoit la redirection, jamais le document", async ({ browser, baseURL }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.contributor, baseURL);
    const res = await page.request.get(`/delegation/export?personne=${personId}`, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"] ?? "").toContain("/mes-actions");
    expect(res.headers()["content-type"] ?? "").not.toContain("wordprocessingml");
    await page.context().close();
  });

  test("l'anonyme n'obtient ni redirection ni document", async ({ page }) => {
    const res = await expectAnonymous(page, `/delegation/export?personne=${personId}`);
    expect(res.status()).not.toBe(200);
    expect(res.status()).not.toBe(308);
    expect(res.headers()["content-type"] ?? "").not.toContain("wordprocessingml");
  });
});
