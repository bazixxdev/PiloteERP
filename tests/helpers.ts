import { expect, type Page } from "@playwright/test";

// Sélecteur « Je suis… » : change la personne courante (et ses droits).
export async function iAm(page: Page, name: string) {
  await page.getByTestId("person-switcher").click();
  await page.getByTestId("menu-switch").click();
  await page.getByTestId("person-chooser").getByRole("option", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("person-switcher")).toContainText(name, { timeout: 15_000 });
}

export async function openEditionByName(page: Page, name: string) {
  await page.goto("/portefeuille");
  await page.getByRole("link", { name, exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
}

// Fiche validée : les couches sont repliées ; on déplie avant de lire les rubriques.
export async function expandLayer(page: Page, layer: "strategic" | "means" | "proposal") {
  const toggle = page.getByTestId(`layer-toggle-${layer}`);
  if (await toggle.count()) await toggle.click();
}
