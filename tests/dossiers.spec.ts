import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Dossiers de financement (lot 2 du 19/09) : un dossier s'ouvre avant tout (nouveau financeur par son nom, montant, durée,
// cible, échéance), avance étape par étape (à étudier → réponse → déposé → obtenu avec sa forme, ou écarté avec le pourquoi),
// s'organise (tâches, notes, pièces) ; obtenu, il devient un financement (forme, notifié, éditions, versements).

test("un dossier vit de « à étudier » à « obtenu » ; un autre s'écarte avec son pourquoi ; les vues Dossiers et Financements obtenus se partagent le travail", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/conventions");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/conventions");
  // Un nouveau dossier, avec un financeur qui n'était pas dans l'annuaire, 60 000 € sur 3 ans.
  await page.getByTestId("nd-open").click();
  await page.getByTestId("nd-funder-name").fill("Fondation Terre d'Avenir");
  await page.getByTestId("nd-label").fill("Mécénat transition alimentaire");
  await page.getByTestId("nd-description").fill("Soutien au réseau des cantines coopératives");
  await pick(page, "nd-project", "PTCE et ESSOR");
  await page.getByTestId("nd-amount").fill("60000");
  await page.getByTestId("nd-years").fill("3");
  await page.getByTestId("nd-deadline").fill("2026-11-30");
  await pick(page, "nd-owner", "Thomas Guérin");
  await page.getByTestId("nd-submit").click();
  await expect(page.getByText("Dossier ouvert")).toBeVisible();
  await expect(page.getByTestId("dossier-funder")).toContainText("Fondation Terre d'Avenir");
  await expect(page.getByTestId("dossier-stepper")).toHaveAttribute("data-status", "study");
  await expect(page.getByTestId("dossier-per-year")).toContainText("20 000 €");
  await expect(page.getByTestId("dossier-per-year")).toContainText("60 000 €");
  // On s'organise : une tâche, une note, une pièce.
  await page.getByTestId("dossier-task-label").fill("Lire le règlement du mécénat");
  await page.getByTestId("dossier-task-submit").click();
  await expect(page.getByTestId("dossier-tasks")).toContainText("Lire le règlement du mécénat");
  await page.getByTestId("dossier-note-title").fill("Appel avec la fondation");
  await page.getByTestId("dossier-note-body").fill("Ils attendent un budget par cantine.");
  await page.getByTestId("dossier-note-submit").click();
  await expect(page.getByTestId("dossier-notes")).toContainText("budget par cantine");
  await page.getByTestId("dossier-file-label").fill("Règlement");
  await page.getByTestId("dossier-file-input").setInputFiles({ name: "reglement.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% reglement\n%%EOF\n") });
  await page.getByTestId("dossier-file-submit").click();
  await expect(page.getByTestId("dossier-files")).toContainText("Règlement");
  // Les étapes : on répond → déposé → obtenu (forme : contrat de mécénat, 50 000 €).
  await page.getByTestId("dossier-to-drafting").click();
  await expect(page.getByTestId("dossier-stepper")).toHaveAttribute("data-status", "drafting");
  await page.getByTestId("dossier-to-submitted").click();
  await expect(page.getByTestId("dossier-stepper")).toHaveAttribute("data-status", "submitted");
  await page.getByTestId("dossier-to-notified").click();
  await pick(page, "dossier-form", "Contrat de mécénat");
  await page.getByTestId("dossier-award-amount").fill("50000");
  await page.getByTestId("dossier-confirm").click();
  await expect(page.getByTestId("dossier-stepper")).toHaveAttribute("data-status", "notified");
  await expect(page.getByTestId("convention-lines")).toBeVisible(); // obtenu : les éditions se rattachent
  await expect(page.getByTestId("convention-payments")).toBeVisible();
  // Il est dans « Financements obtenus », avec sa forme ; plus dans les dossiers en cours.
  await page.goto("/conventions?vue=obtenus");
  const row = page.locator('[data-testid^=convention-][data-status=notified]', { hasText: "Fondation Terre d'Avenir" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Contrat de mécénat");
  await page.goto("/conventions");
  await expect(page.getByTestId("dossiers-table")).not.toContainText("Mécénat transition alimentaire");
  // Un dossier écarté dit pourquoi et reste visible, grisé, en bas.
  await page.getByTestId("nd-open").click();
  await pick(page, "nd-funder", "ADEME");
  await page.getByTestId("nd-label").fill("AAP mobilité douce");
  await page.getByTestId("nd-submit").click();
  await expect(page.getByText("Dossier ouvert")).toBeVisible();
  await page.getByTestId("dossier-to-dismissed").click();
  await page.getByTestId("dossier-reason").fill("Hors critères : réservé aux communes");
  await page.getByTestId("dossier-confirm").click();
  await expect(page.getByTestId("dossier-stepper")).toHaveAttribute("data-status", "dismissed");
  await expect(page.getByTestId("dossier-decision")).toContainText("Hors critères");
  await page.goto("/conventions");
  const dismissed = page.locator('[data-testid^=convention-][data-status=dismissed]', { hasText: "AAP mobilité douce" });
  await expect(dismissed).toContainText("Hors critères");
  // Un pilote lit les dossiers sans les faire avancer.
  await iAm(page, "Maxime Roussel");
  await page.goto("/conventions");
  await expect(page.getByTestId("nd-open")).toHaveCount(0);
  await page.locator("[data-testid^=open-convention-]").first().click();
  await expect(page.getByTestId("dossier-transitions")).toHaveCount(0);
});
