import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Budget prévisionnel (25/09) : le pilote prépare, la RAF valide et saisit un réalisé à la main ; le détail du personnel
// (salaires) n'apparaît qu'à qui tient la trésorerie ou valide ; un dépassement s'affiche dans la bande d'état.
const OBS = "Observatoire régional (ORESS)";

test("le pilote modifie un budget validé : il repasse à valider ; la RAF le valide, saisit un réalisé motivé, l'écart et l'alerte suivent", async ({ page, request }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Inès Cabral");
  await openEditionByName(page, OBS);
  await page.getByRole("tab", { name: "Budget" }).click();
  const section = page.getByTestId("budget-plan");
  await expect(section.getByTestId("budget-plan-status")).toContainText("Validé");
  await expect(section.getByTestId("budget-row-bcat_personnel")).toContainText("Chargée de mission et appui du pôle");
  await expect(section.getByTestId("budget-personnel-hours")).toContainText("h saisies");
  // Le pilote ne voit pas le coût par personne.
  await expect(section.getByTestId("budget-personnel-detail")).toHaveCount(0);
  await expect(section.getByTestId("budget-plan-validate")).toHaveCount(0);

  await section.getByTestId("budget-line-category").selectOption({ label: "Achats et fournitures" });
  await section.getByTestId("budget-line-label").fill("Ramettes et encre");
  await section.getByTestId("budget-line-amount").fill("250");
  await section.getByTestId("budget-line-submit").click();
  await expect(section.getByTestId("budget-row-bcat_achats")).toContainText("Ramettes et encre");
  await expect(section.getByTestId("budget-plan-status")).toContainText("À valider");

  await iAm(page, "Nadia Ferrand");
  await expect(section.getByTestId("budget-personnel-detail")).toContainText("Inès Cabral");
  await section.getByTestId("budget-plan-validate").click();
  await expect(section.getByTestId("budget-plan-status")).toContainText("Validé");

  await section.getByTestId("budget-override-open-bcat_prestations").click();
  await section.getByTestId("budget-override-amount-bcat_prestations").fill("500");
  await expect(section.getByTestId("budget-override-save-bcat_prestations")).toBeDisabled(); // motif obligatoire
  await section.getByTestId("budget-override-reason-bcat_prestations").fill("Facture de l'enquête reçue, pas encore au grand livre");
  await section.getByTestId("budget-override-save-bcat_prestations").click();
  await expect(section.getByTestId("budget-actual-bcat_prestations")).toContainText("saisi à la main");
  await expect(section.getByTestId("budget-gap-bcat_prestations")).toContainText("-200");
  await expect(page.getByTestId("alert-bar")).toContainText("Prestations");

  const href = await section.getByTestId("budget-plan-export").getAttribute("href");
  const csv = await request.get(href!, { headers: { cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } });
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  expect(text).toContain("Prestations");
  expect(text).not.toContain("Inès Cabral"); // l'export ne porte jamais le détail par personne
});

test("un contributeur hors de l'équipe lit le budget sans pouvoir le préparer", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Lucas Perrin");
  await page.goto("/portefeuille?perimetre=cress");
  await page.getByRole("link", { name: OBS, exact: true }).first().click();
  await page.getByRole("tab", { name: "Budget" }).click();
  const section = page.getByTestId("budget-plan");
  await expect(section.getByTestId("budget-plan-table")).toBeVisible();
  await expect(section.getByTestId("budget-line-submit")).toHaveCount(0);
  await expect(section.getByTestId("budget-personnel-detail")).toHaveCount(0);
});
