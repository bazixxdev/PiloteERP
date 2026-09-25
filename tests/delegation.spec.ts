import { test, expect } from "@playwright/test";
import { dayjs } from "../lib/format";
import { iAm } from "./helpers";

// Délégation (25/09) : la direction délègue à une personne sur un projet, la personne en prend connaissance ; une
// modification redemande la lecture et garde l'ancien texte ; la présentation au CA devient une décision sur la fiche.
const OBS = "Observatoire régional (ORESS)";

test("la direction délègue, la personne prend connaissance, une modification redemande la lecture, le CA est consigné", async ({ page, request }) => {
  await page.goto("/ma-semaine");
  await iAm(page, "Claire Vasseur");
  await page.goto("/delegation");
  await expect(page.getByTestId("delegation-people")).toContainText("Thomas Guérin");

  const form = page.getByTestId("delegation-new");
  await form.getByTestId("delegation-new-person").selectOption({ label: "Inès Cabral" });
  await form.getByLabel(OBS).check();
  await form.getByTestId("delegation-new-submit").click();
  await expect(page).toHaveURL(/personne=/);
  const card = page.locator("[data-testid^=delegation-card-]").filter({ hasText: OBS });
  await card.getByLabel("Limites").fill("Pas de publication sans relecture de la direction.");
  await card.getByRole("button", { name: /Enregistrer/ }).click();
  await expect(card.getByText("à relire")).toBeVisible();

  // Un objectif créé depuis la vue est une étape du projet, avec la personne pour responsable.
  await card.getByRole("button", { name: "Ajouter un objectif" }).click();
  await card.getByPlaceholder("Objectif ou résultat attendu").fill("Note de conjoncture du trimestre publiée");
  await card.locator("input[type=date]").fill(dayjs().add(10, "day").format("YYYY-MM-DD"));
  await card.getByRole("button", { name: "Ajouter" }).click();
  await expect(card.locator("[data-testid^=delegation-objectives-]")).toContainText("Note de conjoncture du trimestre publiée");

  await iAm(page, "Inès Cabral");
  await page.goto("/delegation");
  await expect(page.getByTestId("delegation-ack-state")).toContainText("à relire");
  await expect(page.getByText("Pas de publication sans relecture de la direction.")).toBeVisible();
  await page.getByTestId("delegation-ack").click();
  await expect(page.getByTestId("delegation-ack-state")).toContainText("Lu, pris en compte");

  await iAm(page, "Claire Vasseur");
  await page.goto("/delegation");
  await page.getByTestId("delegation-people").getByRole("link", { name: /Inès Cabral/ }).click();
  const again = page.locator("[data-testid^=delegation-card-]").filter({ hasText: OBS });
  await again.getByLabel("Limites").fill("Pas de publication sans relecture de la direction ni du pôle.");
  await again.getByRole("button", { name: /Enregistrer/ }).click();
  await expect(again.getByText("à relire")).toBeVisible();
  await expect(again.locator("[data-testid^=delegation-history-]")).toContainText("1 version précédente");

  await page.getByTestId("delegation-board").click();
  await page.getByTestId("delegation-board-save").click();
  await expect(page.getByTestId("delegation-ack-state")).toContainText("Présentée au CA le");

  const href = await page.getByTestId("delegation-export").getAttribute("href");
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const doc = await request.get(href!, { headers: { cookie } });
  expect(doc.status()).toBe(200);
  expect(doc.headers()["content-type"]).toContain("wordprocessingml");

  // La présentation au CA est consignée en décision sur la fiche du projet.
  await again.getByRole("link", { name: /Ouvrir la fiche/ }).click();
  await page.getByRole("tab", { name: "Aperçu" }).click();
  await expect(page.getByText(/Délégation de Inès Cabral présentée au CA/)).toBeVisible();
});
