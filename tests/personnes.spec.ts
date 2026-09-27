import { test, expect } from "@playwright/test";
import { DEMO_PASSWORD, FRESH, iAm, login, openEditionByName, pick } from "./helpers";

// Lot E1 — Fiche personne : prénom / nom, fonction, téléphone, dates ; panneau sur Admin › Personnes ; chacun tient sa
// fonction et son téléphone dans Mon compte ; « Préparer un départ » réattribue ce que la personne porte, date et désactive
// sans rien effacer.

test("la fiche s'ouvre en panneau ; la fonction posée par l'admin se lit dans Mon compte ; le nom et le couple prénom / nom restent cohérents", async ({ page }) => {
  await page.goto("/admin?section=personnes");
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=personnes");
  const row = page.locator("tr").filter({ has: page.locator('input[value="Lucas Perrin"]') }).first();
  await row.locator("[data-testid^=person-open-]").click();
  const panel = page.getByTestId("person-panel-sheet");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("person-firstName")).toHaveValue("Lucas");
  await expect(panel.getByTestId("person-lastName")).toHaveValue("Perrin");
  await expect(panel.getByTestId("person-phone")).toHaveValue("06 00 00 00 14");
  await panel.getByTestId("person-jobTitle").fill("Alternant communication et web");
  await panel.getByTestId("person-jobTitle").blur();
  await page.waitForTimeout(500);
  // Le nom change par le prénom : le nom affiché suit.
  await panel.getByTestId("person-firstName").fill("Luca");
  await panel.getByTestId("person-firstName").blur();
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.goto("/admin?section=personnes");
  await expect(page.locator('input[value="Luca Perrin"]')).toBeVisible();
  // Et dans l'autre sens : corriger le nom affiché remet le prénom.
  await page.locator('input[value="Luca Perrin"]').fill("Lucas Perrin");
  await page.locator('input[value="Lucas Perrin"]').blur();
  await page.waitForTimeout(500);
  await page.goto("/admin?section=personnes");
  await page.locator("tr").filter({ has: page.locator('input[value="Lucas Perrin"]') }).first().locator("[data-testid^=person-open-]").click();
  await expect(page.getByTestId("person-panel-sheet").getByTestId("person-firstName")).toHaveValue("Lucas");
  await page.keyboard.press("Escape");

  // Lucas voit sa fonction dans Mon compte et corrige lui-même son téléphone (pas d'admin pour ça).
  await iAm(page, "Lucas Perrin");
  await page.goto("/compte");
  await expect(page.getByTestId("me-jobTitle")).toHaveValue("Alternant communication et web");
  await page.getByTestId("me-phone").fill("06 11 22 33 44");
  await page.getByTestId("me-phone").blur();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByTestId("me-phone")).toHaveValue("06 11 22 33 44");
});

test("préparer un départ : ce qu'elle porte passe à quelqu'un d'autre, la fiche est datée, l'accès coupé ; rien n'est effacé", async ({ page, browser }) => {
  // Manon propose un projet : elle en devient pilote — voilà quelque chose à réattribuer.
  await page.goto("/portefeuille");
  await iAm(page, "Manon Girard");
  await page.getByTestId("propose-project").click();
  await page.getByTestId("propose-name").fill("Projet test départ");
  await page.getByTestId("propose-summary").fill("Un projet porté par Manon, pour le test du départ.");
  await page.getByTestId("propose-project-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projet test départ");

  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=personnes");
  const row = page.locator("tr").filter({ has: page.locator('input[value="Manon Girard"]') }).first();
  await row.locator("[data-testid^=person-open-]").click();
  await expect(page.getByTestId("person-responsibilities")).toContainText("Projets pilotés : 1");
  await page.getByTestId("person-departure-open").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Préparer le départ de Manon Girard");
  await expect(page.getByTestId("departure-piloted")).toContainText("Projet test départ");
  await pick(page, "departure-piloted-to", "Lucas Perrin");
  await page.getByTestId("departure-date").fill("2026-09-30");
  await expect(page.getByTestId("departure-deactivate")).toBeChecked();
  await page.getByTestId("departure-submit").click();
  await expect(page.getByText(/réattribué/)).toBeVisible();

  // Retour sur sa fiche : datée, désactivée, plus rien de porté ; Lucas pilote le projet.
  await expect(page.getByTestId("person-panel-sheet")).toBeVisible();
  await expect(page.getByTestId("person-panel-sheet")).toContainText("Désactivée");
  await expect(page.getByTestId("person-leftAt")).toHaveValue("2026-09-30");
  await expect(page.getByTestId("person-responsibilities")).toContainText("Projets pilotés : 0");
  await page.keyboard.press("Escape");
  await page.locator("tr").filter({ has: page.locator('input[value="Lucas Perrin"]') }).first().locator("[data-testid^=person-open-]").click();
  await expect(page.getByTestId("person-responsibilities")).toContainText("Projet test départ");
  await page.keyboard.press("Escape");
  // Manon ne peut plus se connecter ; Lucas a été prévenu.
  const ctx = await browser.newContext({ storageState: FRESH });
  const p2 = await ctx.newPage();
  await login(p2, "manon.girard@exemple.fr", DEMO_PASSWORD, false);
  await expect(p2.getByTestId("login-error")).toContainText("désactivé");
  await ctx.close();
  await iAm(page, "Lucas Perrin");
  await page.goto("/notifications");
  await expect(page.getByText("Départ de Manon Girard : les projets pilotés vous reviennent")).toBeVisible();

  // On la réactive pour la suite (l'historique est toujours là : rien n'a été effacé).
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=personnes");
  await page.locator("tr").filter({ has: page.locator('input[value="Manon Girard"]') }).first().locator('input[type="checkbox"]').last().check();
  await page.waitForTimeout(500);
});

// « Suit son temps » (26/09, spec actions § 1) : décochée pour un membre du CA ou un bénévole, la personne sort du plan de
// charge, de la clôture et de la navigation Temps, mais reste choisissable comme responsable d'action ou membre d'équipe.
test("« suit son temps » décochée : sort du plan de charge et de la clôture, sa navigation Temps disparaît, mais reste choisissable", async ({ page }) => {
  await page.goto("/admin?section=personnes");
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=personnes");
  const openLucas = () => page.locator("tr").filter({ has: page.locator('input[value="Lucas Perrin"]') }).first().locator("[data-testid^=person-open-]").click();
  await openLucas();
  const panel = page.getByTestId("person-panel-sheet");
  await expect(panel.getByTestId("person-tracksTime")).toBeChecked();
  await panel.getByTestId("person-tracksTime").uncheck();
  await expect(panel.getByTestId("person-tracksTime")).not.toBeChecked();
  await page.keyboard.press("Escape");

  // Plan de charge : Lucas a disparu.
  await page.goto("/plan-de-charge?horizon=6");
  await expect(page.getByTestId("load-grid")).not.toContainText("Lucas Perrin");

  // Clôture : Lucas a disparu (contributeur, il y figurait comme retardataire) — deux tableaux, anomalies et en ordre.
  await page.goto("/cloture?mois=2026-08");
  await expect(page.getByTestId("cloture-issues")).not.toContainText("Lucas Perrin");
  await expect(page.getByTestId("cloture-ok")).not.toContainText("Lucas Perrin");

  // Reste choisissable comme membre d'équipe (donc comme responsable d'action).
  await openEditionByName(page, "PTCE et ESSOR");
  await page.getByTestId("team-edit").click();
  await expect(page.getByRole("button", { name: "Lucas Perrin" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Sa propre navigation : la section Temps a disparu, un accès direct à /temps renvoie vers sa semaine.
  await iAm(page, "Lucas Perrin");
  await expect(page.getByTestId("rail-temps")).toHaveCount(0);
  await page.goto("/temps");
  await expect(page).toHaveURL(/\/ma-semaine/);

  // Remise en état : on réactive le suivi du temps, d'autres specs comptent sur sa présence en clôture et en plan de charge.
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=personnes");
  await openLucas();
  const panel2 = page.getByTestId("person-panel-sheet");
  await panel2.getByTestId("person-tracksTime").check();
  await expect(panel2.getByTestId("person-tracksTime")).toBeChecked();
  await page.keyboard.press("Escape");
});

// Admin n'a plus qu'une seule feuille dans le menu (27/09) : ses onglets de page (Personnes, Comptes, Rôles et droits,
// Référentiels, Paramètres, Import / export) sont désormais le seul chemin vers Comptes et Rôles et droits, y compris
// desktop, barre latérale dépliée — la règle qui les cachait dans ce cas (doublon supposé du niveau 2) a été retirée.
test("les onglets d'Admin restent visibles en desktop, barre dépliée", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin?section=personnes");
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=personnes");
  const tabs = page.getByTestId("admin-tabs");
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Comptes" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Rôles et droits" })).toBeVisible();
  await tabs.getByRole("link", { name: "Comptes" }).click();
  await expect(page).toHaveURL(/section=comptes/);
});
