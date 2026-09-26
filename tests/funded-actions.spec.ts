import { test, expect, type Page } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Actions financées vues depuis la ligne (26/09) : le panneau d'une ligne liste les actions qu'elle finance, avec les heures de
// l'année de la ligne — les mêmes que la page de l'action pour cette année — et le détail par personne selon la visibilité du
// temps : la direction voit les noms ; un contributeur (visibilité « soi, responsable de pôle, RAF » du seed) ne lit que
// l'agrégat « N autres personnes : détail non visible ». Les heures du seed dépendent du jour : rien n'est figé, on compare.
const EDITION = "Vœux et assemblée générale";

async function openBudget(page: Page) {
  await openEditionByName(page, EDITION);
  await page.getByRole("tab", { name: "Budget" }).click();
  await page.waitForLoadState("networkidle");
  return page.url().split("?")[0];
}

test("le panneau de ligne liste les actions financées, leurs heures de l'année et leur montant ; l'agrégat pour qui ne voit pas le temps", async ({ page }) => {
  // Session de la recette : Claire Vasseur (direction).
  const editionUrl = await openBudget(page);

  // Première ligne dont une action financée a des heures saisies par quelqu'un d'autre que le contributeur témoin.
  const rows = await page.locator("[data-testid^=funding-line-]").count();
  let found: { panel: string; action: string; href: string; hours: string; names: string[] } | null = null;
  for (let i = 0; i < rows && !found; i++) {
    await page.getByTestId(`funding-panel-${i}-open`).click();
    const funded = page.getByTestId(`funding-panel-${i}`).getByTestId("funded-actions");
    await expect(funded).toBeVisible();
    for (const li of await funded.locator("li[data-action]").all()) {
      const people = li.locator("[data-testid^=funded-people-] > li:not([data-testid])");
      if ((await people.count()) === 0) continue;
      const names = (await people.allInnerTexts()).map((t) => t.replace(/\s[\d,]+\s*h$/, "").trim());
      if (names.includes("Lucas Perrin")) continue;
      const link = li.locator("[data-testid^=funded-action-name-]");
      found = { panel: `funding-panel-${i}`, action: await link.innerText(), href: (await link.getAttribute("href"))!, hours: await li.locator("[data-testid^=funded-hours-]").innerText(), names };
      await expect(li.locator("[data-testid^=funded-amount-]")).toBeVisible();
      break;
    }
    await page.keyboard.press("Escape");
  }
  expect(found, "une action financée avec des heures dans le seed").not.toBeNull();
  const f = found!;

  // Les heures affichées sont celles de la page de l'action pour l'année de la ligne (le lien porte ?annee=).
  expect(f.href).toMatch(/\?annee=\d{4}$/);
  await page.goto(f.href);
  await expect(page.getByTestId("action-hours-total")).toHaveText(f.hours);
  for (const n of f.names) await expect(page.getByTestId("action-hours")).toContainText(n);

  // Un contributeur, sans visibilité sur le temps de ces personnes : l'action et son total, pas les noms, l'agrégat.
  // (Adresse directe : le portefeuille d'un contributeur s'ouvre sur son périmètre.)
  await iAm(page, "Lucas Perrin");
  await page.goto(`${editionUrl}?onglet=budget`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId(`${f.panel}-open`).click();
  const li = page.getByTestId(f.panel).getByTestId("funded-actions").locator("li[data-action]").filter({ hasText: f.action }).first();
  await expect(li.locator("[data-testid^=funded-hours-]")).toHaveText(f.hours);
  await expect(li.locator("[data-testid^=funded-hidden-]")).toHaveText(new RegExp(`^${f.names.length} autres? personnes? : détail non visible\\.$`));
  for (const n of f.names) await expect(li).not.toContainText(n);
});
