import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Tableaux de contacts (19/09) : tri par colonne, filtres par colonne, sélection multiple et actions groupées — ajouter à une
// liste, déplacer, modifier un champ pour tous, exporter la sélection, retirer de la liste, supprimer définitivement.

test("l'annuaire se trie, se filtre, se sélectionne ; un mot-clé s'ajoute à plusieurs contacts d'un coup", async ({ page }) => {
  await page.goto("/contacts");
  await expect(page.getByTestId("contacts-table")).toBeVisible();
  const rows = page.locator("[data-testid^=contact-row-]");
  const total = await rows.count();
  expect(total).toBeGreaterThan(5);
  // Tri par structure : la première ligne change.
  const first = await rows.first().innerText();
  await page.getByTestId("sort-organisation").click();
  await expect(rows.first()).not.toHaveText(first);
  // Filtre par colonne : seules les lignes de la Région restent, le compteur le dit.
  await page.getByTestId("filter-organisation").fill("Région");
  await expect(page.getByTestId("directory-count")).toContainText(`sur ${total}`);
  const shown = await rows.count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(total);
  for (let i = 0; i < shown; i++) await expect(rows.nth(i)).toContainText("Région");
  // Tout sélectionner = les lignes filtrées ; le bandeau compte.
  await page.getByTestId("select-all").check();
  await expect(page.getByTestId("bulk-count")).toContainText(`${shown} sélectionné`);
  // Modifier : ajouter un mot-clé à tous.
  await page.getByTestId("bulk-edit").click();
  await pick(page, "bulk-edit-field", "Ajouter un mot-clé");
  await page.getByTestId("bulk-edit-value").fill("test-groupe");
  await page.getByTestId("bulk-edit-submit").click();
  await expect(page.getByText(`${shown} contacts modifiés`)).toBeVisible();
  for (let i = 0; i < shown; i++) await expect(rows.nth(i)).toContainText("test-groupe");
  // Le filtre par mot-clé depuis l'adresse marche toujours (liens depuis une fiche).
  await page.goto("/contacts?tag=test-groupe");
  await expect(page.locator("[data-testid^=contact-row-]")).toHaveCount(shown);
  // Effacer les filtres rend tout.
  await page.getByTestId("contacts-reset-filters").click();
  await expect(page.locator("[data-testid^=contact-row-]")).toHaveCount(total);
});

test("dans une liste : ajouter à une autre liste, déplacer, valeur de colonne pour tous, retirer, supprimer définitivement", async ({ page }) => {
  await page.goto("/contacts");
  await iAm(page, "Thomas Guérin");
  await page.goto("/contacts");
  // Deux listes à Thomas : « Source » (avec une colonne case) et « Cible ».
  for (const name of ["Source test", "Cible test"]) {
    await page.goto("/contacts");
    await page.getByTestId("new-contact-list").first().click();
    await page.getByTestId("new-contact-list-name").fill(name);
    await page.getByTestId("new-contact-list-submit").click();
    await expect(page.getByTestId("contacts-main")).toHaveAttribute("data-name", name);
  }
  await page.getByTestId("contact-lists").locator('[data-name="Source test"]').first().click();
  await expect(page.getByTestId("contacts-main")).toHaveAttribute("data-name", "Source test");
  await page.locator("[data-testid^=contact-list-settings-]").click();
  await page.getByTestId("add-field-label").fill("Relancé");
  await page.getByTestId("add-field-submit").click();
  await expect(page.getByText("Colonne ajoutée")).toBeVisible();
  await page.keyboard.press("Escape");
  // Trois contacts de l'annuaire, sélectionnés d'un coup, ajoutés à « Source test ».
  await page.getByTestId("contacts-view-all").click();
  const rows = page.locator("[data-testid^=contact-row-]");
  const names: string[] = [];
  for (let i = 0; i < 3; i++) { names.push((await rows.nth(i).locator("a").first().innerText()).trim()); await rows.nth(i).locator("[data-testid^=select-]").check(); }
  await expect(page.getByTestId("bulk-count")).toContainText("3 sélectionnés");
  await page.getByTestId("bulk-add").click();
  await pick(page, "bulk-list-target", "Source test");
  await page.getByTestId("bulk-list-submit").click();
  await expect(page.getByText("3 ajoutés")).toBeVisible();
  await page.getByTestId("contact-lists").locator('[data-name="Source test"]').first().click();
  await expect(page.getByTestId("contacts-main")).toHaveAttribute("data-name", "Source test");
  const table = page.getByTestId("contact-list-table");
  for (const n of names) await expect(table).toContainText(n);
  await expect(page.getByTestId("contact-list-count")).toContainText("3 contacts");
  // Tout sélectionner, cocher « Relancé » pour tous.
  await page.getByTestId("select-all").check();
  await page.getByTestId("bulk-edit").click();
  await pick(page, "bulk-edit-field", "Relancé");
  await page.getByTestId("bulk-edit-submit").click();
  await expect(page.getByText("3 contacts modifiés")).toBeVisible();
  for (let i = 0; i < 3; i++) await expect(page.locator("[data-testid^=cell-relance-]").nth(i)).toBeChecked();
  // Le filtre « Relancé = non » ne montre plus rien ; « oui » tout.
  await pick(page, "filter-f:relance", "Non");
  await expect(page.locator("tr[data-testid^=contact-item-]")).toHaveCount(0);
  await pick(page, "filter-f:relance", "Oui");
  await expect(page.locator("tr[data-testid^=contact-item-]")).toHaveCount(3);
  // Déplacer un contact vers « Cible test » : il quitte Source, il est dans Cible.
  await page.getByTestId("bulk-clear").click();
  await page.locator("tr[data-testid^=contact-item-]").first().locator("[data-testid^=select-]").check();
  await expect(page.getByTestId("bulk-count")).toContainText("1 sélectionné");
  await page.getByTestId("bulk-move").click();
  await pick(page, "bulk-list-target", "Cible test");
  await page.getByTestId("bulk-list-submit").click();
  await expect(page.getByText("1 ajouté · 1 retiré d'ici")).toBeVisible();
  await expect(page.getByTestId("contact-list-count")).toContainText("2 sur 2"); // le filtre « Relancé = oui » est toujours posé
  await page.getByTestId("contact-lists").locator('[data-name="Cible test"]').first().click();
  await expect(page.getByTestId("contacts-main")).toHaveAttribute("data-name", "Cible test");
  await expect(page.getByTestId("contact-list-count")).toContainText("1 contact"); // les filtres ne suivent pas d'une liste à l'autre
  // Exporter la sélection : un CSV avec la colonne « Rôle dans la liste ».
  await page.locator("tr[data-testid^=contact-item-]").first().locator("[data-testid^=select-]").check();
  const download = page.waitForEvent("download");
  await page.getByTestId("bulk-export").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Cible test-selection.csv");
  // Retirer de la liste : le contact reste dans l'annuaire.
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("bulk-remove").click();
  await expect(page.getByText("Retirés de la liste")).toBeVisible();
  await expect(page.getByTestId("contact-list-count")).toContainText("0 contact");
  await page.getByTestId("contacts-view-all").click();
  await expect(page.locator("[data-testid^=contact-row-]")).toHaveCount(await rows.count());
});

test("supprimer définitivement est réservé à l'administration, refuse les contacts cités par un financement, et propose Brevo seulement pour les contacts qui en viennent", async ({ page }) => {
  await page.goto("/contacts");
  await iAm(page, "Thomas Guérin");
  await page.goto("/contacts");
  await page.locator("[data-testid^=contact-row-]").first().locator("[data-testid^=select-]").check();
  await expect(page.getByTestId("bulk-bar")).toBeVisible();
  await expect(page.getByTestId("bulk-delete")).toHaveCount(0); // pilote : pas de suppression de masse
  await iAm(page, "Claire Vasseur");
  await page.goto("/contacts");
  // Un contact que rien ne cite (Clémence Robert) et un interlocuteur cité par des financements (Awa Sy) : seul le premier part.
  await page.getByTestId("filter-name").fill("Robert");
  await expect(page.getByTestId("directory-count")).toContainText("1 sur");
  await page.getByTestId("select-all").check();
  await page.getByTestId("filter-name").fill("Sy");
  await expect(page.locator("[data-testid^=contact-row-]", { hasText: "Awa Sy" })).toHaveCount(1);
  await page.locator("[data-testid^=contact-row-]", { hasText: "Awa Sy" }).locator("[data-testid^=select-]").check();
  await page.getByTestId("contacts-reset-filters").click();
  await expect(page.getByTestId("bulk-count")).toContainText("2 sélectionnés");
  await page.getByTestId("bulk-delete").click();
  await expect(page.getByTestId("bulk-delete-dialog")).toContainText("Supprimer définitivement 2 contacts ?");
  await expect(page.getByTestId("bulk-delete-brevo")).toHaveCount(0); // aucun des deux ne vient de Brevo
  await page.getByTestId("bulk-delete-submit").click();
  await expect(page.getByText("1 supprimé · 1 gardé (cités par un financement ou une adhésion)")).toBeVisible();
  await expect(page.getByTestId("contacts-table")).not.toContainText("Clémence Robert");
  await expect(page.getByTestId("contacts-table")).toContainText("Awa Sy");
});
