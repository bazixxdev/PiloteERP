import { test, expect } from "@playwright/test";
import { iAm, openEditionByName, pick } from "./helpers";

// Convention partagée : une FSE 2026-2028 existe une fois, les éditions y sont affectées, la somme ne dépasse pas le notifié, la reconduction la conserve.
test("la convention FSE est unique, ses affectations sont plafonnées, la reconduction la rattache", async ({ page }) => {
  await page.goto("/conventions");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/conventions");
  const fse = page.getByTestId("convention-FSE-2026-2028");
  await expect(fse).toBeVisible();
  await expect(fse).toContainText("Dispositif local d'accompagnement (DLA) · 2026");
  await expect(fse).toContainText("Sensibilisation des jeunes · 2026");

  // Plafond : une affectation qui dépasse le notifié est refusée avec l'écart.
  await openEditionByName(page, "Dispositif local d'accompagnement (DLA)");
  await page.getByRole("tab", { name: "Budget" }).click();
  // La ligne se lit dans le tableau ; la gestion (montants, convention) se fait dans son panneau (revue du 15/09).
  const fseLine = page.locator("[data-testid^=funding-line-]", { hasText: "FSE-2026-2028" }).first();
  await fseLine.locator("[data-testid$=-open]").click();
  const panel = page.locator("[data-slot=sheet-content]");
  await expect(panel).toContainText("reste à affecter");
  const granted = panel.locator('input[type="number"]').nth(1);
  const before = await granted.inputValue();
  await granted.fill("999999");
  await granted.blur();
  await expect(page.getByText(/Les affectations confirmées atteindraient/)).toBeVisible();
  await expect(granted).toHaveValue(before);
  await page.keyboard.press("Escape");

  // Création d'une convention et rattachement d'une édition.
  await page.goto("/conventions");
  await page.getByTestId("cc-open").click();
  await pick(page, "cc-funder", "ADEME");
  await page.getByTestId("cc-reference").fill("ADEME-TEST-2026-2027");
  await page.getByTestId("cc-notified").fill("30000");
  await page.getByTestId("cc-submit").click();
  // La création ouvre la page de la convention ; la liste la montre ensuite sans édition rattachée.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ADEME-TEST-2026-2027");
  await expect(page.getByTestId("convention-lines")).toContainText(/aucune édition rattachée/i);
  // Depuis la convention : rattacher une édition couverte par la période, puis la détacher (ligne vide → supprimée).
  await pick(page, "attach-edition-select", "Observatoire régional (ORESS) · 2026");
  await page.getByTestId("attach-edition-submit").click();
  await expect(page.getByTestId("convention-lines-table")).toContainText("Observatoire régional (ORESS) · 2026");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("convention-lines").getByRole("button", { name: "Détacher" }).click();
  await expect(page.getByText(/Ligne vide supprimée|Édition détachée/)).toBeVisible();
  await expect(page.getByTestId("convention-lines-table")).toHaveCount(0);
  await page.goto("/conventions");
  await expect(page.getByTestId("convention-ADEME-TEST-2026-2027")).toContainText("aucune");
  await openEditionByName(page, "Chroniquer la TESS");
  await page.getByRole("tab", { name: "Budget" }).click();
  await page.getByTestId("add-funding-open").click();
  const opt = page.getByTestId("attach-convention-select").locator("option", { hasText: "ADEME-TEST-2026-2027" });
  await page.getByTestId("attach-convention-select").selectOption(await opt.getAttribute("value") as string);
  await page.getByTestId("attach-convention-submit").click();
  await expect(page.locator("[data-testid^=funding-line-]", { hasText: "ADEME-TEST-2026-2027" })).toHaveCount(1);

  // Reconduction : la ligne 2027 reste rattachée à la convention qui couvre 2027.
  await page.getByTestId("edition-menu").click();
  await page.getByTestId("renew-open").click();
  await page.getByTestId("renew-confirm").click();
  await expect(page.getByTestId("edition-years").locator('[aria-current="page"]')).toContainText("2027", { timeout: 15_000 });
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect(page.locator("[data-testid^=funding-line-]", { hasText: "ADEME-TEST-2026-2027" })).toHaveCount(1);
  await page.goto("/conventions");
  await expect(page.getByTestId("convention-ADEME-TEST-2026-2027")).toContainText("Chroniquer la TESS · 2027");
});
