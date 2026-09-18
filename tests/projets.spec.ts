import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Projets (lot 1 du 19/09) : une liste sobre avec l'état, triable et filtrable ; une fiche par projet qui porte le paramétrage
// (raison d'être, pôle, pilote, garant, code), ses éditions, ses financements, son équipe ; l'archivage.

test("la liste des projets dit l'état ; la fiche porte l'identité, les éditions et les financements ; un projet s'archive", async ({ page }) => {
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  await page.goto("/projets");
  const table = page.getByTestId("projects-table");
  await expect(table).toContainText("PTCE et ESSOR");
  await expect(page.locator("[data-testid^=project-row-][data-state=active]").first()).toBeVisible();
  // Le tableau ne porte plus le paramétrage : pas de champ modifiable, un état par ligne.
  await expect(table.locator("select")).toHaveCount(0);
  // Filtre par état, tri par pôle.
  await page.getByTestId("projects-state-active").click();
  await expect(page.locator("[data-testid^=project-row-]:not([data-state=active])")).toHaveCount(0);
  await page.getByTestId("projects-state-all").click();
  await page.getByTestId("projects-sort-pole").click();
  await expect(page.getByTestId("projects-sort-pole")).toContainText("↓");
  // La fiche.
  await page.getByTestId("projects-search").fill("PTCE");
  await page.getByTestId("projects-search").press("Enter");
  await page.locator("[data-testid^=project-open-]").first().click();
  await expect(page.getByTestId("project-page")).toBeVisible();
  await expect(page.getByTestId("project-editions")).toContainText("2026");
  await expect(page.getByTestId("project-fundings")).toContainText("€");
  await expect(page.getByTestId("project-team")).toContainText("pilote");
  await expect(page.getByTestId("breadcrumb")).toContainText("Fiche projet");
  // Le paramétrage se fait ici : le garant change, l'axe stratégique se remplit.
  await pick(page, "project-guarantorId", "Julien Barbot");
  await page.getByTestId("project-strategicAxis").fill("Coopérations territoriales");
  await page.getByTestId("project-strategicAxis").blur();
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByTestId("project-strategicAxis")).toHaveValue("Coopérations territoriales");
  // Archiver : le projet sort de la liste courante, se retrouve sous « Archivé ».
  await page.getByTestId("project-archived").check();
  await expect(page.getByTestId("project-page")).toHaveAttribute("data-state", "archived");
  await page.goto("/projets");
  await expect(page.getByTestId("projects-table")).not.toContainText("PTCE et ESSOR");
  await page.getByTestId("projects-state-archived").click();
  await expect(page.getByTestId("projects-table")).toContainText("PTCE et ESSOR");
  // Un pilote lit la fiche sans la modifier.
  await page.locator("[data-testid^=project-open-]").first().click();
  await iAm(page, "Maxime Roussel");
  await expect(page.getByTestId("project-strategicAxis")).toHaveAttribute("data-readonly", "true");
});
