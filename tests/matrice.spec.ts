import { test, expect } from "@playwright/test";
import { FRESH, iAm } from "./helpers";

// Lot C — « Qui finance quoi » : la matrice éditions × financeurs de l'année, montants pour le CODIR, pastilles pour les autres,
// zones d'attention, export CSV par le jeton, lexique partagé.

test("la RAF lit la matrice 2026 avec montants, couverture, zones d'attention et export CSV", async ({ page }) => {
  await page.goto("/conventions");
  await iAm(page, "Nadia Ferrand");
  await page.locator("aside").getByRole("link", { name: "Qui finance quoi" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Qui finance quoi");
  const matrix = page.getByTestId("matrix");
  await expect(matrix).toHaveAttribute("data-money", "1");
  // Cycle de conférences transition : 13 300 € obtenus pour 14 000 € d'enveloppe → 95 %.
  const row = page.getByTestId("matrix-row-TES-02");
  await expect(row).toContainText(/13.300/);
  await expect(page.getByTestId("coverage-TES-02")).toHaveText("95 %");
  // Vie statutaire (REP-04) n'a aucune ligne de financement : signalée dans la ligne et dans la zone « Sans financement ».
  await expect(page.getByTestId("matrix-row-REP-04")).toHaveAttribute("data-orphan", "1");
  await expect(page.getByTestId("matrix-attention")).toContainText("Vie statutaire");
  // Pied de colonne : chaque financeur présent a un total.
  await expect(page.getByTestId("column-total-Région")).toContainText("€");
  // Conventions sous-affectées : la FSE a du notifié non affecté.
  await expect(page.getByTestId("matrix-attention")).toContainText("FSE-2026-2028");

  // Une cellule ouvre sa ligne en panneau, sur la matrice même ; le chiffre cliqué (obtenu) est surligné et focalisé.
  await row.locator("td[data-kind=granted] a").first().click();
  await page.waitForURL(/ligne=/);
  const panel = page.getByTestId("matrix-panel");
  await expect(panel).toContainText("Cycle de conférences transition 2026");
  await expect(panel).toContainText("Ligne tenue par la RAF");
  const focused = panel.locator("input[data-highlight=true]");
  await expect(focused).toHaveCount(1);
  await expect(focused).toHaveAttribute("aria-label", /Montant obtenu/);
  await expect(focused).toBeFocused();
  // Fermer : le tableau est toujours là, sans rechargement de la page ni perte d'année.
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/matrice\?annee=2026$/);
  await expect(page.getByTestId("matrix-row-TES-02")).toBeVisible();
  // Un montant demandé (italique) surligne le champ Demandé.
  await page.locator("td[data-kind=requested] a").first().click();
  await page.waitForURL(/champ=amountRequested/);
  await expect(page.getByTestId("matrix-panel").locator("input[data-highlight=true]")).toHaveAttribute("aria-label", /Montant demandé/);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("matrix-panel")).toHaveCount(0);

  // Année suivante : les dossiers ne sont pas tranchés (à déposer).
  await page.getByTestId("year-picker").getByRole("link", { name: "2027" }).click();
  await expect(page.getByTestId("matrix").locator("td[data-kind=to_submit]").first()).toBeVisible();

  // Export CSV depuis l'outil (cookie) : en-tête et une ligne par édition.
  const res = await page.request.get("/matrice/export?annee=2026");
  expect(res.status()).toBe(200);
  const csv = await res.text();
  expect(csv).toContain("pole;projet;code;edition;enveloppe;");
  expect(csv).toContain("TES-02;2026;14000;");

  // Lexique : depuis la matrice et depuis le portefeuille.
  await page.goto("/matrice");
  await page.getByTestId("help-open").click();
  await page.getByTestId("lexique-open").click();
  await expect(page.getByTestId("lexique")).toContainText("Ligne de financement");
  await expect(page.getByTestId("lexique")).toContainText("L'exception");
  await page.keyboard.press("Escape");
  await page.goto("/portefeuille");
  await page.getByTestId("help-open").click();
  await page.getByTestId("lexique-open").click();
  await expect(page.getByTestId("lexique")).toContainText("Année");
});

test("un contributeur voit la matrice en pastilles, sans montants ni export", async ({ page, playwright }) => {
  await page.goto("/matrice");
  await iAm(page, "Lucas Perrin");
  await page.goto("/matrice");
  await expect(page.getByTestId("matrix")).toHaveAttribute("data-money", "0");
  await expect(page.getByTestId("matrix")).not.toContainText("€");
  await expect(page.getByTestId("matrix").locator("td[data-kind=granted]").first()).toContainText("●");
  await expect(page.getByTestId("matrix-export")).toHaveCount(0);
  await expect(page.locator("[data-testid^=coverage-]")).toHaveCount(0);
  // Export refusé sans cookie ni jeton (contexte de requête vierge).
  const anonCtx = await playwright.request.newContext({ baseURL: new URL(page.url()).origin, storageState: FRESH });
  const anon = await anonCtx.get("/matrice/export?annee=2026");
  expect(anon.status()).toBe(401);
});
