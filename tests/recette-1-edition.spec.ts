import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";
import { W, cap, pl } from "./vocab";

// Recette 1 (lot 1) : la direction crée une édition, le pilote la complète, le portefeuille l'affiche avec ses alertes.
test("la direction crée une édition, le pilote la complète, le portefeuille l'affiche avec ses alertes", async ({ page }) => {
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");

  // 1. La direction crée un projet et sa première édition.
  await page.getByTestId("cp-open").click();
  await page.getByTestId("cp-name").fill("Projet recette Alpha");
  await page.getByTestId("cp-code").fill("REC-01");
  await pick(page, "cp-pilot", "Inès Cabral");
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projet recette Alpha", { timeout: 30_000 });
  await expect(page.getByTestId("edition-years")).toContainText(`${new Date().getFullYear()}`);

  // Couche 1 (direction) et statut « en cours ».
  await expect(page.getByTestId("layer-strategic")).toContainText("Manquant");
  await page.getByTestId("field-stakes").fill("Enjeu de la recette : montrer l'entonnoir.");
  await page.getByTestId("field-stakes").blur();
  await expect(page.getByTestId("changelog")).toContainText("Enjeux", { timeout: 20_000 });
  await pick(page, "edition-status", { value: "in_progress" });
  await expect(page.getByTestId("edition-status")).toHaveAttribute("data-value", "in_progress");

  // Un pilote ne peut pas écrire la couche 1.
  await iAm(page, "Inès Cabral");
  await expect(page.getByTestId("field-stakes")).toHaveAttribute("data-readonly", "true");

  // 2. Le pilote complète la couche 3 et ajoute une action avec un jalon dépassé.
  await page.getByTestId("field-operationalObjectives").fill("Trois ateliers et un bilan.");
  await page.getByTestId("field-operationalObjectives").blur();
  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Atelier de lancement");
  await page.getByTestId("add-action-submit").click();
  // Créer l'action ouvre sa page : le jalon s'y pose.
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Atelier de lancement");
  await page.getByTestId("milestone-add").click();
  await page.getByTestId("milestone-add-date").fill("2026-01-15");
  await page.getByTestId("milestone-add-label").fill("Atelier de lancement");
  await page.getByTestId("milestone-add-submit").click();
  await expect(page.getByTestId("milestone-date-0")).toHaveValue("2026-01-15");
  // Vider la date ne supprime pas le jalon (un champ date à moitié effacé envoie une valeur vide) : refusé, la date revient.
  await page.getByTestId("milestone-date-0").fill("");
  await page.getByTestId("milestone-date-0").blur();
  await expect(page.getByText("Indiquez une date : le jalon est conservé")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("milestone-date-0")).toHaveValue("2026-01-15");
  await page.getByTestId("action-back").click();
  await expect(page.getByTestId("action-row-0")).toBeVisible();
  await expect(page.getByTestId("action-late-0")).toBeVisible();
  await expect(page.getByText("Jalon dépassé : Atelier de lancement")).toBeVisible({ timeout: 10_000 });

  // 3. Le portefeuille affiche l'édition avec son alerte.
  await page.goto("/portefeuille?alerte=danger");
  const line = page.getByTestId("portfolio-table").locator("tr", { hasText: "Projet recette Alpha" });
  await expect(line).toBeVisible();
  await expect(line).toContainText("Jalon dépassé");
  await expect(line).toContainText("Inès Cabral");
});
