import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Rythmes de travail historisés : option B (vendredi une semaine sur deux), passage à 80 % en cours d'année, déclaration de semaine complète.
test("les heures attendues suivent le rythme réel de la personne et de la semaine ; la déclaration de complétude remonte à la clôture", async ({ page }) => {
  // Thomas : option A jusqu'au 30 juin, option B depuis le 1er juillet → un vendredi sur deux non travaillé.
  await page.goto("/temps?semaine=2026-W36");
  await iAm(page, "Thomas Guérin");
  await page.goto("/temps?semaine=2026-W36"); // semaine paire : 5 jours à 8,25 h
  await expect(page.getByTestId("week-total")).toContainText("41,25 h");
  await page.goto("/temps?semaine=2026-W37"); // semaine impaire : vendredi non travaillé
  await expect(page.getByTestId("week-total")).toContainText("33 h");
  await expect(page.locator("tfoot").getByText("non travaillé")).toBeVisible();
  await page.goto("/temps?semaine=2026-W24"); // juin : encore option A
  await expect(page.getByTestId("week-total")).toContainText("36,5 h");

  // Camille : 80 % depuis le 1er septembre (28 h), option A avant (36,5 h).
  await iAm(page, "Camille Aubert");
  await page.goto("/temps?semaine=2026-W37");
  await expect(page.getByTestId("week-total")).toContainText("28 h");
  await page.goto("/temps?semaine=2026-W33");
  await expect(page.getByTestId("week-total")).toContainText("36,5 h");

  // Déclaration de la semaine 37, puis correction d'une cellule : la déclaration tombe.
  await page.goto("/temps?semaine=2026-W37");
  await expect(page.getByTestId("declare-week")).toBeVisible();
  await page.getByTestId("declare-week").click();
  await expect(page.getByText("Répartition déclarée complète")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("week-declaration")).toContainText("déclarée complète le");
  const cell = page.getByTestId("cell-0-0");
  await cell.fill("2");
  await cell.blur();
  await expect(page.getByTestId("time-grid")).toHaveAttribute("data-saving", "0", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId("declare-week")).toBeVisible();

  // La RAF voit les semaines déclarées dans la clôture.
  await iAm(page, "Nadia Ferrand");
  await page.goto("/cloture?mois=2026-08");
  const row = page.getByTestId("cloture-table").locator("tr", { hasText: "Julien Barbot" });
  await expect(row).toContainText("Déclaré complet");
});
