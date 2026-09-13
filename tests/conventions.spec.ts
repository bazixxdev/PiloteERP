import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Convention partagée : une FSE 2026-2028 existe une fois, les éditions y sont affectées, la somme ne dépasse pas le notifié, la reconduction la conserve.
test("la convention FSE est unique, ses affectations sont plafonnées, la reconduction la rattache", async ({ page }) => {
  await page.goto("/conventions");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/conventions");
  const fse = page.getByTestId("convention-FSE-2026-2028");
  await expect(fse).toBeVisible();
  await expect(fse).toContainText("Dispositif local d'accompagnement (DLA) · 2026");
  await expect(fse).toContainText("Sensibilisation des jeunes · 2026");

  // Plafond : une affectation qui dépasse le notifié est refusée avec l'écart.
  await openEditionByName(page, "Dispositif local d'accompagnement (DLA)");
  await page.getByRole("tab", { name: "Financements" }).click();
  const fseLine = page.locator("[data-testid^=funding-line-]").filter({ has: page.locator("option", { hasText: "FSE-2026-2028" }) }).first();
  await expect(fseLine).toContainText("reste à affecter");
  const granted = fseLine.locator('input[type="number"]').nth(1);
  const before = await granted.inputValue();
  await granted.fill("999999");
  await granted.blur();
  await expect(page.getByText(/Les affectations confirmées atteindraient/)).toBeVisible();
  await expect(granted).toHaveValue(before);

  // Création d'une convention et rattachement d'une édition.
  await page.goto("/conventions");
  await page.getByTestId("cc-funder").selectOption({ label: "ADEME" });
  await page.getByTestId("cc-reference").fill("ADEME-TEST-2026-2027");
  await page.getByTestId("cc-notified").fill("30000");
  await page.getByTestId("cc-submit").click();
  await expect(page.getByTestId("convention-ADEME-TEST-2026-2027")).toContainText("aucune");
  await openEditionByName(page, "Chroniquer la TESS");
  await page.getByRole("tab", { name: "Financements" }).click();
  const opt = page.getByTestId("attach-convention-select").locator("option", { hasText: "ADEME-TEST-2026-2027" });
  await page.getByTestId("attach-convention-select").selectOption(await opt.getAttribute("value") as string);
  await page.getByTestId("attach-convention-submit").click();
  await expect(page.locator("[data-testid^=convention-of-]", { hasText: "2026-2027 · notifié" })).toHaveCount(1);

  // Reconduction : la ligne 2027 reste rattachée à la convention qui couvre 2027.
  await page.getByTestId("renew-open").click();
  await page.getByTestId("renew-confirm").click();
  await expect(page.getByTestId("edition-years").locator('[aria-current="page"]')).toContainText("2027", { timeout: 15_000 });
  await page.getByRole("tab", { name: "Financements" }).click();
  await expect(page.locator("[data-testid^=convention-of-]", { hasText: "2026-2027 · notifié" })).toHaveCount(1);
  await page.goto("/conventions");
  await expect(page.getByTestId("convention-ADEME-TEST-2026-2027")).toContainText("Chroniquer la TESS · 2027");
});
