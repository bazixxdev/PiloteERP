import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";
import { dayjs } from "../lib/format";

// Simulation collective : une édition vit une semaine entre six personnes, dans l'ordre réel du fonctionnement cible.
// Direction (couche 1) → RAF (couche 2, financement) → pilote (couche 3, équipe, actions, devis) → contributeur (temps, discussion)
// → responsable de pôle (validation) → CODIR (portefeuille, café) → RAF (clôture).
test("une édition vit une semaine entre la direction, la RAF, le pilote, un contributeur et le responsable de pôle", async ({ page }) => {
  const soon = dayjs().add(5, "day").format("YYYY-MM-DD");
  const deliverableDue = dayjs().add(10, "day").format("YYYY-MM-DD");
  const thisWeek = `${dayjs().isoWeekYear()}-W${String(dayjs().isoWeek()).padStart(2, "0")}`;
  const monday = dayjs().startOf("isoWeek");

  // 1. La direction crée le projet, cadre la couche 1 et met l'édition en cours.
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  await page.getByTestId("cp-name").fill("Projet collectif Bêta");
  await page.getByTestId("cp-code").fill("COL-01");
  await page.getByTestId("cp-pilot").selectOption({ label: "Hugo Lemaire" });
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projet collectif Bêta", { timeout: 30_000 }); // première compilation de la vue édition
  const editionUrl = page.url().split("?")[0];
  await page.getByTestId("field-stakes").fill("Rendre visible l'ESS auprès des nouveaux élus.");
  await page.getByTestId("field-stakes").blur();
  await page.getByTestId("field-expectedOutcome").fill("Un plaidoyer repris par trois collectivités.");
  await page.getByTestId("field-expectedOutcome").blur();
  await page.getByTestId("edition-status").selectOption("in_progress");
  await expect(page.getByTestId("edition-status")).toHaveValue("in_progress");

  // 2. La RAF pose le cadre de moyens, une ligne de financement avec un livrable à J+10, et l'enveloppe.
  await iAm(page, "Nadia Ferrand");
  await page.goto(editionUrl);
  await expect(page.getByTestId("field-stakes")).toHaveAttribute("data-readonly", "true");
  await page.getByTestId("field-directExpenseEnvelope").fill("8000");
  await page.getByTestId("field-directExpenseEnvelope").blur();
  await page.getByRole("tab", { name: "Financements" }).click();
  await page.getByTestId("add-funding-funder").selectOption({ label: "Région" });
  await page.getByTestId("add-funding-submit").click();
  await expect(page.getByTestId("funding-line-0")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const line = page.getByTestId("funding-line-0");
  await line.getByTestId("add-deliverable-label").fill("Bilan intermédiaire");
  await line.getByTestId("add-deliverable-date").fill(deliverableDue);
  await expect(line.getByTestId("add-deliverable-submit")).toBeEnabled();
  await line.getByTestId("add-deliverable-submit").click();
  await expect(line.locator(`input[value="Bilan intermédiaire"]`)).toBeVisible();
  await expect(line).toContainText("dans 10 j");
  await page.getByRole("tab", { name: "Budget" }).click();
  await page.getByTestId("budget-budgetEnvelope").fill("8000");
  await page.getByTestId("budget-budgetEnvelope").blur();
  await expect(page.getByTestId("budget-remaining")).toContainText("8");

  // 3. Le pilote écrit sa proposition, compose l'équipe, crée une action pour l'alternant et lance la discussion.
  await iAm(page, "Hugo Lemaire");
  await page.goto(editionUrl);
  await expect(page.getByTestId("field-directExpenseEnvelope")).toHaveAttribute("data-readonly", "true");
  await page.getByTestId("field-operationalObjectives").fill("Deux rencontres et une note de plaidoyer.");
  await page.getByTestId("field-operationalObjectives").blur();
  await page.getByRole("button", { name: "Lucas Perrin" }).click();
  await page.getByRole("tab", { name: "Actions" }).click();
  await page.getByTestId("add-action-input").fill("Cartographie des élus");
  await page.getByTestId("add-action-submit").click();
  const row = page.getByTestId("action-row-0");
  await row.locator("select").first().selectOption({ label: "Lucas Perrin" });
  await row.locator('input[type="date"]').fill(soon);
  await row.locator('input[type="number"]').fill("21");
  await row.locator('input[type="number"]').blur();
  await page.getByRole("tab", { name: "Documents" }).click();
  await page.getByTestId("comment-input").fill("Lucas, peux-tu démarrer la cartographie cette semaine ?");
  await page.getByTestId("comment-submit").click();
  await expect(page.getByTestId("comments")).toContainText("démarrer la cartographie");

  // 4. Le contributeur retrouve son action dans « Ma semaine », saisit 3 h dessus, répond, mais ne peut pas écrire la couche 3.
  await iAm(page, "Lucas Perrin");
  await page.goto("/ma-semaine");
  // Le jalon est à J+5 : selon le jour, il tombe dans « Cette semaine » ou dans « Plus tard » (replié par défaut).
  await page.getByTestId("later").locator("summary").click();
  await expect(page.getByRole("link", { name: "Cartographie des élus" })).toBeVisible();
  await page.goto(`/temps?semaine=${thisWeek}`);
  const myRow = page.locator('[data-testid^="time-row-"]', { hasText: "Cartographie des élus" });
  await expect(myRow).toBeVisible();
  const dayIndex = Math.min(4, Math.max(0, dayjs().diff(monday, "day")));
  const cell = myRow.locator('input[type="number"]').nth(dayIndex);
  await cell.fill("3");
  await cell.blur();
  await expect(myRow).toContainText("3 h");
  await page.goto(editionUrl);
  await expect(page.getByTestId("field-operationalObjectives")).toHaveAttribute("data-readonly", "true");
  await page.getByRole("tab", { name: "Temps" }).click();
  await expect(page.getByTestId("time-by-action")).toContainText("3 h");
  await page.getByRole("tab", { name: "Documents" }).click();
  await page.getByTestId("comment-input").fill("Oui, c'est lancé : 3 h aujourd'hui.");
  await page.getByTestId("comment-submit").click();
  await expect(page.getByTestId("comments")).toContainText("c'est lancé");

  // 5. Le pilote demande un devis de 2 500 € (niveau 2) ; le responsable de pôle le voit dans « Ma semaine » et l'approuve.
  await iAm(page, "Hugo Lemaire");
  await page.goto(editionUrl);
  await page.getByTestId("request-validation-open").click();
  await page.getByTestId("rv-amount").fill("2500");
  await page.getByTestId("rv-label").fill("Devis impression du plaidoyer");
  await expect(page.getByTestId("rv-level")).toHaveValue("2");
  await page.getByTestId("rv-submit").click();
  await expect(page.getByTestId("validation-0")).toContainText("En attente d'un valideur");

  // Le pôle du projet est celui du premier pôle de l'admin (Représentation et observation) : son responsable est Julien Barbot.
  await iAm(page, "Julien Barbot");
  await page.goto("/ma-semaine");
  await expect(page.getByRole("link", { name: "Devis impression du plaidoyer" })).toBeVisible();
  await page.goto("/validations");
  const card = page.getByTestId("for-me").locator("[data-testid^=validation-]", { hasText: "Devis impression du plaidoyer" });
  await card.getByPlaceholder("Commentaire (facultatif)").fill("OK dans l'enveloppe.");
  await card.getByTestId("approve").click();
  await expect(page.getByText("Approuvée : le montant est engagé")).toBeVisible();

  // Un autre responsable de pôle ne voit pas cette demande ; la RAF ne valide pas.
  await iAm(page, "Sophie Delaunay");
  await page.goto("/validations");
  await expect(page.getByTestId("for-me")).not.toContainText("Devis impression du plaidoyer");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/validations");
  await expect(page.getByTestId("for-me")).toContainText("Rien à valider pour vous");

  // 6. Le CODIR : le portefeuille montre l'édition avec le livrable proche et l'engagé ; le café montre le jalon de Lucas et le livrable.
  await iAm(page, "Claire Vasseur");
  await page.goto("/portefeuille?mode=codir");
  const pf = page.getByTestId("portfolio-table").locator("tr", { hasText: "Projet collectif Bêta" });
  await expect(pf).toContainText("Bilan intermédiaire");
  await expect(pf).toContainText("Livrable dans 10 j");
  await expect(pf).toContainText("31 %");
  await page.goto(editionUrl + "?onglet=budget");
  await expect(page.getByTestId("budget-committed")).toContainText("2");
  await expect(page.getByTestId("budget-committed")).toContainText("500");
  await expect(page.getByTestId("budget-remaining")).toContainText("5");
  await page.goto("/cafe");
  await expect(page.getByText("Cartographie des élus")).toBeVisible();
  await expect(page.getByText("Bilan intermédiaire")).toBeVisible();
  await page.goto("/rappels");
  await expect(page.getByTestId("reminders")).toContainText("Bilan intermédiaire");
  await expect(page.getByTestId("reminders")).toContainText("Hugo Lemaire, Nadia Ferrand");

  // 7. La RAF clôture le mois : Lucas apparaît partiel (3 h sur un seul jour), elle le relance puis verrouille ; Lucas ne peut plus corriger.
  await iAm(page, "Nadia Ferrand");
  const month = dayjs().format("YYYY-MM");
  await page.goto(`/cloture?mois=${month}`);
  const lucas = page.getByTestId("cloture-table").locator("tr", { hasText: "Lucas Perrin" });
  await expect(lucas).toContainText("Partiel");
  await lucas.getByRole("button", { name: "Relancer" }).click();
  await expect(lucas).toContainText("Relancé·e");
  await lucas.getByRole("button", { name: "Verrouiller" }).click();
  await expect(lucas).toContainText("Verrouillé", { timeout: 10_000 });
  await iAm(page, "Lucas Perrin");
  await page.goto(`/temps?semaine=${thisWeek}`);
  await expect(page.getByText(/verrouillé par la RAF/).first()).toBeVisible();
  await expect(myRow.locator('input[type="number"]').nth(dayIndex)).toHaveAttribute("readonly", "");
});
