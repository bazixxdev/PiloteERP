import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Trésorerie (18/09) : le plan sur douze mois se calcule depuis les dossiers (versements attendus, factures, cotisations) et
// les règles saisies ; solde de départ et seuil ; point bas ; export ; accès réservé (direction, RAF, responsables de pôle).

const now = new Date();
const ym = (n: number) => { const d = new Date(now.getFullYear(), now.getMonth() + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

test("la RAF tient le plan : règle mensuelle, flux ponctuel, solde de départ ; le solde suit, le point bas se lit ; un pilote n'y accède pas", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/tresorerie");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/tresorerie");
  // Le seed : solde de départ, règles, versements attendus des financeurs (dont un en retard), cotisations à régler.
  await expect(page.getByTestId("tile-opening")).toContainText("148");
  await expect(page.getByTestId("treasury-table")).toContainText("Salaires et charges");
  await expect(page.getByTestId("treasury-table")).toContainText("Versements des financeurs");
  await expect(page.getByTestId("treasury-table")).toContainText("Cotisations");
  await expect(page.getByTestId("col-current")).toContainText("en cours");
  await expect(page.getByTestId("treasury-chart")).toBeVisible();
  // Sous-onglets : recettes attendues (versements calculés, dont un en retard), charges, ressources humaines, réel.
  await page.getByTestId("treasury-tab-recettes").click();
  await expect(page.getByTestId("flows-in-table")).toContainText("en retard");
  await expect(page.getByTestId("flows-in-table")).toContainText("Versement attendu");
  await pick(page, "flows-in-source", "Saisie");
  await expect(page.getByTestId("flows-in-table")).not.toContainText("Versement attendu");
  await pick(page, "flows-in-group", "rien");
  await expect(page.locator("[data-testid=flows-in-group-row]")).toHaveCount(0);
  await page.getByTestId("treasury-tab-rh").click();
  await expect(page.getByTestId("rules-hr")).toContainText("Alternance communication");
  await expect(page.getByTestId("hr-total")).toContainText("€");
  await page.getByTestId("new-rule-hr").click();
  await page.getByTestId("rule-label").fill("Chargé·e de mission alimentation (CDD)");
  await page.getByTestId("rule-amount").fill("2800");
  await page.getByTestId("rule-start").fill(ym(2));
  await page.getByTestId("rule-end").fill(ym(8));
  await page.getByTestId("rule-notes").fill("remplacement congé maternité");
  await page.getByTestId("rule-submit").click();
  await expect(page.getByText("Ressource ajoutée")).toBeVisible();
  await expect(page.getByTestId("rules-hr")).toContainText("remplacement congé maternité");
  await page.getByTestId("treasury-tab-reel").click();
  await expect(page.getByTestId("treasury-actuals")).toBeVisible();
  await page.getByTestId("treasury-tab-plan").click();
  const before = Number(await page.getByTestId(`balance-${ym(1)}`).getAttribute("data-value"));
  // Une règle mensuelle de plus : chaque mois baisse d'autant.
  await page.getByTestId("new-rule").click();
  await expect(page.locator("[data-testid^=rule-direction-]")).toHaveCount(0); // le sens vient du bouton, pas d'une bascule
  await page.getByTestId("rule-label").fill("Maintenance informatique");
  await pick(page, "rule-category", "Prestataires");
  await page.getByTestId("rule-amount").fill("1000");
  await page.getByTestId("rule-start").fill(ym(0));
  await page.getByTestId("rule-submit").click();
  await expect(page.getByText("Charge ajoutée")).toBeVisible();
  await expect(page.getByTestId("row-out-Prestataires")).toBeVisible();
  await expect.poll(async () => page.getByTestId(`balance-${ym(1)}`).getAttribute("data-value")).not.toBe(String(before));
  const after = Number(await page.getByTestId(`balance-${ym(1)}`).getAttribute("data-value"));
  expect(before - after).toBe(2000); // deux mois écoulés (mois de départ et le suivant) × 1 000 €
  // Un flux ponctuel : seul son mois bouge.
  const m3before = Number(await page.getByTestId(`balance-${ym(3)}`).getAttribute("data-value"));
  await page.getByTestId("new-rule-in").click();
  await page.getByTestId("rule-label").fill("Remboursement formation OPCO");
  await page.getByTestId("rule-amount").fill("4000");
  await pick(page, "rule-period", "Une fois");
  await page.getByTestId("rule-start").fill(ym(3));
  await page.getByTestId("rule-submit").click();
  await expect(page.getByText("Recette ajoutée")).toBeVisible();
  await expect(page.getByTestId("row-in-Autres encaissements")).toContainText("4 000");
  await expect.poll(async () => page.getByTestId(`balance-${ym(3)}`).getAttribute("data-value")).not.toBe(String(m3before));
  expect(Number(await page.getByTestId(`balance-${ym(1)}`).getAttribute("data-value"))).toBe(after); // avant le mois du flux : rien ne bouge
  // Onglet Charges : décocher une ligne la sort du plan sans la supprimer ; le commentaire se lit.
  await page.getByTestId("treasury-tab-charges").click();
  const rule = page.locator('[data-testid^=flow-][data-label="Maintenance informatique"]');
  await expect(rule).toBeVisible();
  await rule.locator("[data-testid^=rule-active-]").uncheck();
  await expect(page.getByTestId("flows-out-table")).toContainText("Loyer des locaux");
  await expect(page.getByTestId("flows-out-table")).toContainText("Engagement à facturer");
  await page.getByTestId("flows-out-filter").fill("loyer");
  await expect(page.getByTestId("flows-out-table")).not.toContainText("Engagement à facturer");
  await page.getByTestId("flows-out-filter").fill("");
  await page.getByTestId("treasury-tab-plan").click();
  await expect(page.getByTestId("row-out-Prestataires")).toHaveCount(0);
  // Un changement qui ne vaut qu'à partir d'un mois (loyer qui augmente) : l'ancien montant reste avant.
  await page.getByTestId("treasury-tab-charges").click();
  const loyer = page.locator('[data-testid^=flow-][data-label="Loyer des locaux"]');
  await loyer.locator("[data-testid^=rule-edit-]").click();
  await page.getByTestId("rule-amount").fill("2600");
  await page.getByTestId("rule-from-mode").check();
  await page.getByTestId("rule-from").fill(ym(4));
  await page.getByTestId("rule-submit").click();
  await expect(page.getByText(/Nouveau montant à partir de/)).toBeVisible();
  await expect(page.locator('[data-testid^=flow-][data-label="Loyer des locaux"]')).toHaveCount(2);
  await page.getByTestId("treasury-tab-plan").click();
  const row = page.getByTestId("row-out-Loyer et charges locatives");
  await expect(row).toContainText("2 400");
  await expect(row).toContainText("2 600");
  // Solde de départ : tout le plan se décale ; un seuil haut fait passer des mois sous le seuil.
  await page.getByTestId("treasury-opening").click();
  await page.getByTestId("opening-balance").fill("20000");
  await page.getByTestId("opening-threshold").fill("50000");
  await page.getByTestId("opening-submit").click();
  await expect(page.getByText("Solde de départ enregistré")).toBeVisible();
  await expect(page.getByTestId("tile-opening")).toContainText("20 000");
  await expect(page.getByText(/mois sous le seuil/)).toBeVisible();
  // Export.
  const href = (await page.getByTestId("treasury-export").getAttribute("href"))!;
  const csv = await (await page.request.get(href)).text();
  expect(csv).toContain("Solde fin de mois");
  expect(csv).toContain("Salaires et charges;Décaissement");
  // Un pilote ne voit ni la rubrique ni la page ; un responsable de pôle lit sans modifier.
  await iAm(page, "Maxime Roussel");
  await page.goto("/tresorerie");
  await expect(page.getByTestId("treasury-denied")).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan de trésorerie" })).toHaveCount(0);
  await iAm(page, "Julien Barbot");
  await page.goto("/tresorerie");
  await expect(page.getByTestId("treasury-table")).toBeVisible();
  await expect(page.getByTestId("new-rule")).toHaveCount(0);
});
