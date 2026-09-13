import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Périmètre : une personne de pôle voit son pôle par défaut, peut élargir ; un projet commun apparaît dans ses deux pôles.
test("le portefeuille et les validations s'ouvrent sur mon pôle ; un projet commun est vu par ses deux pôles", async ({ page }) => {
  // Inès (Représentation et observation) : son pôle par défaut, dont le projet commun « Sensibilisation des jeunes » (principal Sensibilisation, secondaire Représentation).
  await page.goto("/portefeuille");
  await iAm(page, "Inès Cabral");
  await expect(page.getByTestId("perimeter-pole")).toHaveAttribute("aria-current", "page");
  const table = page.getByTestId("portfolio-table");
  await expect(table.getByRole("link", { name: "Observatoire régional (ORESS)" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Sensibilisation des jeunes" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Chroniquer la TESS" })).toHaveCount(0);

  // Ce qui me concerne d'abord : « Je pilote » en tête, puis « Je contribue », puis « Mon pôle ».
  const groups = table.locator("tr[data-testid^=group-]");
  await expect(groups.first()).toContainText("Je pilote");
  const firstRowAfterHeader = table.locator("tbody tr").nth(1);
  await expect(firstRowAfterHeader).toContainText("Inès Cabral");

  // Élargir à toute la CRESS : les autres pôles arrivent en dernier.
  await page.getByTestId("perimeter-cress").click();
  await expect(table.getByRole("link", { name: "Chroniquer la TESS" })).toBeVisible();
  await expect(table.locator("tr[data-testid=group-3]")).toContainText("Autres pôles");

  // Une édition hors de son pôle : consultable, avec le bandeau.
  await table.getByRole("link", { name: "Chroniquer la TESS" }).click();
  await expect(page.getByTestId("outside-scope")).toContainText("hors de votre pôle");
  await expect(page.getByTestId("field-operationalObjectives")).toHaveAttribute("data-readonly", "true");

  // Le responsable du pôle secondaire a ses droits de garant sur le projet commun.
  await iAm(page, "Julien Barbot");
  await page.goto("/portefeuille");
  await table.getByRole("link", { name: "Sensibilisation des jeunes" }).click();
  await expect(page.getByTestId("outside-scope")).toHaveCount(0);
  await expect(page.getByText("Projet commun avec")).toBeVisible();
  await page.getByRole("tab", { name: "Bilan" }).click();
  await expect(page.getByTestId("field-report")).not.toHaveAttribute("readonly", "");

  // La direction voit tout, sans bascule.
  await iAm(page, "Claire Vasseur");
  await page.goto("/portefeuille");
  await expect(page.getByTestId("perimeter")).toHaveCount(0);
  await expect(table.getByRole("link", { name: "Chroniquer la TESS" })).toBeVisible();
});
