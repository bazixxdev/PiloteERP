import { test, expect } from "@playwright/test";
import { openEditionByName, pick } from "./helpers";
import { W, cap, pl } from "./vocab";

// Financements de l'action (26/09) : lier la ligne 2026 d'un dossier pluriannuel (CPO Région 2025-2027 du seed) à une action
// qui court sur 2026–2027 lie aussi la ligne 2027 du même dossier ; un montant nourrit l'équilibre ; au-delà de l'obtenu, l'année
// porte une alerte ; retirer un lien ne retire que lui. Années fixes : celles du dossier du seed. L'action créée est supprimée
// à la fin : rien du jeu de démo ne bouge.
test("lier une ligne d'un dossier pluriannuel, montant, équilibre, alerte de dépassement, retrait", async ({ page }) => {
  await openEditionByName(page, "Vœux et assemblée générale");
  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Financement recette pluriannuel");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  const actionUrl = page.url().split("?")[0];

  // Période sur deux années.
  await page.getByTestId("period-start").fill("2026-01-01");
  await page.getByTestId("period-end").fill("2027-12-31");
  await page.getByTestId("period-submit").click();
  await expect(page.getByText("Période enregistrée")).toBeVisible();

  // Lier la ligne 2026 : la ligne 2027 du même dossier suit (2025 n'est pas couverte).
  await page.goto(`${actionUrl}?annee=2026`);
  const section = page.getByTestId("action-fundings");
  await expect(section.getByTestId("fundings-empty")).toBeVisible();
  await section.getByTestId("funding-add").click();
  await pick(page, "funding-add-line", "Région · 2026");
  await section.getByTestId("funding-add-submit").click();
  await expect(page.getByText("Rattachée à 2 lignes du dossier")).toBeVisible();
  await expect(section.locator("[data-testid^=funding-row-]")).toHaveCount(2);
  await expect(section.getByTestId("funding-year-0")).toHaveText("2026");
  await expect(section.getByTestId("funding-year-1")).toHaveText("2027");

  // Un montant sur la ligne 2026 : il fait les recettes de l'équilibre 2026, pas de 2027.
  await section.getByTestId("funding-amount-0").fill("3000");
  await section.getByTestId("funding-amount-0").press("Enter");
  await expect(section.getByTestId("balance-income")).toHaveText(/3\s000/);
  await expect(section.getByTestId("balance-gap")).toHaveText(/3\s000/);
  await page.goto(`${actionUrl}?annee=2027`);
  await expect(page.getByTestId("action-fundings").getByTestId("balance-income")).toHaveText(/^0\s€$/);

  // Au-delà de l'obtenu de la ligne (4 600 € dans le seed) : la ligne le dit, l'année 2026 porte l'alerte.
  await page.goto(`${actionUrl}?annee=2026`);
  await section.getByTestId("funding-amount-0").fill("5000");
  await section.getByTestId("funding-amount-0").press("Enter");
  await expect(section.getByTestId("funding-share-0")).toContainText("au-delà");
  await page.getByTestId("action-back").click();
  await expect(page.getByTestId("alert-funding_over")).toContainText("Région");

  // Retirer le lien 2026 : le lien 2027 reste ; puis le retirer aussi. L'alerte s'éteint.
  await page.goto(`${actionUrl}?annee=2026`);
  page.once("dialog", (d) => d.accept());
  await section.getByTestId("funding-unlink-0").click();
  await expect(page.getByText("Lien retiré")).toBeVisible();
  await expect(section.locator("[data-testid^=funding-row-]")).toHaveCount(1);
  await expect(section.getByTestId("funding-year-0")).toHaveText("2027");
  page.once("dialog", (d) => d.accept());
  await section.getByTestId("funding-unlink-0").click();
  await expect(section.getByTestId("fundings-empty")).toBeVisible();
  await page.getByTestId("action-back").click();
  await expect(page.getByTestId("actions-table")).toBeVisible();
  await expect(page.getByTestId("alert-funding_over")).toHaveCount(0);

  // Ménage : l'action créée pour le test part (ni heures ni dépenses).
  await page.goto(actionUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("action-delete").click();
  await expect(page).not.toHaveURL(new RegExp(actionUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
