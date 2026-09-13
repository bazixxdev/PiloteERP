import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Financeurs : liste, page avec contacts (RAF), contact principal repris sur les lignes de financement et les conventions.
test("la RAF tient les contacts d'un financeur ; le contact principal apparaît sur les lignes et les conventions", async ({ page }) => {
  await page.goto("/financeurs");
  await iAm(page, "Nadia Ferrand");
  await expect(page.getByTestId("funders-table")).toContainText("Hélène Marchand");
  await page.getByTestId("funders-table").getByRole("link", { name: "Région", exact: true }).click();
  await expect(page.getByLabel("Nom du financeur")).toHaveValue("Région");

  // Ajout d'un contact, puis il devient le contact principal.
  await page.getByTestId("contact-lastname").fill("Vidal");
  await page.getByTestId("contact-role").fill("Élue référente ESS");
  await page.getByTestId("contact-email").fill("j.vidal@exemple.fr");
  await page.getByTestId("contact-submit").click();
  const vidal = page.locator('li[data-contact="Vidal"]');
  await expect(vidal).toBeVisible();
  await vidal.locator("[data-testid^=contact-primary-]").click();
  await expect(vidal.locator("[data-testid^=contact-primary-]")).toHaveAttribute("aria-label", "Contact principal");

  // Sur une édition financée par la Région : le contact principal se lit sur la ligne, un contact du dossier peut être choisi.
  await openEditionByName(page, "Vœux et assemblée générale");
  await page.getByRole("tab", { name: "Financements" }).click();
  const regionLine = page.locator('[data-testid^=funding-line-][data-funder="Région"]').first();
  await expect(regionLine.locator("[data-testid^=funding-contact-]")).toContainText("Vidal");
  const sel = regionLine.getByLabel(/Contact du dossier/); const optVal = await sel.locator("option", { hasText: "Marchand" }).getAttribute("value"); await sel.selectOption(optVal as string);
  await expect(regionLine.locator("[data-testid^=funding-contact-]")).toContainText("Contact du dossier");
  await expect(regionLine.locator("[data-testid^=funding-contact-]")).toContainText("Marchand");

  // Un pilote lit les contacts sans pouvoir les modifier.
  await iAm(page, "Maxime Roussel");
  await page.goto("/financeurs");
  await page.getByTestId("funders-table").getByRole("link", { name: "Région", exact: true }).click();
  await expect(page.locator('li[data-contact="Vidal"]')).toContainText("Vidal");
  await expect(page.getByTestId("contact-form")).toHaveCount(0);
});
