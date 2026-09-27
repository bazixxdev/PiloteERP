import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";
import { W } from "./vocab";

// Menu rangé par usage (spec du 27/09) : six sections au plus, les vues en onglets, l'entrée active suit l'onglet.
// Session par défaut de la recette : Claire Vasseur (direction) ; iAm change de personne sans se reconnecter.
test.use({ viewport: { width: 900, height: 800 } }); // sous lg, la barre est un rail d'icônes (rail-<id>)

test("la direction voit six sections ; l'entrée reste active sur un onglet", async ({ page }) => {
  await page.goto("/ma-semaine");
  for (const id of ["travail", "projets", "financements", "reseau", "ressources", "admin"]) await expect(page.getByTestId(`rail-${id}`)).toBeVisible();
  await expect(page.getByTestId("rail-demandes")).toHaveCount(0);
  await page.goto("/conventions?vue=obtenus");
  await expect(page.getByRole("tab", { name: "Obtenus" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("rail-financements")).toHaveAttribute("aria-current", "page");
  await page.goto("/cloture");
  await expect(page.getByRole("tab", { name: "Clôture" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("rail-ressources")).toHaveAttribute("aria-current", "page");
});

test(`sans droit ${W.codir.one} ni admin : pas d'Admin, pas de « À décider »`, async ({ page }) => {
  await page.goto("/ma-semaine");
  await iAm(page, "Lucas Perrin");
  await expect(page.getByTestId("rail-admin")).toHaveCount(0);
  await page.getByTestId("rail-projets").click();
  await expect(page.getByTestId("rail-panel-projets").getByRole("link", { name: "À décider" })).toHaveCount(0);
});
