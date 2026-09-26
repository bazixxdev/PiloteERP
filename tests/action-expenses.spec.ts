import { test, expect, type Page } from "@playwright/test";
import { iAm, pick } from "./helpers";
import { W, cap, pl } from "./vocab";

// Dépenses et indicateurs rattachés à une action (26/09) : la colonne de la liste des dépenses et le sélecteur de chaque
// indicateur proposent les actions de l'année, jamais une abandonnée ; la dépense rattachée compte dans l'équilibre de la
// page de l'action, l'indicateur s'y lit. Changer de responsable retire la personne des associées. Projet créé pour le test.

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

async function addAction(page: Page, editionUrl: string, name: string) {
  await page.goto(`${editionUrl}?onglet=actions`);
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill(name);
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  return page.url().split("?")[0];
}

test("une dépense et un indicateur rattachés à une action : colonne, sélecteur, équilibre et indicateurs de sa page", async ({ page }) => {
  const editionUrl = await createProject(page, "Projet recette Iota", "REC-11");
  const actionUrl = await addAction(page, editionUrl, "Atelier budgété");
  await addAction(page, editionUrl, "Piste abandonnée");
  // La seconde est abandonnée : elle ne se propose plus nulle part.
  await pick(page, "action-state", "Abandonnée");
  await expect(page.getByTestId("action-state")).toContainText("Abandonnée");

  // Onglet Budget : une dépense saisie par la direction, puis rattachée dans sa ligne.
  await page.goto(`${editionUrl}?onglet=budget`);
  await page.getByTestId("add-expense-open").click();
  await page.getByTestId("add-expense-label").fill("Location de salle");
  await page.getByTestId("add-expense-spent").fill("350");
  await page.getByTestId("add-expense-ref").fill("F-2026-011");
  await page.getByTestId("add-expense-submit").click();
  await expect(page.getByTestId("expenses")).toContainText("Location de salle");
  await expect(page.getByTestId("expenses").locator("thead")).toContainText(cap(W.action));
  const list = page.locator("[data-slot=select-list]");
  await expect(async () => {
    if (!(await list.isVisible())) await page.getByTestId("expense-action-0").click();
    await expect(list).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(list).toContainText("Atelier budgété");
  await expect(list).not.toContainText("Piste abandonnée");
  await page.keyboard.press("Escape");
  await pick(page, "expense-action-0", "Atelier budgété");
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByTestId("expense-action-0")).toContainText("Atelier budgété");
  await page.getByTestId("expenses").screenshot({ path: ".superpowers/sdd/2026-09-26-actions-composantes/screens/task11-budget-colonne.png" });

  // La page de l'action : la dépense est listée et comptée dans l'équilibre.
  await page.goto(actionUrl);
  await expect(page.getByTestId("action-expenses")).toContainText("Location de salle");
  await expect(page.getByTestId("balance-spending")).toContainText("350");

  // Onglet des actions : un indicateur, rattaché par son sélecteur (sans l'abandonnée), se lit sur la page de l'action.
  await page.goto(`${editionUrl}?onglet=actions`);
  await expect(page.getByRole("tab", { name: cap(pl(W.action)) })).toBeVisible();
  await page.getByTestId("add-indicator-open").click();
  await page.getByTestId("add-indicator-label").fill("Participants aux ateliers");
  await page.getByTestId("add-indicator-submit").click();
  await expect(page.getByTestId("indicators")).toContainText(cap(W.action));
  // Écran plus haut (jusqu'à la fin) : la liste ouverte vers le bas figure sur la capture et reste cliquable.
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.getByTestId("indicators").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(async () => {
    if (!(await list.isVisible())) await page.getByTestId("indicator-action-0").click();
    await expect(list).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(list).toContainText("Atelier budgété");
  await expect(list).not.toContainText("Piste abandonnée");
  await page.screenshot({ path: ".superpowers/sdd/2026-09-26-actions-composantes/screens/task11-indicateur-selecteur.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await pick(page, "indicator-action-0", "Atelier budgété");
  await page.waitForLoadState("networkidle");
  await page.goto(actionUrl);
  await expect(page.getByTestId("action-indicators")).toContainText("Participants aux ateliers");

  // Responsable : une personne associée nommée responsable quitte la liste des associées (pas « responsable X · avec X »).
  await page.getByTestId("action-people-edit").click();
  await page.getByTestId("action-people").getByRole("button", { name: "Lucas Perrin" }).click();
  await expect(page.getByTestId("action-associates")).toContainText("Lucas Perrin");
  await page.getByTestId("action-people-done").click();
  await pick(page, "action-owner", "Lucas Perrin");
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByTestId("action-owner")).toContainText("Lucas Perrin");
  await expect(page.getByTestId("action-people-list")).toHaveText("Aucune.");
  await expect(page.getByTestId("action-associates")).toHaveCount(0);
});
