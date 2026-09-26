import { test, expect, type Page } from "@playwright/test";
import { iAm, pick } from "./helpers";
import { dayjs } from "../lib/format";
import { W, cap, pl, aucun } from "./vocab";

// La frise par action (tâche 8, spec 2026-09-26) : une barre par action de l'année, ses jalons, et les livrables de l'année.
// Projet créé pour le test : rien du jeu de démo ne bouge.
const year = new Date().getFullYear();

async function createProject(page: Page, name: string, code: string) {
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  await page.getByTestId("cp-open").click();
  await page.getByTestId("cp-name").fill(name);
  await page.getByTestId("cp-code").fill(code);
  await pick(page, "cp-pilot", "Inès Cabral");
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name, { timeout: 30_000 });
  return page.url().split("?")[0];
}

test("la frise : une barre par action, la flèche d'une période qui déborde, un jalon dépassé marqué, la ligne des livrables", async ({ page }) => {
  await createProject(page, "Projet recette Delta", "REC-04");

  // Première action : période par défaut (toute l'année), un jalon dépassé et non fait.
  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Cycle de formations");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });

  const overdue = dayjs().subtract(3, "day").format("YYYY-MM-DD");
  await page.getByTestId("milestone-add").click();
  await page.getByTestId("milestone-add-date").fill(overdue);
  await page.getByTestId("milestone-add-label").fill("Bilan à mi-parcours");
  await page.getByTestId("milestone-add-submit").click();
  await expect(page.getByTestId("milestone-label-0")).toHaveValue("Bilan à mi-parcours");

  // Deuxième action : période qui déborde sur l'année suivante (flèche « ▸ »).
  await page.getByTestId("action-back").click();
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Tournée régionale");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("period-start").fill(`${year}-09-01`);
  await page.getByTestId("period-end").fill(`${year + 1}-03-31`);
  await page.getByTestId("period-submit").click();
  await expect(page.getByText("Période enregistrée")).toBeVisible();

  // La frise : une barre par action (dans l'ordre des périodes), la flèche de débordement, le jalon en retard marqué.
  await page.getByTestId("action-back").click();
  await expect(page.getByTestId("timeline")).toBeVisible();
  await expect(page.getByTestId("timeline-bar-0")).toBeVisible();
  await expect(page.getByTestId("timeline-bar-1")).toBeVisible();
  await expect(page.getByTestId("timeline-bar-0")).toHaveAttribute("title", /Cycle de formations/);
  await expect(page.getByTestId("timeline-bar-1")).toHaveAttribute("title", /Tournée régionale/);
  await expect(page.getByTestId("timeline-bar-1-after")).toBeVisible();
  await expect(page.getByTestId("timeline-bar-1-before")).toHaveCount(0);
  const overdueDot = page.locator('[data-testid^="timeline-milestone-0-"]');
  await expect(overdueDot).toHaveAttribute("data-overdue", "true");
  await expect(overdueDot).toHaveAttribute("title", /Bilan à mi-parcours/);

  // Sans livrable de l'année, pas de ligne « Livrables ».
  await expect(page.getByTestId("timeline-deliverables")).toHaveCount(0);

  // Un financement de l'année avec un livrable : la ligne apparaît sur la frise.
  await page.getByRole("tab", { name: "Budget" }).click();
  await page.getByTestId("add-funding-open").click();
  await pick(page, "add-funding-funder", "Région");
  await page.getByTestId("add-funding-submit").click();
  await expect(page.getByTestId("funding-line-0")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByTestId("funding-panel-0-open").click();
  const panel = page.getByTestId("funding-panel-0");
  await panel.getByTestId("add-deliverable-open").click();
  await panel.getByTestId("add-deliverable-label").fill("Rapport intermédiaire");
  await panel.getByTestId("add-deliverable-date").fill(dayjs().add(20, "day").format("YYYY-MM-DD"));
  await panel.getByTestId("add-deliverable-submit").click();
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await expect(page.getByTestId("timeline-deliverables")).toBeVisible();
  await expect(page.getByTestId("timeline-deliverable-0")).toBeVisible();
  await expect(page.getByTestId("timeline-deliverable-0")).toHaveAttribute("title", /Rapport intermédiaire/);
});

test("la frise : aucune action de l'année se lit en clair, sans mot du vocabulaire en dur", async ({ page }) => {
  await createProject(page, "Projet recette Epsilon", "REC-05");
  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await expect(page.getByTestId("timeline")).toContainText(`${cap(aucun(W.action))} cette année`);
});
