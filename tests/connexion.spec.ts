import { test, expect } from "@playwright/test";
import path from "node:path";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

// Admin › Paramètres › Logos (spec connexion § 3, tâche 4). Session par défaut : direction (storageState du projet), qui
// administre. Complété à la tâche 5 (page de connexion elle-même).
test("un admin téléverse le grand logo : aperçu, couleurs repérées ; il le retire : retour au logo du fichier client", async ({ page }, info) => {
  const file = path.join(info.outputDir, "logo-rouge-bleu.png");
  const half = await sharp({ create: { width: 100, height: 100, channels: 4, background: "#e02020" } }).png().toBuffer();
  await writeFile(file, await sharp({ create: { width: 200, height: 100, channels: 4, background: "#2040e0" } }).composite([{ input: half, left: 0, top: 0 }]).png().toBuffer());
  await page.goto("/admin?section=parametres");
  await page.getByTestId("brand-upload-logo").setInputFiles(file);
  await expect(page.getByTestId("brand-swatch")).toHaveCount(2);
  await expect(page.getByTestId("brand-delete-logo")).toBeVisible();
  await page.getByTestId("brand-delete-logo").click();
  await expect(page.getByTestId("brand-delete-logo")).toHaveCount(0);
});
