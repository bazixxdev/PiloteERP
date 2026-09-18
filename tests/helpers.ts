import { expect, type Locator, type Page } from "@playwright/test";

// Sélecteur « Je suis… » : change la personne courante (et ses droits).
// Choisit une entrée dans une liste déroulante de l'outil (components/common/searchable-select.tsx) : ouvre, filtre si le
// champ de recherche existe, clique. `target` = testid du déclencheur ou son Locator ; `what` = texte de l'entrée (sous-chaîne),
// `{ value }` pour sa valeur, ou son rang (0 = première entrée réelle, l'option « aucun » exclue).
export async function pick(page: Page, target: string | Locator, what: string | number | { value: string }) {
  const trigger = typeof target === "string" ? page.getByTestId(target) : target;
  const list = page.locator("[data-slot=select-list]");
  // Une notification (sonner, en bas à droite) qui recouvre la liste intercepte le clic — et la souris posée dessus la fige.
  // On la laisse s'effacer avant d'ouvrir (quelques secondes au plus).
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10_000 }).catch(() => undefined);
  // Un clic peut tomber avant l'hydratation (page qui vient de se recharger) : on réessaie jusqu'à ce que la liste s'ouvre.
  await expect(async () => {
    if (!(await list.isVisible())) await trigger.click();
    await expect(list).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  if (typeof what === "object") {
    await list.locator(`[role=option][data-value="${what.value}"]`).click();
  } else if (typeof what === "string") {
    const search = page.getByLabel("Rechercher dans la liste");
    if (await search.count()) await search.fill(what);
    await list.getByRole("option", { name: new RegExp(what.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
  } else {
    const options = list.getByRole("option");
    const first = (await options.first().innerText()).match(/^(Sans projet|Transverse|Personne|—|Tous|Toutes)/) ? 1 : 0;
    await options.nth(first + what).click();
  }
  await expect(list).toBeHidden();
}

// Lot F : mot de passe de démo commun, contexte vierge (« browser.newContext() » hérite sinon du storageState du projet, la
// session de Claire — qu'aucun test ne doit fermer : toute la suite s'en sert), connexion par le formulaire.
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "pilote-demo-2026";
export const FRESH = { cookies: [], origins: [] };
export async function login(page: Page, email: string, password = DEMO_PASSWORD, expectOk = true) {
  await page.goto("/connexion");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId(expectOk ? "person-switcher" : "login-error")).toBeVisible();
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
