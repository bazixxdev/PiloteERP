import { test, expect } from "@playwright/test";
// Retour de Gaël (19/09) : l'infobulle du rail restait affichée après avoir choisi une page (réouverte par le focus rendu à l'icône).
test("l'infobulle du rail ne reste pas après avoir choisi une page", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 }); // sous lg : le rail
  await page.goto("/portefeuille");
  const rail = page.getByTestId("rail-travail");
  await rail.hover();
  await expect(page.locator("[data-slot=tooltip-content]")).toBeVisible();
  await rail.click();
  await page.getByTestId("rail-panel-travail").getByRole("link", { name: /Tâches/ }).click();
  await expect(page).toHaveURL(/\/taches/);
  await page.mouse.move(600, 400);
  await page.waitForTimeout(600);
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveCount(0);
  // Et au retour du focus sur l'icône (clavier), pas d'infobulle non plus.
  await rail.focus();
  await page.waitForTimeout(500);
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveCount(0);
});
