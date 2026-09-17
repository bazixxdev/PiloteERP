import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Contacts et listes (18/09) : un annuaire commun, des listes à soi avec leurs colonnes, import de fichier (en-tête reconnu,
// titres au-dessus ignorés, contacts connus complétés), export CSV, visibilité par liste.

test("une liste se crée avec ses colonnes, se remplit depuis l'annuaire ou par un nouveau contact, s'exporte", async ({ page }) => {
  await page.goto("/contacts");
  await iAm(page, "Thomas Guérin");
  await page.goto("/contacts");
  await expect(page.getByTestId("contacts-table")).toContainText("Marius Garnier");
  // Une liste d'invités, partagée avec le pôle.
  await page.getByTestId("new-contact-list").first().click();
  await page.getByTestId("new-contact-list-name").fill("Invités test");
  await page.getByTestId("new-contact-list-vis-pole").check();
  await page.getByTestId("new-contact-list-submit").click();
  await expect(page.getByTestId("contacts-main")).toHaveAttribute("data-name", "Invités test");
  // Une colonne « Confirmé » (case), une colonne « Repas » (liste de valeurs).
  const settings = page.locator("[data-testid^=contact-list-settings-]");
  await settings.click();
  await page.getByTestId("add-field-label").fill("Confirmé");
  await page.getByTestId("add-field-submit").click();
  await expect(page.getByText("Colonne ajoutée")).toBeVisible();
  await page.getByTestId("add-field-label").fill("Repas");
  await pick(page, "add-field-type", "Liste de valeurs");
  await page.getByTestId("add-field-options").fill("Végétarien, Classique");
  await page.getByTestId("add-field-submit").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("col-confirme")).toBeVisible();
  await expect(page.getByTestId("col-repas")).toBeVisible();
  // Depuis l'annuaire : Fatou ; puis un nouveau contact créé au passage.
  await page.getByTestId("contact-list-add").click();
  await pick(page, "add-existing-contact", "Fatou Diallo");
  await page.getByTestId("add-existing-role").fill("Élue");
  await page.getByTestId("add-existing-submit").click();
  await expect(page.getByTestId("contact-list-table")).toContainText("Fatou Diallo");
  await page.getByTestId("add-mode-new").click();
  await page.getByTestId("add-new-lastName").fill("Testeur");
  await page.getByTestId("add-new-firstName").fill("Pierre");
  await page.getByTestId("add-new-email").fill("p.testeur@exemple.fr");
  await page.getByTestId("add-new-submit").click();
  await expect(page.getByTestId("contact-list-table")).toContainText("Pierre Testeur");
  await expect(page.getByTestId("contact-list-count")).toContainText("2 contacts");
  // Les colonnes propres se remplissent en place.
  const row = page.locator("tr", { hasText: "Pierre Testeur" });
  await row.locator("[data-testid^=cell-confirme-]").check();
  await pick(page, row.locator("[data-testid^=cell-repas-]"), "Végétarien");
  await page.reload();
  await expect(page.locator("tr", { hasText: "Pierre Testeur" }).locator("[data-testid^=cell-confirme-]")).toBeChecked();
  // L'export porte les colonnes communes et propres.
  const href = (await page.getByTestId("contact-list-export").getAttribute("href"))!;
  const csv = await (await page.request.get(href)).text();
  expect(csv).toContain("Nom;Prénom;E-mail");
  expect(csv).toContain("Confirmé;Repas");
  expect(csv).toContain("Testeur;Pierre;p.testeur@exemple.fr");
  expect(csv).toMatch(/oui;Végétarien/);
  // Le nouveau contact est dans l'annuaire, avec sa liste.
  await page.goto("/contacts?q=testeur");
  await expect(page.getByTestId("contacts-table")).toContainText("Pierre Testeur");
});

test("l'import lit un fichier avec des titres au-dessus, propose la correspondance, complète les contacts connus", async ({ page }) => {
  await page.goto("/contacts");
  await iAm(page, "Thomas Guérin");
  await page.goto("/contacts");
  await page.getByTestId("contact-lists").locator('[data-name="Réseau développeurs ESS"]').click();
  await expect(page.getByTestId("contact-list-count")).toContainText("4 contacts");
  await page.getByTestId("contact-list-import").click();
  const csv = [
    "ANNUAIRE DU RESEAU;;;;;;",
    "MAJ 18/06/2026;;;;;;",
    "Nom;Prenom;Mail;Téléphone;Structure;Territoire;Charte",
    "Garnier;Marius;m.garnier@exemple.fr;06 12 00 00 01;Initiative Loiret;Loiret;oui",
    "Nouveau;Ali;a.nouveau@exemple.fr;;Tiers-lieu de Vierzon;Cher;",
    "Sans-Mail;Jeanne;;02 00 00 00 99;;Indre;oui",
  ].join("\n");
  await page.getByTestId("import-file").setInputFiles({ name: "annuaire.csv", mimeType: "text/csv", buffer: Buffer.from("﻿" + csv, "utf8") });
  await page.getByTestId("import-analyse").click();
  const mapping = page.getByTestId("import-mapping");
  await expect(mapping).toBeVisible();
  await expect(mapping).toContainText("Prenom");
  // Les en-têtes connus sont reconnus d'office ; « Territoire » et « Charte » tombent sur les colonnes propres de la liste.
  await expect(page.getByTestId("import-map-0")).toHaveAttribute("data-value", "lastName");
  await expect(page.getByTestId("import-map-2")).toHaveAttribute("data-value", "email");
  await expect(page.getByTestId("import-map-5")).toHaveAttribute("data-value", "field:territoire");
  // « Charte » ne se devine pas (la colonne s'appelle « Charte signée ») : on le dit.
  await pick(page, "import-map-6", "Charte signée");
  await page.getByTestId("import-run").click();
  await expect(page.getByText(/2 ajoutés à la liste/)).toBeVisible();
  await expect(page.getByTestId("contact-list-count")).toContainText("6 contacts");
  await expect(page.getByTestId("contact-list-table")).toContainText("Ali Nouveau");
  await expect(page.getByTestId("contact-list-table")).toContainText("Jeanne Sans-Mail");
  // Marius, déjà connu, n'est pas dupliqué.
  await expect(page.getByTestId("contact-list-table").locator("tr", { hasText: "Marius Garnier" })).toHaveCount(1);
  await expect(page.locator("tr", { hasText: "Ali Nouveau" }).locator("[data-testid^=cell-territoire-]")).toHaveAttribute("data-value", "Cher");
});

test("une liste partagée au pôle se lit chez un collègue du pôle, en lecture ; une liste privée ne se voit pas", async ({ page }) => {
  await page.goto("/contacts");
  await iAm(page, "Camille Aubert"); // même pôle que Thomas
  await page.goto("/contacts");
  const shared = page.getByTestId("shared-contact-lists");
  await expect(shared).toContainText("Réseau développeurs ESS");
  await expect(shared).not.toContainText("Invités · soirée"); // liste privée d'Élise
  await shared.locator('[data-name="Réseau développeurs ESS"]').click();
  await expect(page.getByTestId("contact-list-table")).toContainText("Fatou Diallo");
  await expect(page.getByTestId("contact-list-add")).toHaveCount(0);
  await expect(page.locator("[data-testid^=contact-list-settings-]")).toHaveCount(0);
  await expect(page.locator("tr", { hasText: "Fatou Diallo" }).locator("[data-testid^=cell-charte-]")).toBeDisabled();
});
