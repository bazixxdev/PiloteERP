import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Retours à chaud C : la relance laisse une trace visible — cloche et « Ma semaine » côté personne, badge daté côté RAF.
test("la relance de la RAF notifie la personne dans l'outil et reste tracée dans la clôture", async ({ page }) => {
  await page.goto("/cloture?mois=2026-09");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/cloture?mois=2026-09");
  await expect(page.getByTestId("time-nav-cloture")).toHaveAttribute("aria-current", "page");
  const row = page.getByTestId("cloture-table").locator("tr", { hasText: "Élise Fontaine" });
  await row.getByRole("button", { name: "Relancer" }).click();
  await expect(page.getByText("notification dans l'outil")).toBeVisible();
  await expect(row).toContainText("Relancé·e le");

  // Le détail des heures est accessible à la RAF depuis la clôture.
  await row.getByRole("link", { name: "Détail" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Temps de Élise Fontaine");
  await expect(page.getByTestId("time-nav-team")).toHaveAttribute("aria-current", "page");

  // Côté personne : cloche avec badge, encart dans « Ma semaine ».
  await iAm(page, "Élise Fontaine");
  await page.goto("/ma-semaine");
  await expect(page.getByTestId("bell-count")).toHaveText("1");
  await expect(page.getByTestId("unread-notifications")).toContainText("Temps de septembre 2026 à compléter");
  await page.getByTestId("bell").click();
  await page.getByTestId("notification-item").first().click();
  await expect(page).toHaveURL(/\/temps/);
  await expect(page.getByTestId("time-nav-me")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("bell-count")).toHaveCount(0);
});
