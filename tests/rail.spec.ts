import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Barre latérale repliée (retour de Gaël, 17/09) : au clic sur l'icône d'une section, un sous-menu flottant à droite —
// nom, feuilles, compteurs ; un seul ouvert ; se ferme après un choix, un clic dehors, un second clic ou Échap (focus sur l'icône).

test("le rail ouvre un sous-menu flottant par section, un seul à la fois, qui se ferme proprement", async ({ page }) => {
  await page.goto("/temps");
  await iAm(page, "Claire Vasseur");
  await page.goto("/temps");
  await page.getByRole("button", { name: "Réduire le menu" }).click();
  await expect(page.getByTestId("rail-demandes")).toBeVisible();

  // Ouvrir : le panneau porte le nom, les feuilles et le compteur ; la barre ne se déplie pas.
  await page.getByTestId("rail-demandes").click();
  const panel = page.getByTestId("rail-panel-demandes");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Demandes");
  await expect(panel).toContainText("À traiter par moi");
  await expect(panel).toContainText("Validations par niveau");
  await expect(panel.locator("a").first()).toContainText(/\d+/);
  await expect(page.getByRole("button", { name: "Déployer le menu" })).toBeVisible();

  // Un seul panneau : ouvrir Projets ferme Demandes.
  await page.getByTestId("rail-projets").click();
  await expect(page.getByTestId("rail-panel-projets")).toBeVisible();
  await expect(panel).toHaveCount(0);

  // Échap ferme et rend le focus à l'icône ; un second clic ferme aussi.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("rail-panel-projets")).toHaveCount(0);
  await expect(page.getByTestId("rail-projets")).toBeFocused();
  await page.getByTestId("rail-projets").click();
  await expect(page.getByTestId("rail-panel-projets")).toBeVisible();
  await page.getByTestId("rail-projets").click();
  await expect(page.getByTestId("rail-panel-projets")).toHaveCount(0);

  // Choisir une feuille : navigation, panneau fermé, icône marquée comme la page active.
  await page.getByTestId("rail-projets").click();
  await page.getByTestId("rail-panel-projets").getByRole("link", { name: "Qui finance quoi" }).click();
  await expect(page).toHaveURL(/\/matrice/);
  await expect(page.getByTestId("rail-panel-projets")).toHaveCount(0);
  await expect(page.getByTestId("rail-projets")).toHaveAttribute("aria-current", "page");

  // Clic dehors ferme ; le menu déplié retrouve son fonctionnement.
  await page.getByTestId("rail-demandes").click();
  await expect(page.getByTestId("rail-panel-demandes")).toBeVisible();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByTestId("rail-panel-demandes")).toHaveCount(0);
  await page.getByRole("button", { name: "Déployer le menu" }).click();
  await expect(page.locator("aside").getByRole("link", { name: "Qui finance quoi" })).toBeVisible();
});
