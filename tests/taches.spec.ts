import { test, expect } from "@playwright/test";
import { iAm, openEditionByName, pick } from "./helpers";

// To-do personnelle : une tâche privée, son échéance (pour quand) et ses créneaux (quand je m'y mets), visibles dans Ma semaine et dans l'agenda.
test("une tâche personnelle se crée, se date, se planifie en créneau et sort dans le flux agenda", async ({ page }) => {
  await page.goto("/ma-semaine");
  await iAm(page, "Romain Tessier");

  // Ajout en une ligne.
  await page.getByTestId("task-input").fill("Préparer le support du CODIR");
  await page.getByTestId("task-input").press("Enter");
  const task = page.getByTestId("my-tasks").locator("li", { hasText: "Préparer le support du CODIR" });
  await expect(task).toBeVisible();

  // Échéance : aujourd'hui → la tâche apparaît dans « Aujourd'hui ».
  await task.locator("[data-testid^=task-due-]").click();
  await page.getByRole("button", { name: "Aujourd'hui" }).click();
  await expect(task).toContainText("Pour aujourd'hui");
  await expect(page.getByTestId("today")).toContainText("Préparer le support du CODIR");

  // Créneau : le 23/09/2026 de 9 h à 11 h, distinct de l'échéance.
  await task.locator("[data-testid^=task-plan-]").click();
  await page.getByTestId("slot-date").fill("2026-09-23");
  await page.getByTestId("slot-start").fill("09:00");
  await page.getByTestId("slot-end").fill("11:00");
  await page.getByTestId("slot-submit").click();
  await expect(task).toContainText("mer. 23 sept. · 9h–11h");
  // Un autre créneau est proposé à la suite (11h–13h → l'après-midi) ; on le pose aussi, puis on ferme.
  await expect(page.getByTestId("slot-start")).toHaveValue("14:00");
  await page.getByTestId("slot-submit").click();
  await expect(task).toContainText("mer. 23 sept. · 14h–16h");
  await page.getByTestId("slot-close").click();
  // Un créneau posé aujourd'hui s'affiche dans « Aujourd'hui », avec son heure.
  await task.locator("[data-testid^=task-plan-]").click();
  await page.getByTestId("slot-date").fill(new Date().toLocaleDateString("sv")); // date locale, pas UTC (la suite peut tourner après minuit)
  await page.getByTestId("slot-start").fill("15:00");
  await page.getByTestId("slot-end").fill("16:00");
  await page.getByTestId("slot-submit").click();
  await page.getByTestId("slot-close").click();
  await expect(page.getByTestId("today")).toContainText("15h–16h");

  // Flux agenda : le créneau est une plage horaire occupée, l'échéance une journée.
  const url = await page.getByTestId("ics-url-me").innerText();
  const ics = await (await page.request.get(url)).text();
  expect(ics).toContain("SUMMARY:Travail · Préparer le support du CODIR");
  expect(ics).toContain("DTSTART:20260923T070000Z");
  expect(ics).toContain("TRANSP:OPAQUE");
  expect(ics).toContain("SUMMARY:Tâche · Préparer le support du CODIR");

  // Terminer : la tâche passe dans « Terminées ».
  await task.locator("[data-testid^=task-done-]").check();
  await expect(page.getByTestId("my-tasks")).toContainText("Terminées · 1");

  // Depuis une édition : une tâche rattachée, qui vit dans Ma semaine.
  await openEditionByName(page, "Mois de l'ESS et Prix ESS");
  await page.getByTestId("task-from-edition").click();
  await page.getByTestId("task-from-edition-label").fill("Relancer le financeur");
  await page.getByTestId("task-from-edition-submit").click();
  await expect(page.getByText("Tâche ajoutée à « Ma semaine »")).toBeVisible();
  await page.goto("/ma-semaine");
  const linked = page.getByTestId("my-tasks").locator("li", { hasText: "Relancer le financeur" });
  await expect(linked).toContainText("Mois de l'ESS et Prix ESS · 2026");

  // « @ » pendant la saisie : les éditions se proposent, Entrée rattache et retire le « @… » du libellé.
  await page.getByTestId("task-input").fill("Relire le dossier @refonte");
  await expect(page.getByTestId("task-suggestions")).toContainText("Refonte du site internet");
  await page.getByTestId("task-input").press("Enter");
  await expect(page.getByTestId("task-linked")).toContainText("Refonte du site internet");
  await expect(page.getByTestId("task-input")).toHaveValue("Relire le dossier");
  await page.getByTestId("task-input").press("Enter");
  const relire = page.getByTestId("my-tasks").locator("li", { hasText: "Relire le dossier" });
  await expect(relire).toContainText("Refonte du site internet · 2026");

  // Après coup : on change l'édition, on choisit une action, on détache.
  await relire.locator("[data-testid^=task-edition-]").click();
  await page.getByTestId("task-edition-search").fill("Mois de l'ESS");
  await page.getByRole("option", { name: /Mois de l'ESS et Prix ESS/ }).first().click();
  await expect(relire).toContainText("Mois de l'ESS et Prix ESS · 2026");
  await relire.locator("[data-testid^=task-edition-]").click();
  await pick(page, page.locator("[id^=task-action-]"), "Communication");
  await expect(relire).toContainText("· Communication");
  await relire.locator("[data-testid^=task-detach-]").click();
  await expect(relire).not.toContainText("Mois de l'ESS");
  await expect(relire.locator("[data-testid^=task-edition-]")).toHaveAttribute("aria-label", "Rattacher une édition");

  // Une autre personne ne voit pas ces tâches.
  await iAm(page, "Lucas Perrin");
  await expect(page.getByTestId("my-tasks")).not.toContainText("Relancer le financeur");
});

// Redesign du 18/09 (inspiration Todoist) : fiche de la tâche avec description, vue kanban par liste, « Reporter » les retards.
test("la fiche d'une tâche porte une description ; le kanban range par liste ; les retards se reportent à aujourd'hui", async ({ page }) => {
  await page.goto("/taches");
  await iAm(page, "Léa Morin");
  await page.goto("/taches");
  // Une tâche en retard, puis « Reporter à aujourd'hui ».
  await page.getByTestId("task-input").fill("Relancer le traiteur !01/01/2020");
  await page.getByTestId("task-input").press("Enter");
  const late = page.getByTestId("tasks-main").locator("li", { hasText: "Relancer le traiteur" });
  await expect(page.getByTestId("due-group-late")).toContainText("Relancer le traiteur");
  await page.getByTestId("postpone-late").click();
  await expect(page.getByTestId("due-group-today")).toContainText("Relancer le traiteur");
  // La fiche : description enregistrée en quittant le champ, reprise sous le libellé.
  await late.locator("[data-testid^=task-open-]").click();
  const detail = page.locator("[role=dialog][data-testid^=task-detail-]");
  await expect(detail).toBeVisible();
  await detail.getByTestId("task-detail-description").fill("Devis reçu le 12, relance téléphonique si rien vendredi.");
  await detail.getByTestId("task-detail-description").blur();
  await page.keyboard.press("Escape");
  await expect(late).toContainText("Devis reçu le 12");
  // Kanban : une colonne par liste, « À trier » en tête, la nouvelle tâche s'y trouve ; un ajout au pied d'une colonne.
  await page.getByTestId("tasks-display-kanban").click();
  await expect(page.getByTestId("tasks-main")).toHaveAttribute("data-view", "kanban");
  await expect(page.getByTestId("kanban-col-none")).toContainText("Relancer le traiteur");
  const vie = page.getByTestId("tasks-kanban").locator('[data-name="Vie statutaire"]');
  await expect(vie).toContainText("Envoyer la convocation");
  await vie.locator("[data-testid^=kanban-add-]").click();
  await vie.locator("[data-testid^=kanban-input-]").fill("Imprimer les feuilles d'émargement");
  await vie.locator("[data-testid^=kanban-input-]").press("Enter");
  await expect(vie).toContainText("Imprimer les feuilles d'émargement");
  await page.getByTestId("tasks-display-liste").click();
  await expect(page.getByTestId("tasks-main")).toHaveAttribute("data-view", "afaire");
  // Dans une liste, le kanban découpe par échéance ; ajouter dans « Aujourd'hui » date la tâche du jour.
  await page.getByTestId("tasks-lists").locator('[data-name="Vie statutaire"]').click();
  await expect(page.getByTestId("tasks-main")).toHaveAttribute("data-name", "Vie statutaire");
  await page.getByTestId("tasks-display-kanban").click();
  await expect(page.getByTestId("tasks-kanban")).toHaveAttribute("data-mode", "due");
  await expect(page.getByTestId("kanban-col-week")).toContainText("Envoyer la convocation");
  await page.getByTestId("kanban-col-today").locator("[data-testid^=kanban-add-]").click();
  await page.getByTestId("kanban-col-today").locator("[data-testid^=kanban-input-]").fill("Appeler la préfecture");
  await page.getByTestId("kanban-col-today").locator("[data-testid^=kanban-input-]").press("Enter");
  await expect(page.getByTestId("kanban-col-today")).toContainText("Appeler la préfecture");
});
