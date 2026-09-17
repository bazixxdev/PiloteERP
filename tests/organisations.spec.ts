import { test, expect } from "@playwright/test";
import { iAm, openEditionByName, pick } from "./helpers";

// Lot E2 — Organisations unifiées : un annuaire (financeurs, fournisseurs, partenaires, réseaux, collectivités), des genres
// cumulables, des contacts qui se détachent sans s'effacer, des partenaires liés à l'édition. Les écrans Financeurs et les
// devis (fournisseurs) continuent de fonctionner sur la même table — les tests existants en sont la preuve.

test("l'annuaire liste tout, filtre par genre, crée une organisation et cumule les genres ; un contact parti se détache", async ({ page }) => {
  await page.goto("/organisations");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/organisations");
  const table = page.getByTestId("organisations-table");
  await expect(table).toContainText("Région");
  await expect(table).toContainText("Atelier Graphique Loire"); // un fournisseur, dans le même annuaire
  await page.getByTestId("kind-supplier").click();
  await expect(page.getByTestId("organisations-table")).not.toContainText("Banque des Territoires");
  await expect(page.getByTestId("organisations-table")).toContainText("Atelier Graphique Loire");
  await page.getByTestId("kind-funder").click();
  await expect(page.getByTestId("organisations-table")).toContainText("Banque des Territoires");

  // Nouvelle organisation : partenaire et réseau.
  await page.getByTestId("organisation-add-open").click();
  await page.getByTestId("organisation-add-name").fill("Réseau test des tiers-lieux");
  await page.getByTestId("organisation-add-kind-network").check();
  await page.getByTestId("organisation-add-submit").click();
  const panel = page.getByTestId("organisation-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Partenaire · Réseau");
  // Un genre de plus (fournisseur), un doublon refusé.
  await panel.getByTestId("organisation-kind-supplier").click();
  await expect(panel).toContainText("Fournisseur · Partenaire · Réseau");
  await page.keyboard.press("Escape");
  await page.getByTestId("organisation-add-open").click();
  await page.getByTestId("organisation-add-name").fill("réseau test des tiers-lieux");
  await page.getByTestId("organisation-add-submit").click();
  await expect(page.getByText("existe déjà")).toBeVisible();
  await page.keyboard.press("Escape");

  // Contacts : la Région garde ses interlocuteurs ; Hélène part, elle se détache sans disparaître, puis revient.
  await page.goto("/organisations?genre=funder");
  await page.getByRole("link", { name: "Région", exact: true }).click();
  const org = page.getByTestId("organisation-panel");
  await expect(org).toContainText("Hélène");
  await org.locator("[data-testid^=contact-left-]").first().click();
  await expect(org.getByTestId("contacts-left")).toContainText(/parti·e le/);
  await expect(org).toContainText("Karim"); // l'autre contact reste le principal
  await org.locator("[data-testid^=contact-back-]").first().click();
  await expect(org.getByTestId("contacts-left")).not.toContainText(/parti·e le/);
});

test("une édition lie ses partenaires depuis l'annuaire ou par un nouveau nom ; l'organisation les liste en retour", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Thomas Guérin");
  await openEditionByName(page, "Cycle de conférences transition");
  await page.getByRole("tab", { name: "Fiche" }).click();
  const section = page.getByTestId("partners-section");
  await expect(section).toContainText("Université de Tours");
  await section.getByTestId("partner-add-open").click();
  await pick(page, "partner-org", "France Active");
  await page.getByTestId("partner-role").fill("Finance les projets accompagnés");
  await page.getByTestId("partner-submit").click();
  await expect(section.getByTestId("partners-list")).toContainText("France Active Centre-Val de Loire");
  // Un partenaire qui n'est pas encore dans l'annuaire : il y entre comme partenaire.
  await section.getByTestId("partner-add-open").click();
  await page.getByTestId("partner-name").fill("Lycée agricole de Tours-Fondettes");
  await page.getByTestId("partner-submit").click();
  await expect(section.getByTestId("partners-list")).toContainText("Lycée agricole de Tours-Fondettes");
  await page.goto("/organisations?genre=partner");
  await expect(page.getByTestId("organisations-table")).toContainText("Lycée agricole de Tours-Fondettes");
  await page.getByRole("link", { name: "Lycée agricole de Tours-Fondettes" }).click();
  await expect(page.getByTestId("organisation-dossiers")).toContainText("Cycle de conférences transition 2026");
  // Retirer le lien depuis l'édition.
  await openEditionByName(page, "Cycle de conférences transition");
  await page.getByRole("tab", { name: "Fiche" }).click();
  await page.getByTestId("partners-section").locator("[data-testid^=partner-remove-]").last().click();
  await expect(page.getByTestId("partners-section")).not.toContainText("Lycée agricole");
});
