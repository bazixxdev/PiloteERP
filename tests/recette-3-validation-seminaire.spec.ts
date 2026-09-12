import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Recette 3 (lot 3) : un devis demandé, validé au bon niveau, engagé sur l'édition ; les éditions 2027 créées en lot avec le contrôle de charge.
test("un devis est demandé, validé au bon niveau et engagé ; les éditions 2027 se créent en lot", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Inès Cabral");
  await openEditionByName(page, "Observatoire régional (ORESS)");

  // Engagé avant.
  await page.getByRole("tab", { name: "Budget" }).click();
  const before = Number((await page.getByTestId("budget-committed").inputValue()) || 0);

  // 1. Le pilote demande la validation d'un devis de 1 800 € : niveau 2 calculé (seuil 500 € / 3 000 €).
  await page.getByTestId("request-validation-open").click();
  await page.getByTestId("rv-amount").fill("1800");
  await page.getByTestId("rv-label").fill("Devis recette prestataire");
  await expect(page.getByTestId("rv-level")).toHaveValue("2", { timeout: 10_000 });
  await page.getByTestId("rv-submit").click();
  await expect(page.getByTestId("validation-0")).toContainText("Devis recette prestataire");

  // Le pilote (niveau 1) ne peut pas la décider lui-même.
  await expect(page.getByTestId("validation-0")).toContainText("En attente d'un valideur");

  // 2. Le responsable de pôle (niveau 2) l'approuve depuis la file.
  await iAm(page, "Julien Barbot");
  await page.goto("/validations");
  const card = page.getByTestId("for-me").locator("[data-testid^=validation-]", { hasText: "Devis recette prestataire" });
  await card.getByTestId("approve").click();
  await expect(page.getByText("Approuvée : le montant est engagé")).toBeVisible();

  // 3. Le devis approuvé remonte dans l'engagé de l'édition.
  await openEditionByName(page, "Observatoire régional (ORESS)");
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect(page.getByTestId("budget-committed")).toHaveValue(String(before + 1800));

  // 4. Séminaire : la direction crée les éditions 2027 en lot, le contrôle de charge s'affiche.
  await iAm(page, "Claire Vasseur");
  await page.goto("/seminaire?annee=2027");
  await page.getByTestId("batch-create").click();
  await expect(page.getByText(/édition\(s\) 2027 créée\(s\)/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^(\d+) sur \1 projets ont déjà leur édition 2027/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("load-table").locator("tr[data-testid^=load-row-]").first()).toBeVisible();
  await expect(page.getByTestId("batch-create")).toHaveCount(0);
});
