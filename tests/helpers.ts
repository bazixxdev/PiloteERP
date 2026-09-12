import { expect, type Page } from "@playwright/test";

// Sélecteur « Je suis… » : change la personne courante (et ses droits).
export async function iAm(page: Page, name: string) {
  await page.getByTestId("person-switcher").click();
  await page.getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("person-switcher")).toContainText(name, { timeout: 15_000 });
}

export async function openEditionByName(page: Page, name: string) {
  await page.goto("/portefeuille");
  await page.getByRole("link", { name, exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
}
