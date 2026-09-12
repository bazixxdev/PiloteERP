import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Recette 1 (lot 1) : la direction crée une édition, le pilote la complète, le portefeuille l'affiche avec ses alertes.
test("la direction crée une édition, le pilote la complète, le portefeuille l'affiche avec ses alertes", async ({ page }) => {
  await page.goto("/admin?section=projets");
  await iAm(page, "Claire Vasseur");

  // 1. La direction crée un projet et sa première édition.
  await page.getByTestId("cp-name").fill("Projet recette Alpha");
  await page.getByTestId("cp-code").fill("REC-01");
  await page.getByTestId("cp-pilot").selectOption({ label: "Inès Cabral" });
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projet recette Alpha · ");

  // Couche 1 (direction) et statut « en cours ».
  await expect(page.getByTestId("layer-strategic")).toContainText("Manquant");
  await page.getByTestId("field-stakes").fill("Enjeu de la recette : montrer l'entonnoir.");
  await page.getByTestId("field-stakes").blur();
  await expect(page.getByTestId("changelog")).toContainText("Enjeux", { timeout: 10_000 });
  await page.getByTestId("edition-status").selectOption("in_progress");
  await expect(page.getByTestId("edition-status")).toHaveValue("in_progress");

  // Un pilote ne peut pas écrire la couche 1.
  await iAm(page, "Inès Cabral");
  await expect(page.getByTestId("field-stakes")).toHaveAttribute("readonly", "");

  // 2. Le pilote complète la couche 3 et ajoute une action avec un jalon dépassé.
  await page.getByTestId("field-operationalObjectives").fill("Trois ateliers et un bilan.");
  await page.getByTestId("field-operationalObjectives").blur();
  await page.getByRole("tab", { name: "Actions" }).click();
  await page.getByTestId("add-action-input").fill("Atelier de lancement");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-name-0")).toHaveValue("Atelier de lancement");
  const row = page.getByTestId("action-row-0");
  await row.locator('input[type="date"]').fill("2026-01-15");
  await expect(page.getByText("Jalon dépassé : Atelier de lancement")).toBeVisible({ timeout: 10_000 });

  // 3. Le portefeuille affiche l'édition avec son alerte.
  await page.goto("/portefeuille?alerte=danger");
  const line = page.getByTestId("portfolio-table").locator("tr", { hasText: "Projet recette Alpha" });
  await expect(line).toBeVisible();
  await expect(line).toContainText("Jalon dépassé");
  await expect(line).toContainText("Inès Cabral");
});
