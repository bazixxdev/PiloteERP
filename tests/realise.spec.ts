import { test, expect } from "@playwright/test";
import { iAm, openEditionByName, pick } from "./helpers";

// Lot D — Réalisé comptable : le grand livre analytique importé (fichier), rapproché des éditions par le code analytique ;
// charges par poste, frais de déplacement, produits face aux versements ; codes inconnus rapprochés dans l'admin ;
// une seule source compte dans les alertes (réglage), l'autre s'affiche en regard.

test("l'onglet Budget lit le réalisé comptable de l'édition : charges, frais, produits, écart avec la saisie RAF", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Nadia Ferrand");
  await openEditionByName(page, "Cycle de conférences transition");
  await page.getByRole("tab", { name: "Budget" }).click();
  const block = page.getByTestId("ledger-block");
  await expect(block).toContainText("Fichier importé");
  await expect(page.getByTestId("ledger-charges")).toHaveText(/8.110/);
  await expect(page.getByTestId("ledger-travel")).toHaveText(/230/);
  await expect(page.getByTestId("ledger-products")).toHaveText(/6.650/);
  // La compta a 12 % de plus que la saisie RAF sur cette édition : l'écart se lit, la saisie reste la source des alertes.
  await expect(page.getByTestId("ledger-gap")).toBeVisible();
  await expect(block).toContainText("c'est lui qui compte");
  await expect(page.getByTestId("ledger-accounts")).toContainText("6251");
  await expect(page.getByTestId("ledger-by-line")).toContainText("ADEME");
  await expect(page.getByTestId("ledger-by-line")).toContainText("Cohérent avec les versements reçus");

  // ORESS : la compta a encaissé 2 500 € de plus que les versements marqués reçus → suggestion, jamais automatique.
  await openEditionByName(page, "Observatoire régional (ORESS)");
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect(page.getByTestId("ledger-by-line")).toContainText(/2.500.€ de plus que les versements reçus/);

  // Mois de l'ESS : la soirée de remise a son propre code, rapproché de l'action.
  await openEditionByName(page, "Mois de l'ESS et Prix ESS");
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect(page.getByTestId("ledger-by-action")).toContainText("Soirée de remise");
  await expect(page.getByTestId("ledger-by-action")).toContainText(/1.820/);
});

test("l'admin importe un fichier, rapproche les codes inconnus, et choisit la source qui compte", async ({ page }) => {
  await page.goto("/admin?section=donnees");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/admin?section=donnees");
  const unknown = page.getByTestId("ledger-unknown");
  await expect(unknown).toContainText("FONCT-2026");
  await expect(unknown).toContainText("TESS-ETUDE");
  // Le loyer, c'est du fonctionnement : à ignorer. L'étude mobilité : une édition.
  await pick(page, "tag-kind-FONCT-2026", { value: "ignore" });
  await page.getByTestId("tag-submit-FONCT-2026").click();
  await expect(page.getByText("Code FONCT-2026 rapproché")).toBeVisible();
  await pick(page, "tag-kind-TESS-ETUDE", { value: "edition" });
  await pick(page, "tag-target-TESS-ETUDE", "Carte et ressource TESS · 2026");
  await page.getByTestId("tag-submit-TESS-ETUDE").click();
  await expect(page.getByText("Code TESS-ETUDE rapproché")).toBeVisible();
  await expect(page.getByTestId("ledger-unknown")).toHaveCount(0);
  await expect(page.getByTestId("ledger-tags")).toContainText("TESS-ETUDE");

  // Import d'un csv : remplace le snapshot « fichier » de 2026 (idempotent), les pièces se lisent sur l'édition.
  const csv = ["code analytique;compte;libellé compte;date;pièce;tiers;libellé;débit;crédit", "TES-02;6226;Honoraires;12/03/2026;AC-1;Cabinet Test;Prestation test;1200,50;0", "TES-02;6251;Voyages et déplacements;15/04/2026;NDF-7;Note de frais;Train;99,50;0", "TES-02-ADE;7411;Subventions;20/04/2026;VT-2;ADEME;Acompte;0;4250"].join("\n");
  await page.getByTestId("ledger-year").fill("2026");
  await page.getByTestId("ledger-file").setInputFiles({ name: "grand-livre-test.csv", mimeType: "text/csv", buffer: Buffer.from("﻿" + csv, "utf8") });
  await page.getByTestId("ledger-import-submit").click();
  await expect(page.getByText(/3 écritures lues, 3 lignes agrégées pour 2026/)).toBeVisible();
  await expect(page.getByTestId("ledger-imports")).toContainText("grand-livre-test.csv");
  await openEditionByName(page, "Cycle de conférences transition");
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect(page.getByTestId("ledger-charges")).toHaveText(/1.300/);
  await expect(page.getByTestId("ledger-travel")).toHaveText(/100/);
  await expect(page.getByTestId("ledger-accounts")).toContainText("Cabinet Test");

  // La source qui compte : la compta remplace la saisie RAF dans le « Réalisé » de l'enveloppe, puis retour.
  await page.goto("/admin?section=parametres");
  await pick(page, "realized-source-select", { value: "ledger" });
  await page.waitForTimeout(800);
  await openEditionByName(page, "Cycle de conférences transition");
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect(page.getByTestId("budget-realized")).toHaveText(/1.300/);
  await expect(page.getByTestId("ledger-block")).toContainText("compte dans les alertes d'enveloppe");
  await page.goto("/admin?section=parametres");
  await pick(page, "realized-source-select", { value: "raf" });
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByTestId("realized-source-select")).toHaveAttribute("data-value", "raf");
});
