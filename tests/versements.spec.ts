import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Lot A — Versements : l'argent attendu puis reçu, sur une ligne de financement (cas courant) ou sur une convention (tranches).
// « Reçu » est posé par la RAF ou la direction ; le reste à percevoir se calcule ; un versement dépassé alerte la RAF et la direction.

test("la convention FSE porte ses tranches : versé, reste à percevoir, ajout et réception par la RAF", async ({ page }) => {
  await page.goto("/conventions");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/conventions");
  // La liste montre le versé et le reste de chaque convention.
  await expect(page.getByTestId("received-FSE-2026-2028")).toContainText(/49.500/);
  await expect(page.getByTestId("received-FSE-2026-2028")).toContainText(/reste 115.500/);

  await page.getByTestId("open-convention-FSE-2026-2028").click();
  await expect(page.getByTestId("received-FSE-2026-2028")).toContainText(/49.500/);
  const list = page.getByTestId("convention-payments-list");
  // Les libellés sont des champs modifiables en place (RAF) : on lit leur valeur, pas du texte.
  await expect(list.getByTestId("convention-payments-list-todo").locator('input[value="Acompte 2027 sur bilan intermédiaire"]')).toBeVisible();
  await expect(list.getByTestId("convention-payments-list-summary")).toContainText(/reste à percevoir 115.500/);

  // Ajout d'une tranche, puis réception : le versé et le reste bougent.
  await page.getByTestId("convention-payments-list-add-open").click();
  await page.getByTestId("convention-payments-list-add-label").fill("Régularisation test");
  await page.getByTestId("convention-payments-list-add-amount").fill("1000");
  await page.getByTestId("convention-payments-list-add-date").fill("2026-12-01");
  await page.getByTestId("convention-payments-list-add-submit").click();
  const row = list.locator("li").filter({ has: page.locator('input[value="Régularisation test"]') });
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("data-status", "expected");
  await row.locator('input[type="checkbox"]').check();
  await expect(row).toHaveAttribute("data-status", "received");
  await expect(page.getByTestId("received-FSE-2026-2028")).toContainText(/50.500/);
  await expect(list.getByTestId("convention-payments-list-summary")).toContainText(/reste à percevoir 114.500/);
  // Un versement reçu ne se supprime pas : le bouton n'existe plus.
  await expect(row.locator("[data-testid^=payment-delete-]")).toHaveCount(0);
});

test("l'édition lit ses versements par ligne ; le seul solde en retard est signalé et arrive dans le radar et la cloche", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Nadia Ferrand");
  await openEditionByName(page, "Cycle de conférences transition");
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect(page.getByTestId("funding-received-total")).toContainText(/versés/);
  await expect(page.getByTestId("funding-received-0")).toContainText("1 en retard");
  const section = page.getByTestId("edition-payments");
  await expect(section).toContainText("1 en retard");
  const late = section.locator("li[data-status=late]");
  await expect(late).toHaveCount(1);
  await expect(late).toContainText("Solde après justificatifs");
  await expect(late).toContainText("ADEME");

  // Radar : un « Versement attendu » en retard, prévenus = RAF et direction.
  await page.goto("/echeances");
  const rowRadar = page.getByTestId("reminders").locator("tr", { hasText: "Versement attendu" });
  await expect(rowRadar).toHaveCount(1);
  await expect(rowRadar).toContainText("Solde après justificatifs");
  await expect(rowRadar).toContainText("Nadia Ferrand");
  await expect(rowRadar).toContainText("Claire Vasseur");

  // Cloche : la notification de retard existe pour la RAF, puis pour la direction.
  await page.goto("/notifications");
  await expect(page.getByText(/Versement en retard : Solde après justificatifs/).first()).toBeVisible();
  await iAm(page, "Claire Vasseur");
  await page.goto("/notifications");
  await expect(page.getByText(/Versement en retard : Solde après justificatifs/).first()).toBeVisible();
});

test("un contributeur lit les versements sans pouvoir les modifier", async ({ page }) => {
  await page.goto("/conventions");
  await iAm(page, "Lucas Perrin");
  await page.goto("/conventions");
  await page.getByTestId("open-convention-FSE-2026-2028").click();
  const list = page.getByTestId("convention-payments-list");
  await expect(list).toContainText("Acompte 2027");
  await expect(list.locator("input[type=text], input[type=number]")).toHaveCount(0);
  await expect(page.getByTestId("convention-payments-list-add-open")).toHaveCount(0);
  await expect(list.locator('input[type="checkbox"]').first()).toBeDisabled();
});
