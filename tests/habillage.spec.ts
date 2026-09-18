import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

// Lot I : l'instance TLST s'habille à ses couleurs et parle sa langue — aucun mot CRESS dans ce qui s'affiche.
// Tourne dans le projet Playwright « tlst » (serveur NEXT_PUBLIC_CLIENT=tlst, base pilote_test_tlst, seed TLST).
const PAGES = ["/portefeuille", "/projets", "/matrice", "/demandes", "/admin", "/organisations", "/contacts", "/tresorerie", "/adherents", "/materiel", "/notes", "/echeances", "/codir", "/ma-semaine", "/temps", "/annuel", "/validations", "/cloture", "/seminaire", "/appels", "/conventions", "/financeurs", "/compte"];
const FORBIDDEN = [/CRESS/, /(?<!\p{L})[Éé]ditions?(?!\p{L})/u, /(?<!\p{L})[Pp]ôles?(?!\p{L})/u, /(?<!\p{L})CODIR(?!\p{L})/u, /(?<!\p{L})RAF(?!\p{L})/u];

test("titre, logo, favicon, thème, police", async ({ page }) => {
  await page.goto("/portefeuille");
  await expect(page).toHaveTitle(/Pilote · Tiers-Lieu Nourricier du Sud Touraine/);
  await expect(page.locator('aside img[alt="Tiers-Lieu Nourricier du Sud Touraine"]').first()).toBeVisible();
  // Le favicon est public : la page de connexion l'affiche aussi (sans session, le middleware redirigeait vers /connexion).
  const icon = await page.request.get("/icon", { maxRedirects: 0 });
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim())).toBe("#3f6b4a");
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("h1")!).fontFamily)).toMatch(/Nunito/);
});

test("les mots de TLST", async ({ page }) => {
  await page.goto("/portefeuille");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Portefeuille des actions");
  // La vue large des demandes (direction) porte le nom court du client avec son genre : « Tout le TLST », pas « Toute la ».
  await page.goto("/demandes?vue=toutes");
  await expect(page.getByText("Tout le TLST · en cours")).toBeVisible();
  await page.goto("/portefeuille");
  await page.getByRole("link", { name: /Jardin partagé/ }).first().click();
  await expect(page).toHaveURL(/\/edition\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jardin partagé");
  await expect(page.getByRole("tab", { name: /^Étapes/ })).toBeVisible();
  await page.getByTestId("help-open").click();
  await page.getByTestId("lexique-open").click();
  const lexique = page.getByTestId("lexique");
  await expect(lexique).toContainText("Action");
  await expect(lexique).toContainText("Étape");
  await expect(lexique).not.toContainText("dition");
  await expect(lexique).toContainText("le TLST");
});

for (const path of PAGES) {
  test(`aucun mot CRESS sur ${path}`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status(), `${path} répond`).toBe(200);
    const text = await page.locator("body").innerText();
    const attrs = await page.evaluate(() => [...document.querySelectorAll("[title],[placeholder],[aria-label]")].flatMap((el) => ["title", "placeholder", "aria-label"].map((a) => el.getAttribute(a) ?? "")).join("\n"));
    for (const re of FORBIDDEN) {
      expect(text, `${path} affiche ${re}`).not.toMatch(re);
      expect(attrs, `${path} porte ${re} dans un attribut`).not.toMatch(re);
    }
  });
}

test("check:vocab est vert", () => {
  execSync("node scripts/check-vocab.mjs", { stdio: "inherit" });
});
