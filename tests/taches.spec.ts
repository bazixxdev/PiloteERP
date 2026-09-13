import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

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
  await page.getByTestId("slot-date").fill(new Date().toISOString().slice(0, 10));
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

  // Une autre personne ne voit pas ces tâches.
  await iAm(page, "Lucas Perrin");
  await expect(page.getByTestId("my-tasks")).not.toContainText("Relancer le financeur");
});
