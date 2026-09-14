import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Lot 3 « Demandes, devis, factures, documents » : un seul tableau des demandes, bon pour accord à la validation d'un devis,
// facture reçue → service fait → payée avec le pilote prévenu, règle des documents écrite.

test("une demande interne se dépose, arrive chez l'assistante, devient une tâche puis est faite ; le demandeur est prévenu", async ({ page }) => {
  await page.goto("/demandes");
  await iAm(page, "Inès Cabral");
  await page.getByTestId("new-request").click();
  await page.getByTestId("request-kind-assistant").click();
  await page.getByTestId("request-title").fill("Réserver la salle du CA pour le jury du Prix");
  const to = page.getByTestId("request-to");
  const opt = await to.locator("option", { hasText: "Léa Morin" }).getAttribute("value");
  await to.selectOption(opt!);
  await page.getByTestId("request-due").fill("2026-09-25");
  await page.getByTestId("request-submit").click();
  await expect(page.getByText("Demande envoyée")).toBeVisible();
  await page.goto("/demandes?vue=mes");
  await expect(page.getByTestId("requests-open")).toContainText("Réserver la salle du CA pour le jury du Prix");

  // L'assistante la trouve dans « À traiter par moi » (avec le compteur de la barre), en fait une tâche, puis la marque faite.
  await iAm(page, "Léa Morin");
  await page.goto("/demandes");
  const line = page.locator("[data-testid^=request-line-]", { hasText: "jury du Prix" });
  await expect(line).toBeVisible();
  await expect(page.locator("aside").first().getByRole("link", { name: /Demandes/ })).toContainText("2");
  await line.locator("[data-testid^=request-task-]").click();
  await expect(page.getByText("Tâche créée dans votre liste")).toBeVisible();
  await page.goto("/taches");
  await expect(page.getByTestId("list-unlisted")).toContainText("Réserver la salle du CA pour le jury du Prix (demande de Inès Cabral)");
  await page.goto("/demandes");
  await line.locator("[data-testid^=request-done-]").click();
  await expect(page.getByText("Demande faite, le demandeur est prévenu")).toBeVisible();
  await iAm(page, "Inès Cabral");
  await page.goto("/ma-semaine");
  await expect(page.getByTestId("unread-notifications")).toContainText("Demande faite : Réserver la salle du CA pour le jury du Prix");
});

test("un devis approuvé produit un bon pour accord ; la facture est reçue, le service fait confirmé, puis payée — le pilote est prévenu à chaque étape", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Inès Cabral");
  await openEditionByName(page, "AIESSE et campagnes électorales");
  // Demande de devis avec fournisseur et adresse.
  await page.getByRole("button", { name: "Demander une validation" }).click();
  await page.getByTestId("rv-label").fill("Devis impression de la lettre AIESSE");
  await page.getByTestId("rv-amount").fill("420");
  await page.getByTestId("rv-supplier").fill("Imprimerie Duval");
  await page.getByTestId("rv-supplier-email").fill("devis@duval.exemple.fr");
  await page.getByTestId("rv-submit").click();
  await expect(page.getByText("Devis impression de la lettre AIESSE")).toBeVisible();
  // Le responsable de pôle approuve : la direction est informée, le demandeur a son bon pour accord.
  await iAm(page, "Julien Barbot");
  await page.goto("/validations");
  const card = page.getByTestId("for-me").locator("[data-testid^=validation-]", { hasText: "Devis impression de la lettre AIESSE" });
  await card.getByTestId("approve").click();
  await expect(page.getByText("Approuvée : le montant est engagé")).toBeVisible();
  await iAm(page, "Inès Cabral");
  await page.goto("/ma-semaine");
  await page.getByTestId("unread-notifications").getByRole("link", { name: /Approuvée : Devis impression/ }).click();
  await expect(page.getByTestId("bpa-to")).toContainText("devis@duval.exemple.fr");
  await expect(page.getByTestId("bpa-body")).toContainText("420");
  await expect(page.getByTestId("bpa-body")).toContainText("factures@cress-cvl.example");
  await expect(page.getByTestId("bpa-mailto")).toHaveAttribute("href", /mailto:devis%40duval/);
  // La RAF marque la facture reçue : le pilote est prévenu et confirme le service fait ; puis payée.
  await iAm(page, "Nadia Ferrand");
  await openEditionByName(page, "AIESSE et campagnes électorales");
  await page.getByRole("tab", { name: /Budget/ }).click();
  const row = page.getByTestId("expenses").locator("tbody tr").last(); // la dépense créée à l'instant (ordre de création)
  await row.locator("[data-testid^=invoice-received-]").click();
  await expect(row).toContainText("Reçue le");
  await iAm(page, "Inès Cabral");
  await page.goto("/ma-semaine");
  await expect(page.getByTestId("unread-notifications")).toContainText("Facture reçue · Devis impression");
  await openEditionByName(page, "AIESSE et campagnes électorales");
  await page.getByRole("tab", { name: /Budget/ }).click();
  await page.getByTestId("expenses").locator("tr", { hasText: "Devis impression de la lettre AIESSE" }).locator("[data-testid^=service-done-]").check();
  await expect(page.getByText("Service fait confirmé")).toBeVisible();
  await iAm(page, "Nadia Ferrand");
  await openEditionByName(page, "AIESSE et campagnes électorales");
  await page.getByRole("tab", { name: /Budget/ }).click();
  const row2 = page.getByTestId("expenses").locator("tbody tr").last();
  await expect(row2).toContainText("Service fait · Inès Cabral");
  await row2.locator("[data-testid^=invoice-paid-]").click();
  await expect(row2).toContainText("Payée le");
  // Règle des documents, écrite dans l'onglet Documents.
  await page.getByRole("tab", { name: /Documents/ }).click();
  await expect(page.getByTestId("documents-rule")).toContainText("Trois familles");
});

test("chacun ne voit que les demandes qui le concernent : son pôle pour un responsable, ses projets pour un pilote, tout pour la direction", async ({ page }) => {
  await page.goto("/demandes");
  await iAm(page, "Inès Cabral"); // pilote, pôle Observatoire
  await page.getByTestId("new-request").click();
  await page.getByTestId("request-kind-assistant").click();
  await page.getByTestId("request-title").fill("Commander les badges du jury");
  const to = page.getByTestId("request-to");
  await to.selectOption((await to.locator("option", { hasText: "Léa Morin" }).getAttribute("value"))!);
  await page.getByTestId("request-submit").click();
  await expect(page.getByText("Demande envoyée")).toBeVisible();
  // Un pilote d'un autre pôle : pas d'onglet « Toute la CRESS », et la demande n'apparaît nulle part.
  await iAm(page, "Hugo Lemaire");
  await page.goto("/demandes?vue=toutes");
  await expect(page.getByTestId("requests-view-toutes")).toContainText("Mes projets");
  await expect(page.getByTestId("requests-open")).not.toContainText("Commander les badges du jury");
  // L'assistante destinataire n'a que « À traiter par moi » et « Mes demandes ».
  await iAm(page, "Léa Morin");
  await page.goto("/demandes");
  await expect(page.getByTestId("requests-view-toutes")).toHaveCount(0);
  await expect(page.getByTestId("requests-open")).toContainText("Commander les badges du jury");
  // Le responsable du pôle d'Inès la voit dans « Mon pôle ».
  await iAm(page, "Julien Barbot");
  await page.goto("/demandes?vue=toutes");
  await expect(page.getByTestId("requests-view-toutes")).toContainText("Mon pôle");
  await expect(page.getByTestId("requests-open")).toContainText("Commander les badges du jury");
  // Le responsable de l'autre pôle, non.
  await iAm(page, "Sophie Delaunay");
  await page.goto("/demandes?vue=toutes");
  await expect(page.getByTestId("requests-open")).not.toContainText("Commander les badges du jury");
  // La direction voit tout.
  await iAm(page, "Claire Vasseur");
  await page.goto("/demandes?vue=toutes");
  await expect(page.getByTestId("requests-view-toutes")).toContainText("Toute la CRESS");
  await expect(page.getByTestId("requests-open")).toContainText("Commander les badges du jury");
});
