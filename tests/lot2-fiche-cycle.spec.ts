import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Lot 2 « La fiche et son cycle » : fiche validée verrouillée et propositions de modification, proposition de projet,
// réalisations au fil de l'année, export assemblé, plan de charge figé, motif des remarques, occurrences d'action.

test("une fiche validée est verrouillée : la modification passe par une proposition, acceptée par le pilote et tracée", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Hugo Lemaire");
  await openEditionByName(page, "Forum régional de l'ESS");
  await expect(page.getByTestId("fiche-locked")).toBeVisible();
  // Couche repliée, dépliable ; pas de « Modifier cette couche ».
  await expect(page.getByTestId("layer-summary-proposal")).toBeVisible();
  await expect(page.getByTestId("layer-edit-proposal")).toHaveCount(0);
  await page.getByTestId("layer-toggle-proposal").click();
  await expect(page.getByTestId("field-quantitativeObjectives")).toBeVisible();
  // La proposition du jeu de démo attend le pilote : il l'accepte, la valeur s'applique.
  const proposal = page.locator("[data-testid^=proposal-]").first();
  await expect(proposal).toContainText("Le financeur retient 120 participants");
  await proposal.locator("[data-testid^=proposal-accept-]").click();
  await expect(page.getByText("Modification appliquée et tracée")).toBeVisible();
  await expect(page.getByTestId("field-quantitativeObjectives")).toContainText("120 participants");
  // L'historique garde qui a changé quoi.
  await page.getByTestId("history").locator("summary").click();
  await expect(page.getByTestId("changelog")).toContainText("Objectifs quantitatifs");
  // Le pilote propose à son tour une modification de la couche 1 (qui, quoi, pourquoi).
  await page.getByTestId("propose-layer").first().click();
  await page.getByTestId("propose-value").fill("Rendre visible l'ESS auprès des élus municipaux.");
  await page.getByTestId("propose-reason").fill("Orientation prise au CA de juin.");
  await page.getByTestId("propose-submit").click();
  await expect(page.getByText("Proposition envoyée")).toBeVisible();
  await expect(page.getByTestId("proposals")).toContainText("Orientation prise au CA de juin");
});

test("un chargé de mission propose un projet ; la fiche naît en statut proposée, ouverte, avec lui comme pilote", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Élise Fontaine");
  await page.getByTestId("propose-project").click();
  await page.getByTestId("propose-name").fill("Catalogue de formation ESS");
  await page.getByTestId("propose-summary").fill("Un partenaire nous sollicite pour un catalogue commun. Les têtes de réseau y gagneraient une visibilité.");
  await page.getByTestId("propose-project-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Catalogue de formation ESS");
  await expect(page.getByText("Proposée")).toBeVisible();
  await expect(page.getByTestId("fiche-locked")).toHaveCount(0);
  await expect(page.getByText("Pilote Élise Fontaine")).toBeVisible();
  await expect(page.getByTestId("field-operationalObjectives")).toContainText("catalogue commun");
});

test("les réalisations se consignent au fil de l'année et sortent dans le bilan ; une action se duplique avec sa petite fiche", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Inès Cabral");
  await openEditionByName(page, "Observatoire régional (ORESS)");
  await page.getByRole("tab", { name: /Bilan/ }).click();
  await expect(page.getByTestId("achievement-totals")).toContainText("55 personnes");
  await page.getByTestId("achievement-label").fill("Inscrits au petit-déjeuner d'octobre");
  await page.getByTestId("achievement-value").fill("27");
  await page.getByTestId("achievement-submit").click();
  await expect(page.getByText("Réalisation consignée")).toBeVisible();
  await expect(page.getByTestId("achievement-totals")).toContainText("82 personnes");
  const md = await page.request.get(page.url().replace(/\?.*$/, "") + "/export?format=md");
  expect(await md.text()).toContain("Inscrits au petit-déjeuner d'octobre");
  // Occurrences : le petit-déjeuner de mars a sa fiche ; « dupliquer » crée l'occurrence suivante.
  await page.getByRole("tab", { name: /Actions/ }).click();
  const idx = 2; // troisième action du jeu de démo : le petit-déjeuner de mars
  await expect(page.getByTestId(`action-name-${idx}`)).toHaveValue("Petit-déjeuner ORESS · mars · emploi");
  await page.getByTestId(`action-details-${idx}`).click();
  await expect(page.getByTestId(`action-extras-${idx}`)).toContainText("Chiffres de l'emploi ESS 2025");
  await page.getByTestId(`action-duplicate-${idx}`).click();
  await expect(page.getByText("Action dupliquée")).toBeVisible();
  await expect(page.locator("[data-testid^=action-name-]").last()).toHaveValue("Petit-déjeuner ORESS · mars · emploi (copie)");
});

test("le plan opérationnel s'assemble en un Word ; le plan de charge se fige et trace les modifications ; une remarque porte son motif", async ({ page }) => {
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  const docx = await page.request.get("/plan-operationnel/export?annee=2026");
  expect(docx.status()).toBe(200);
  expect(docx.headers()["content-type"]).toContain("wordprocessingml");
  // Figer le plan de charge 2026, puis modifier un mois : la modification est signalée.
  await page.goto("/plan-de-charge?debut=2026-09&horizon=6&pole=tous");
  // Le jeu de démo a figé 2026 au séminaire : on rouvre, puis on fige à nouveau pour montrer le geste.
  if (await page.getByTestId("load-unfreeze").count()) { await page.getByTestId("load-unfreeze").click(); await expect(page.getByTestId("load-freeze")).toBeVisible(); }
  await page.getByTestId("load-freeze").click();
  await expect(page.getByTestId("load-frozen")).toContainText("validé le");
  const hugoRow = page.locator("[data-testid^=load-row-]", { hasText: "Hugo Lemaire" });
  const hugoId = (await hugoRow.getAttribute("data-testid"))!.replace("load-row-", "");
  await page.getByTestId(`load-cell-${hugoId}-2026-11`).click();
  const field = page.locator(`[data-testid^=load-edit-${hugoId}-2026-11-]`).first();
  await field.fill("3");
  await field.blur();
  await expect(page.getByTestId("load-changed-after")).toContainText("1 modification après validation");
  await expect(page.getByTestId(`load-changed-${hugoId}`)).toBeVisible();
  // Remarque avec motif, en relecture, sur une fiche ouverte (proposée 2027).
  await page.goto("/portefeuille");
  await openEditionByName(page, "Réseau Femmes et ESS");
  await page.getByTestId("edition-years").getByText("Édition 2027").click();
  await expect(page.getByTestId("edition-years").getByText("Édition 2027")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("feedback-toggle").click();
  await page.getByTestId("remark-add-stakes").click();
  await page.getByTestId("remark-body-stakes").fill("La Région attend un lien explicite avec le SRESS.");
  await page.getByTestId("remark-reason-select-stakes").selectOption("funder");
  await page.getByTestId("remark-submit-stakes").click();
  await expect(page.locator("[data-testid^=remark-reason-]").filter({ hasText: "Financeur" }).first()).toBeVisible();
});
