import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Lot 0 + lot B — Appels à projets (module « veille », activable par installation) : repérer, poser le statut d'équipe,
// promouvoir en convention à déposer une seule fois, retirer sans supprimer ; le radar montre les dépôts « on dépose ».

const AMI = 'tr[data-label="Appel à manifestation d\'intérêt · Tiers-lieux et coopérations"]';
const FDVA = 'tr[data-label="Fonds pour le développement de la vie associative (FDVA) · fonctionnement"]';

test("la RAF repère, le CODIR statue, « Étudier » crée la convention une seule fois, retirer ne supprime pas", async ({ page }) => {
  await page.goto("/echeances");
  await iAm(page, "Nadia Ferrand");
  // Radar : l'AMI Région « on dépose » (J-18) est une échéance de la RAF et de la direction.
  await page.goto("/echeances");
  const radar = page.getByTestId("reminders").locator("tr", { hasText: "Dépôt d'appel à projets" });
  await expect(radar.first()).toContainText("Appel à manifestation d'intérêt");
  await expect(radar.first()).toContainText("Nadia Ferrand, Claire Vasseur");

  await page.goto("/appels");
  await expect(page.getByTestId("dossiers-title-appels")).toBeVisible();
  const table = page.getByTestId("calls-table");
  // Le FDVA, repéré avant-hier et pas encore regardé, est « Nouveau » ; l'écarté DREETS est masqué par défaut.
  await expect(table.locator(FDVA)).toContainText("Nouveau");
  await expect(table.locator('tr[data-label="Appel à projets Impact social · expérimentations"]')).toHaveCount(0);
  await page.goto("/appels?vue=tous");
  await expect(page.getByTestId("calls-table").locator('tr[data-label="Appel à projets Impact social · expérimentations"]')).toBeVisible();

  // Statut d'équipe sur le FDVA.
  await page.goto("/appels");
  const fdvaId = (await page.getByTestId("calls-table").locator(FDVA).getAttribute("data-testid"))!.replace("call-", "");
  await pick(page, page.getByTestId(`call-status-${fdvaId}`), { value: "study" });
  await expect(page.getByText("Statut posé : À étudier")).toBeVisible();
  await expect(page.getByTestId("calls-table").locator(FDVA)).toHaveAttribute("data-status", "study");

  // « Ouvrir un dossier » sur l'AMI Région : le dossier « à étudier » s'ouvre, prérempli ; l'appel garde le lien et perd le bouton.
  const amiId = (await page.getByTestId("calls-table").locator(AMI).getAttribute("data-testid"))!.replace("call-", "");
  await page.getByTestId(`call-promote-${amiId}`).click();
  await expect(page.getByTestId("convention-REGION-2026")).toContainText("À étudier");
  await expect(page.getByTestId("dossier-funder")).toContainText("Région");
  await expect(page.getByTestId("dossier-stepper")).toHaveAttribute("data-status", "study");
  await page.goto("/appels");
  const ami = page.getByTestId("calls-table").locator(AMI);
  await expect(ami).toContainText("À étudier");
  await expect(ami.getByTestId(`call-convention-${amiId}`)).toHaveText("REGION-2026");
  await expect(page.getByTestId(`call-promote-${amiId}`)).toHaveCount(0);
  // Le radar ne montre plus l'AMI : c'est la convention qui vit désormais.
  await page.goto("/echeances");
  await expect(page.getByTestId("reminders").locator("tr", { hasText: "Appel à manifestation d'intérêt" })).toHaveCount(0);

  // Repérer un appel, puis le retirer : il sort de la liste, reste dans « Tous ».
  await page.goto("/appels");
  await page.getByTestId("call-add-open").click();
  await pick(page, "call-funder", "ADEME");
  await page.getByTestId("call-label").fill("AAP test mobilité durable");
  await page.getByTestId("call-deadline").fill("2027-02-15");
  await page.getByTestId("call-submit").click();
  const added = page.getByTestId("calls-table").locator('tr[data-label="AAP test mobilité durable"]');
  await expect(added).toBeVisible();
  const addedId = (await added.getAttribute("data-testid"))!.replace("call-", "");
  await page.getByTestId(`call-archive-${addedId}`).click();
  await expect(page.getByTestId("calls-table").locator('tr[data-label="AAP test mobilité durable"]')).toHaveCount(0);
  await page.goto("/appels?vue=tous");
  await expect(page.getByTestId("calls-table").locator('tr[data-label="AAP test mobilité durable"]')).toContainText("Retiré");

  // La fiche financeur liste ses appels.
  await page.goto("/organisations?genre=funder");
  await page.getByTestId("funder-page-Région").click();
  await expect(page.getByTestId("funder-calls")).toContainText("Appel à manifestation d'intérêt");
  await expect(page.getByTestId("funder-calls")).toContainText("REGION-2026");
});

test("un contributeur lit la veille sans agir ; la direction éteint le module et l'onglet disparaît", async ({ page }) => {
  await page.goto("/appels");
  await iAm(page, "Lucas Perrin");
  await page.goto("/appels");
  await expect(page.getByTestId("calls-table")).toBeVisible();
  await expect(page.getByTestId("call-add-open")).toHaveCount(0);
  await expect(page.locator("[data-testid^=call-status-]")).toHaveCount(0);
  await expect(page.locator("[data-testid^=call-promote-]")).toHaveCount(0);

  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=parametres");
  await page.getByTestId("instance-module-veille").uncheck();
  await expect(page.getByText("Module « Appels à projets (veille) » désactivé — les données restent")).toBeVisible();
  await page.goto("/conventions?vue=obtenus");
  await expect(page.locator("aside").getByRole("link", { name: "Appels à projets" })).toHaveCount(0);
  const res = await page.goto("/appels");
  expect(res?.status()).toBe(404);
  // On rallume : les appels sont toujours là.
  await page.goto("/admin?section=parametres");
  await page.getByTestId("instance-module-veille").check();
  await expect(page.getByText("Module « Appels à projets (veille) » activé")).toBeVisible();
  await page.goto("/appels");
  await expect(page.getByTestId("calls-table").locator(`tr[data-label="Cap'Asso · consolidation d'emploi"]`)).toBeVisible();
});
