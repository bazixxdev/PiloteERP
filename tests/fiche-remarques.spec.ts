import { test, expect } from "@playwright/test";
import { expandLayer, iAm, openEditionByName } from "./helpers";

// Fiche projet : rubriques du gabarit CRESS, remarques par rubrique (comme les commentaires Word), export Word au format du gabarit.
test("la direction pose une remarque sur une rubrique, le pilote la voit en place et la traite ; la fiche s'exporte au format du gabarit", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Claire Vasseur");
  await openEditionByName(page, "Refonte du site internet");

  // Les rubriques du gabarit sont là, remplies (fiche validée : couches repliées, on déplie).
  await expandLayer(page, "proposal");
  await expandLayer(page, "means");
  await expect(page.getByTestId("field-content")).toContainText("UX design");
  await expect(page.getByTestId("field-audience")).toContainText("adhérents");
  await expect(page.getByTestId("field-deliveryDate")).toContainText("30 novembre 2026");
  await expect(page.getByTestId("field-sponsorId")).toContainText("Claire Vasseur");

  // Hors mode relecture, pas de bouton « Remarque » ; la direction active la relecture puis annote « Calendrier ».
  await expect(page.getByTestId("remark-add-calendar")).toHaveCount(0);
  await page.getByTestId("feedback-toggle").click();
  await page.getByTestId("remark-add-calendar").click();
  await page.getByTestId("remark-body-calendar").fill("Les dates jalons a minima : le choix du prestataire et la mise en ligne.");
  await page.getByTestId("remark-submit-calendar").click();
  await expect(page.getByTestId("remarks-calendar")).toContainText("Les dates jalons a minima");
  await expect(page.getByTestId("layer-remarks-proposal")).toContainText("1 remarque à traiter");
  await expect(page.getByTestId("fiche-remarks-banner")).toContainText("1 remarque à traiter");

  // Le pilote la retrouve dans Ma semaine et sur la fiche, puis la traite.
  await iAm(page, "Romain Tessier");
  await page.goto("/ma-semaine");
  await expect(page.getByTestId("remarks-to-treat")).toContainText("Refonte du site internet");
  await page.getByTestId("remarks-to-treat").getByRole("link", { name: /Refonte du site internet/ }).click();
  const remark = page.getByTestId("remarks-calendar").locator("[data-testid^=remark-]", { hasText: "dates jalons" }).first();
  await remark.locator("[data-testid^=remark-resolve-]").click();
  await expect(page.getByTestId("layer-remarks-proposal")).toHaveCount(0);
  await expect(page.getByTestId("remarks-calendar")).toContainText("1 remarque traitée");

  // Les remarques de démonstration (fiche ASER) restent visibles pour tous, en lecture.
  await iAm(page, "Lucas Perrin");
  await page.goto("/portefeuille?perimetre=cress");
  await page.getByRole("link", { name: "PTCE et ESSOR", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("PTCE et ESSOR");
  await expect(page.getByTestId("fiche-remarks-banner")).toContainText("1 remarque à traiter");
  await expect(page.getByTestId("remark-add-calendar")).toHaveCount(0);

  // Export Word au format du gabarit.
  const href = await page.getByTestId("export-fiche").getAttribute("href");
  const res = await page.request.get(href as string);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("wordprocessingml");
});
