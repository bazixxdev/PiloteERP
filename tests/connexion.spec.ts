import { test, expect } from "@playwright/test";
import path from "node:path";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { FRESH } from "./helpers";

// Admin › Paramètres › Logos (spec connexion § 3, tâche 4). Session par défaut : direction (storageState du projet), qui
// administre. Complété à la tâche 5 (page de connexion elle-même).
test("un admin téléverse le grand logo : aperçu, couleurs repérées ; il le retire : retour au logo du fichier client", async ({ page }, info) => {
  const file = path.join(info.outputDir, "logo-rouge-bleu.png");
  // info.outputDir n'existe pas tant qu'aucun artefact (capture, trace) n'y a été écrit par le runner : le créer avant d'y
  // écrire notre propre fichier, sinon ENOENT.
  await mkdir(info.outputDir, { recursive: true });
  const half = await sharp({ create: { width: 100, height: 100, channels: 4, background: "#e02020" } }).png().toBuffer();
  await writeFile(file, await sharp({ create: { width: 200, height: 100, channels: 4, background: "#2040e0" } }).composite([{ input: half, left: 0, top: 0 }]).png().toBuffer());
  await page.goto("/admin?section=parametres");
  await page.getByTestId("brand-upload-logo").setInputFiles(file);
  await expect(page.getByTestId("brand-swatch")).toHaveCount(2);
  await expect(page.getByTestId("brand-delete-logo")).toBeVisible();
  await page.getByTestId("brand-delete-logo").click();
  await expect(page.getByTestId("brand-delete-logo")).toHaveCount(0);
});

test.describe("la page de connexion", () => {
  test.use({ storageState: FRESH });

  test("deux colonnes, panneau aux couleurs du logo, accroche, formulaire intact", async ({ page }) => {
    await page.goto("/connexion");
    const root = page.getByTestId("auth-page");
    await expect(page.getByTestId("brand-aura")).toBeVisible();
    const ink = await root.evaluate((el) => getComputedStyle(el).getPropertyValue("--brand-ink").trim());
    expect(ink).toMatch(/^#[0-9a-f]{6}$/i);
    await expect(page.getByTestId("brand-aura")).toContainText("de l'idée au bilan");
    await expect(page.getByRole("heading", { name: "Se connecter" })).toBeVisible();
    for (const id of ["login-form", "login-email", "login-password", "login-submit", "login-remember"]) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId("login-remember")).toBeChecked();
  });

  test("le bouton œil montre puis cache le mot de passe", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByTestId("login-password").fill("secret");
    await page.getByTestId("login-toggle-password").click();
    await expect(page.getByTestId("login-password")).toHaveAttribute("type", "text");
    await expect(page.getByTestId("login-toggle-password")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("login-toggle-password").click();
    await expect(page.getByTestId("login-password")).toHaveAttribute("type", "password");
  });

  test("mobile : une colonne, pas de défilement horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/connexion");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Fix round 1 : le bandeau a sa propre hauteur (clamp), la grille ne doit pas étirer la colonne du dessous sur le
    // reste de l'écran (sinon le logo se retrouve centré loin sous le bandeau, avec un grand vide entre les deux).
    const band = await page.getByTestId("brand-aura").boundingBox();
    const logo = await page.getByTestId("auth-page").locator("img.auth-logo").boundingBox();
    expect(band && logo).toBeTruthy();
    expect(logo!.y - (band!.y + band!.height)).toBeLessThan(120);
  });

  test("réduire les animations fige le panneau", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/connexion");
    const anim = await page.locator(".brand-aura__blob--1").evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe("none");
  });
});
