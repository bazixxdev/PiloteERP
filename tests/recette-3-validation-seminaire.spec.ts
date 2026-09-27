import { test, expect } from "@playwright/test";
import { iAm, openEditionByName, pick } from "./helpers";
import { W, cap, pl } from "./vocab";

// Recette 3 (lot 3) : un devis demandé, validé au bon niveau, engagé sur l'édition ; les éditions 2027 créées en lot avec le
// contrôle de charge (« Préparer 2027 », 26/09) : chaque décision est consignée sur l'année 2026, et une action qui court sur
// 2026–2027 n'est pas recopiée en 2027 (elle y est déjà) — celle qui finit en 2026 l'est. Années du jeu de démo (faits fixes).
test("un devis est demandé, validé au bon niveau et engagé ; les éditions 2027 se créent en lot", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Inès Cabral");
  await openEditionByName(page, "Observatoire régional (ORESS)");

  // Engagé avant.
  await page.getByRole("tab", { name: "Budget" }).click();
  const euros = (t: string) => Number(t.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
  const before = euros(await page.getByTestId("budget-committed").innerText());

  // 1. Le pilote demande la validation d'un devis de 1 800 € : niveau 2 calculé (seuil 500 € / 3 000 €).
  await page.getByTestId("request-validation-open").click();
  await page.getByTestId("rv-amount").fill("1800");
  await page.getByTestId("rv-label").fill("Devis recette prestataire");
  await expect(page.getByTestId("rv-level")).toHaveAttribute("data-value", "2", { timeout: 10_000 });
  await page.getByTestId("rv-submit").click();
  await expect(page.getByTestId("validation-0")).toContainText("Devis recette prestataire");

  // Le pilote (niveau 1) ne peut pas la décider lui-même.
  await expect(page.getByTestId("validation-0")).toContainText("En attente d'un valideur");

  // 2. Le responsable de pôle (niveau 2) l'approuve depuis la file.
  await iAm(page, "Julien Barbot");
  await page.goto("/demandes");
  const card = page.getByTestId("for-me").locator("[data-testid^=validation-]", { hasText: "Devis recette prestataire" });
  await card.getByTestId("approve").click();
  await expect(page.getByText("Approuvée : le montant est engagé")).toBeVisible();

  // 3. Le devis approuvé remonte dans l'engagé de l'édition.
  await openEditionByName(page, "Observatoire régional (ORESS)");
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect.poll(async () => euros(await page.getByTestId("budget-committed").innerText())).toBe(before + 1800);

  // 4. « Préparer 2027 » : un projet créé pour le test en 2026, avec une action sur 2026–2027 et une qui finit en 2026.
  await iAm(page, "Claire Vasseur");
  await page.goto("/projets");
  await page.getByTestId("cp-open").click();
  await page.getByTestId("cp-name").fill("Projet recette Préparer");
  await page.getByTestId("cp-code").fill("REC-12");
  await pick(page, "cp-pilot", "Inès Cabral");
  await page.getByLabel("Année").fill("2026");
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projet recette Préparer", { timeout: 30_000 });
  const sourceUrl = page.url().split("?")[0];
  const addAction = async (name: string) => {
    await page.goto(`${sourceUrl}?onglet=actions`);
    await page.getByTestId("add-action-open").click();
    await page.getByTestId("add-action-input").fill(name);
    await page.getByTestId("add-action-submit").click();
    await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  };
  await addAction("Veille recette continue");
  await page.getByTestId("period-start").fill("2026-01-01");
  await page.getByTestId("period-end").fill("2027-06-30");
  await page.getByTestId("period-submit").click();
  await expect(page.getByText("Période enregistrée")).toBeVisible();
  await addAction("Atelier recette fini");

  // La direction crée les années 2027 en lot, le contrôle de charge s'affiche.
  await page.goto("/seminaire?annee=2027");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Préparer 2027");
  await page.getByTestId("batch-create").click();
  await expect(page.getByText(new RegExp(`${W.edition.one}\\(s\\) 2027 créée\\(s\\)`))).toBeVisible({ timeout: 20_000 });
  // Un seul projet reste sans année 2027 après le lot : « Refonte du site internet », interne et non récurrent, n'est
  // jamais proposé (26/09, action composante — lib/preparer.ts) ; le compteur ne peut donc pas atteindre N sur N.
  const summary = page.getByText(new RegExp(`\\d+ sur \\d+ ${pl(W.projet)} ont déjà leur ${W.edition.one} 2027`));
  await expect(summary).toBeVisible({ timeout: 20_000 });
  const [done, total] = (await summary.innerText()).match(/(\d+) sur (\d+)/)!.slice(1).map(Number);
  expect(done).toBe(total - 1);
  await expect(page.getByTestId("seminar-table").locator("tr", { hasText: "Refonte du site internet" })).toContainText("non proposé");
  await expect(page.getByTestId("load-table").locator("tr[data-testid^=load-row-]").first()).toBeVisible();
  await expect(page.getByTestId("batch-create")).toHaveCount(0);
  const row = page.getByTestId("seminar-table").locator("tr", { hasText: "Projet recette Préparer" });
  await expect(row).toContainText("décidé : reconduire");

  // La décision est consignée, datée, sur l'année 2026 (plus dans la fiche).
  await page.goto(`${sourceUrl}?onglet=fiche`);
  await expect(page.getByTestId("instance-decisions")).toContainText("Reconduit pour 2027");

  // 2027 : l'action qui continue y est une seule fois (la même), celle qui finissait en 2026 y est recopiée.
  await page.goto("/seminaire?annee=2027");
  await row.getByRole("link").last().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projet recette Préparer");
  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  const table = page.getByTestId("actions-table");
  await expect(table.getByRole("link", { name: "Veille recette continue" })).toHaveCount(1);
  await expect(table.getByRole("link", { name: "Atelier recette fini" })).toHaveCount(1);
  await expect(table.locator("tr", { hasText: "Atelier recette fini" })).toContainText("27");
});
