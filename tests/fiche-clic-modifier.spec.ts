import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Retour de Gaël (19/09) : une couche déjà remplie s'affiche en lecture et « avait l'air en lecture seule ». Un clic sur le texte
// passe la couche en modification, comme le bouton « Modifier ».
test("cliquer sur un champ d'une couche remplie passe la couche en modification", async ({ page }) => {
  await page.goto("/projets/proposer");
  await iAm(page, "Claire Vasseur");
  await page.goto("/projets/proposer");
  await page.getByPlaceholder(/Catalogue de formation/).fill("Projet clic test");
  await page.getByPlaceholder(/Un partenaire nous sollicite/).fill("Une idée à structurer, en trois lignes.");
  await page.getByRole("button", { name: "Proposer ce projet" }).click();
  await expect(page).toHaveURL(/\/edition\//);
  // La couche 3 est remplie (le résumé) : lecture d'abord, bouton Modifier présent.
  const layer = page.getByTestId("layer-proposal");
  await expect(layer.getByTestId("layer-edit-proposal")).toBeVisible();
  await expect(layer.getByTestId("field-operationalObjectives")).toHaveAttribute("data-readonly", "true");
  // Un clic sur le texte : la couche passe en saisie, le champ est un vrai champ.
  await layer.getByTestId("field-operationalObjectives").click();
  await expect(layer.getByTestId("field-operationalObjectives")).not.toHaveAttribute("data-readonly", "true");
  await expect(layer.locator("textarea[data-testid=field-operationalObjectives]")).toHaveValue(/Une idée à structurer/);
  await expect(layer.getByTestId("layer-done-proposal")).toBeVisible();
});
