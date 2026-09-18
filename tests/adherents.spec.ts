import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Adhérents + HelloAsso (18/09) : les adhésions d'une année (structures ou personnes de l'annuaire), règlement, reconduction,
// export ; le connecteur HelloAsso contre tests/helloasso-mock.mjs (adhésions importées, inscrits d'un événement en liste).

const YEAR = new Date().getFullYear();

test("la RAF tient les adhésions : nouvelle structure, règlement en un clic, filtre, cotisations par collège, export", async ({ page }) => {
  await page.goto("/adherents");
  await iAm(page, "Nadia Ferrand");
  await page.goto("/adherents");
  // Le seed : 8 structures + 2 personnes en cours d'année, 6 à jour, 4 à régler.
  const tiles = page.getByTestId("members-tiles");
  await expect(tiles).toContainText("10");
  await expect(page.getByTestId("members-table")).toContainText("Coop'Alim Berry");
  await expect(page.getByTestId("members-table")).toContainText("Léna Bourgeois");
  // Une nouvelle structure, par son nom : elle entre dans l'annuaire des organisations (genre adhérent).
  await page.getByTestId("new-membership").click();
  await page.getByTestId("membership-organisationName").fill("Café associatif de Loches");
  await page.getByTestId("membership-referent-lastName").fill("Morel");
  await page.getByTestId("membership-referent-email").fill("j.morel@exemple.fr");
  await page.getByTestId("membership-college").fill("Associations");
  await page.getByTestId("membership-amount").fill("90");
  await page.getByTestId("membership-submit").click();
  await expect(page.getByText("Adhésion enregistrée")).toBeVisible();
  const row = page.locator('[data-testid^=membership-][data-member="Café associatif de Loches"]');
  await expect(row).toHaveAttribute("data-status", "due");
  await expect(row).toContainText("Morel");
  // Réglée en un clic (moyen demandé).
  await row.locator("[data-testid^=membership-pay-]").first().click();
  await row.locator("[data-testid^=membership-pay-confirm-]").click();
  await expect(page.getByText("Cotisation réglée")).toBeVisible();
  await expect(row).toHaveAttribute("data-status", "paid");
  // Filtre « à régler » : les 4 du seed restent.
  await page.getByTestId("members-status-due").click();
  await expect(page.locator("[data-testid^=membership-][data-status]")).toHaveCount(4);
  await expect(page.getByTestId("members-table")).toContainText("Emploi Solidaire 41");
  // Vue Cotisations : par collège, reste à encaisser.
  await page.goto(`/adherents?vue=cotisations&annee=${YEAR}`);
  await expect(page.getByTestId("members-by-college")).toContainText("Coopératives");
  await expect(page.getByTestId("members-due")).toContainText("Emploi Solidaire 41");
  // Export.
  const href = (await page.getByTestId("members-export").getAttribute("href"))!;
  const csv = await (await page.request.get(href)).text();
  expect(csv).toContain("Adhérent;Type;Année;Collège;Cotisation;Statut");
  expect(csv).toContain("Café associatif de Loches;Structure");
  // L'organisation adhérente porte ses adhésions sur sa fiche ; un pilote lit sans modifier.
  await page.goto("/organisations?q=loches");
  await page.locator("[data-testid^=organisation-open-]").first().click();
  await expect(page.getByTestId("organisation-memberships")).toContainText(String(YEAR));
  await expect(page.getByTestId(`membership-row-${YEAR}`)).toHaveAttribute("data-status", "paid");
  await page.goto("/adherents");
  await iAm(page, "Maxime Roussel");
  await expect(page.getByTestId("members-table")).toContainText("Coop'Alim Berry");
  await expect(page.getByTestId("new-membership")).toHaveCount(0);
});

test("la reconduction prépare l'année suivante ; la synchronisation HelloAsso règle ce qui était préparé, crée le reste, suit les inscrits d'un événement", async ({ page }) => {
  page.on("dialog", (d) => d.accept()); // la reconduction demande confirmation
  await page.goto("/adherents");
  await iAm(page, "Claire Vasseur");
  // Reconduire N → N+1 : les adhérents de l'année (hors annulées) passent « à régler » en N+1.
  await page.goto(`/adherents?annee=${YEAR + 1}`);
  await expect(page.getByTestId("members-tiles")).toContainText("0");
  await page.getByTestId("members-renew").click();
  await expect(page.getByText(/adhésions reconduites/)).toBeVisible();
  await expect(page.locator("[data-testid^=membership-][data-status]")).toHaveCount(11);
  await expect(page.locator("[data-testid^=membership-][data-status=due]")).toHaveCount(10); // l'exonérée le reste
  // HelloAsso (admin) : suivre le forum, synchroniser.
  await page.goto("/admin?section=donnees");
  const panel = page.getByTestId("helloasso-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("helloasso-forms")).toContainText("Adhésion 2026");
  await page.getByTestId("helloasso-follow-forum-regional-2026").click();
  await expect(page.getByText(/« Forum régional de l'ESS 2026 » suivi/)).toBeVisible();
  await expect(panel.getByTestId("helloasso-last-sync")).toContainText("3 adhésions (2 nouvelles, 1 mise à jour)");
  // Sur la page Adhérents 2026 : Tiers-lieu de Vierzon créé et réglé (HelloAsso), Théo Lambert à titre personnel,
  // Scop Bâti Loire — qui était « à régler » — réglée par HelloAsso, sans doublon.
  await page.goto("/adherents?annee=2026");
  const tiers = page.locator('[data-testid^=membership-][data-member="Tiers-lieu de Vierzon"]');
  await expect(tiers).toHaveAttribute("data-status", "paid");
  await expect(tiers).toContainText("HelloAsso");
  await expect(tiers).toContainText("Ali Nouveau");
  await expect(page.locator('[data-testid^=membership-][data-member="Théo Lambert"]')).toContainText("Personne physique");
  const scop = page.locator('[data-testid^=membership-][data-member="Scop Bâti Loire"]');
  await expect(scop).toHaveCount(1);
  await expect(scop).toHaveAttribute("data-status", "paid");
  await expect(scop).toContainText("HelloAsso");
  // Une seconde synchronisation ne recrée rien.
  await page.getByTestId("helloasso-sync").click();
  await expect(page.getByText(/3 adhésions \(0 nouvelle, 0 mise à jour\)/)).toBeVisible();
  // Les inscrits du forum : liste miroir, tarif en rôle, atelier en colonne ; l'inscription annulée n'y est pas.
  await page.goto("/contacts");
  await page.getByTestId("helloasso-contact-lists").locator('[data-name="Forum régional de l\'ESS 2026"]').click();
  await expect(page.getByTestId("contact-list-mirror")).toContainText("HelloAsso");
  await expect(page.getByTestId("contact-list-count")).toContainText("3 contacts");
  const table = page.getByTestId("contact-list-table");
  await expect(table).toContainText("Marius Garnier");
  await expect(table).toContainText("Chloé Petit");
  await expect(table).toContainText("Fatou Diallo");
  await expect(table).not.toContainText("Annulée");
  await expect(table.locator("tr", { hasText: "Marius Garnier" }).locator("[data-testid^=cell-ha_atelier-]")).toHaveAttribute("data-value", "Coopération");
  await expect(table.locator("tr", { hasText: "Marius Garnier" }).locator("[data-testid^=cell-role-]")).toHaveValue("Tarif adhérent");
  // La liste de base « Adhérents à jour » suit : le référent de Coop'Alim Berry y est, celui d'Emploi Solidaire 41 (à régler) non.
  await page.getByTestId("base-contact-lists").locator(`[data-name="Adhérents à jour · ${YEAR}"]`).click();
  await expect(page.getByTestId("contact-list-table")).toContainText("Bastien Lefort");
  await expect(page.getByTestId("contact-list-table")).not.toContainText("Kevin Marchal");
  await expect(page.getByTestId("contact-list-table")).toContainText("Ali Nouveau");
});
