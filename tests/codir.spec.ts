import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Écran CODIR : seulement les points à décider, et la décision se consigne sur l'édition sans quitter l'écran.
test("le CODIR voit les points à traiter, consigne une décision, qui apparaît sur l'édition", async ({ page }) => {
  await page.goto("/codir");
  await iAm(page, "Claire Vasseur");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Écran CODIR");
  await expect(page.getByTestId("codir-validations-en-attente")).toBeVisible();
  await expect(page.getByTestId("codir-jalons-d-pass-s")).toBeVisible();

  const first = page.getByTestId("codir-jalons-d-pass-s").locator("li").first();
  const project = await first.getByRole("link").first().innerText();
  await first.getByTestId("decision-open").click();
  await page.getByTestId("decision-body").fill("Jalon reporté au 15 octobre, le pilote informe le financeur.");
  await page.getByTestId("decision-submit").click();
  await expect(page.getByText("Décision consignée sur l'édition")).toBeVisible();
  await expect(page.getByTestId("recent-decisions")).toContainText("Jalon reporté au 15 octobre");

  await page.getByTestId("recent-decisions").getByRole("link", { name: new RegExp(project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
  await expect(page.getByTestId("instance-decisions")).toContainText("Jalon reporté au 15 octobre");
  await expect(page.getByTestId("instance-decisions")).toContainText("CODIR");

  // Un pilote ne consigne pas de décision d'instance.
  await iAm(page, "Inès Cabral");
  await page.goto("/codir");
  await expect(page.getByText("Réservé au CODIR")).toBeVisible();
});
