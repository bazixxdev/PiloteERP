import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Retours de Gaël du 19/09 : la fiche complète d'un appel en panneau (avec une seule description), « Qui aide » = des personnes de
// l'équipe, et les tâches / notes créées depuis un dossier gardent la trace du dossier dans Tâches et Notes.

test("un appel à projets se repère avec une description, s'ouvre en panneau et se complète ; le dossier ouvert en hérite", async ({ page }) => {
  await page.goto("/appels");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/appels");
  await page.getByTestId("call-add-open").click();
  await pick(page, "call-funder", "ADEME");
  await page.getByTestId("call-label").fill("Appel test panneau 2027");
  await page.getByTestId("call-scheme").fill("Axe 3 · alimentation durable");
  await page.getByTestId("call-deadline").fill("2027-03-31");
  await page.getByTestId("call-amount-value").fill("25000");
  await page.getByTestId("call-description").fill("Deux ans, 50 % des dépenses.\nBien pour le lab.");
  await page.getByTestId("call-submit").click();
  await expect(page.getByText("Appel à projets repéré")).toBeVisible();
  const row = page.locator("[data-testid^=call-]", { hasText: "Appel test panneau 2027" }).first();
  await expect(row).toContainText("25 000 €");
  await expect(row).toContainText("Axe 3 · alimentation durable");
  // Le panneau : tout y est, et se modifie en place.
  await row.locator("[data-testid^=call-open-]").click();
  const panel = page.getByTestId("call-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("call-field-description")).toHaveValue(/Deux ans, 50 % des dépenses/);
  await expect(panel.getByTestId("call-field-scheme")).toHaveValue("Axe 3 · alimentation durable");
  await panel.getByTestId("call-field-durationYears").fill("2");
  await panel.getByTestId("call-field-durationYears").blur();
  await expect(row).toContainText("25 000 € global · 2 ans");
  // Ouvrir un dossier : programme, montant et description suivent.
  await panel.locator("[data-testid^=call-promote-]").click();
  await expect(page).toHaveURL(/\/conventions\//);
  await expect(page.locator("input[value='Axe 3 · alimentation durable']")).toHaveCount(1);
  await expect(page.locator("textarea").first()).toHaveValue(/Deux ans, 50 % des dépenses/);
});

test("qui aide = des personnes de l'équipe ; une tâche et une note créées depuis le dossier se retrouvent dans Tâches et Notes avec leur dossier", async ({ page }) => {
  await page.goto("/conventions");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/conventions");
  await page.getByRole("link", { name: /AAP Transition écologique 2027/ }).first().click();
  await expect(page).toHaveURL(/\/conventions\//);
  // Qui aide : Thomas et Élise (seed), on ajoute Camille, on retire Élise.
  const helpers = page.getByTestId("dossier-helpers");
  await expect(helpers).toContainText("Thomas Guérin");
  await expect(helpers).toContainText("Élise Fontaine");
  await pick(page, "dossier-helpers-add", "Camille Aubert");
  await expect(helpers).toContainText("Camille Aubert");
  await helpers.getByRole("button", { name: "Retirer Élise Fontaine" }).click();
  await expect(helpers).not.toContainText("Élise Fontaine");
  // Une tâche avec « !lundi », comme dans Tâches.
  await page.getByTestId("dossier-task-label").fill("Relire le budget avec Thomas !lundi");
  await page.getByTestId("dossier-task-submit").click();
  await expect(page.getByTestId("dossier-tasks")).toContainText("Relire le budget avec Thomas");
  await expect(page.getByTestId("dossier-tasks")).not.toContainText("!lundi");
  // Une note.
  await page.getByTestId("dossier-note-title").fill("Point avec l'ADEME");
  await page.getByTestId("dossier-note-body").fill("Ils attendent le budget détaillé.");
  await page.getByTestId("dossier-note-submit").click();
  await expect(page.getByTestId("dossier-notes")).toContainText("Point avec l'ADEME");
  // Dans Tâches : la tâche porte son dossier, avec le lien et l'échéance lundi.
  await page.goto("/taches");
  const task = page.locator("[data-testid^=task-]", { hasText: "Relire le budget avec Thomas" }).first();
  await expect(task).toBeVisible();
  await expect(task).toContainText("Dossier · AAP Transition écologique 2027");
  await expect(task).toContainText(/Pour (lun\.|demain|aujourd'hui)/);
  await task.locator("[data-testid^=task-dossier-]").click();
  await expect(page).toHaveURL(/\/conventions\//);
  // Dans Notes : la note porte son dossier, et le filtre « Dossier · … » la retrouve.
  await page.goto("/notes");
  await page.locator("[data-testid^=note-link-]", { hasText: "Point avec l'ADEME" }).click();
  await expect(page.getByTestId("note-dossier")).toContainText("Dossier · AAP Transition écologique 2027");
  await pick(page, "notes-filter-project", "Dossier · AAP Transition écologique 2027");
  await page.getByTestId("notes-filter").locator("button[type=submit]").click();
  await expect(page.locator("[data-testid^=note-link-]")).toHaveCount(1);
  await expect(page.locator("[data-testid^=note-link-]").first()).toContainText("Point avec l'ADEME");
});
