import { expect, type Page } from "@playwright/test";

// Sélecteur « Je suis… » : change la personne courante (et ses droits).
// Choisit une entrée dans une liste avec recherche (components/common/searchable-select.tsx) : ouvre, filtre si le champ existe, clique.
// `what` = texte de l'entrée (sous-chaîne) ou son rang (0 = première entrée réelle, l'option « aucun » exclue).
export async function pick(page: Page, testId: string, what: string | number) {
  await page.getByTestId(testId).click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  if (typeof what === "string") {
    const search = page.getByTestId(`${testId}-search`);
    if (await search.count()) await search.fill(what);
    await list.getByRole("option", { name: new RegExp(what.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
  } else {
    const options = list.getByRole("option");
    const first = (await options.first().getAttribute("id")) && (await options.first().innerText()).match(/^(Sans projet|Transverse|Personne|—)/) ? 1 : 0;
    await options.nth(first + what).click();
  }
  await expect(list).toBeHidden();
}

export async function iAm(page: Page, name: string) {
  await page.getByTestId("person-switcher").click();
  await page.getByTestId("menu-switch").click();
  await page.getByTestId("person-chooser").getByRole("option", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("person-switcher")).toContainText(name, { timeout: 15_000 });
}

// Ouvre l'édition depuis le portefeuille, puis son onglet Fiche (l'atterrissage est l'Aperçu une fois la fiche validée — revue du 15/09).
export async function openEditionByName(page: Page, name: string) {
  await page.goto("/portefeuille");
  await page.getByRole("link", { name, exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
  const fiche = page.getByRole("tab", { name: "Fiche" });
  if ((await fiche.getAttribute("aria-selected")) !== "true") await fiche.click();
}

// Fiche validée : les couches sont repliées ; on déplie avant de lire les rubriques.
// Une couche verrouillée se lit dépliée par défaut (revue du 15/09) ; on ne clique le bouton que si elle est repliée.
export async function expandLayer(page: Page, layer: "strategic" | "means" | "proposal") {
  const summary = page.getByTestId(`layer-summary-${layer}`);
  if (await summary.count()) await page.getByTestId(`layer-toggle-${layer}`).click();
}
