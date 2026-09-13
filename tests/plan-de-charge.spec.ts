import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Plan de charge : jours prévus par personne et par mois face à la capacité, ventilation depuis l'édition, vue par projet.
test("le plan de charge montre les mois en dépassement ; le pilote ventile ses jours par mois depuis l'édition", async ({ page }) => {
  await page.goto("/plan-de-charge");
  await iAm(page, "Claire Vasseur");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Plan de charge");
  await expect(page.getByTestId("load-grid")).toBeVisible();
  // Hugo Lemaire est surchargé à l'automne dans le jeu de démo.
  await expect(page.getByTestId("load-over")).toContainText("Hugo Lemaire");
  await page.getByTestId("load-cell-" + (await page.locator("[data-testid^=load-row-]", { hasText: "Hugo Lemaire" }).getAttribute("data-testid"))!.replace("load-row-", "") + "-2026-11").click();
  await expect(page.getByText(/j prévus · capacité/)).toBeVisible();
  await page.keyboard.press("Escape");

  // Vue par projet.
  await page.getByTestId("load-view").selectOption("projets");
  await expect(page.getByTestId("load-by-project")).toBeVisible();

  // Ventilation depuis l'édition : le pilote lisse 24 j de septembre à décembre.
  await iAm(page, "Romain Tessier");
  await openEditionByName(page, "Refonte du site internet");
  await page.getByRole("tab", { name: "Temps" }).click();
  const row = page.getByTestId("hr-table").locator("tr", { hasText: "Romain Tessier" });
  await row.locator("[data-testid^=load-plan-]").click();
  await page.getByTestId("load-total").fill("24");
  await page.getByLabel("Premier mois").selectOption("2026-09");
  await page.getByLabel("Dernier mois").selectOption("2026-12");
  await page.getByTestId("load-spread").click();
  await expect(page.getByTestId("load-month-2026-10")).toHaveValue("6");
  await expect(page.getByTestId("load-sum")).toContainText("24");
  await page.getByTestId("load-save").click();
  await expect(page.getByText("24 j répartis pour Romain Tessier")).toBeVisible();
  await expect(row).toContainText("par mois");
  await expect(row.locator('input[type="number"]').first()).toHaveValue("24");

  // Le plan de charge reflète la ventilation (6 j en octobre sur cette édition).
  await page.goto("/plan-de-charge?debut=2026-09&horizon=6&pole=tous");
  const romain = page.locator("[data-testid^=load-row-]", { hasText: "Romain Tessier" });
  await romain.locator('[data-testid$="-2026-10"]').click();
  await expect(page.getByRole("link", { name: /Refonte du site internet/ })).toBeVisible();
});
