import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Retour de Gaël (14/09, soir) : éditeur riche pour les notes, liste groupée par mois, recherche et filtres — et une colonne qui ne déborde plus.

test("une note se met en forme (titre, liste, cases à cocher), se retrouve par la recherche et se lit en lecture seule chez un collègue", async ({ page }) => {
  await page.goto("/notes");
  await iAm(page, "Inès Cabral");
  await page.getByTestId("new-note").click();
  await page.getByTestId("note-title").fill("Comité de pilotage Forum — 14 septembre");
  const body = page.getByTestId("note-body");
  await body.click();
  // Raccourcis Markdown de l'éditeur : « # » titre, « - » liste, « [] » case à cocher.
  await page.keyboard.type("# Décisions");
  await page.keyboard.press("Enter");
  await page.keyboard.type("- Stand ESS France confirmé, 120 participants attendus");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("[] Relancer Sandrine pour le tableau matériel");
  await page.getByTestId("note-title").click(); // quitter l'éditeur = enregistrer
  await expect(page.getByTestId("note-saved")).toBeVisible();
  await expect(body.locator("h1")).toHaveText("Décisions");
  await expect(body.locator("ul li").first()).toContainText("Stand ESS France");
  await expect(body.locator("ul[data-type=taskList] input[type=checkbox]")).toHaveCount(1);
  // Une seule note créée malgré deux champs quittés à la suite.
  await expect(page.getByTestId("my-notes").locator("[data-testid^=note-link-]", { hasText: "Comité de pilotage Forum" })).toHaveCount(1);
  // La colonne tient dans sa largeur : la carte ne passe pas sous l'éditeur.
  const col = await page.getByTestId("my-notes").boundingBox();
  const editor = await page.getByTestId("note-editor").boundingBox();
  expect(col!.x + col!.width).toBeLessThanOrEqual(editor!.x);
  // Liste groupée par mois.
  await expect(page.getByTestId("my-notes")).toContainText("Septembre 2026");
  // Recherche plein texte dans le corps, avec extrait.
  await page.getByTestId("notes-search").fill("Sandrine");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("notes-filter-count")).toBeVisible();
  await expect(page.getByTestId("my-notes")).toContainText("Comité de pilotage Forum");
  await expect(page.getByTestId("my-notes")).toContainText("Relancer Sandrine");
  await page.getByTestId("notes-search").fill("mot introuvable zzz");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("my-notes")).toContainText("Aucune de mes notes ne correspond");
  await page.getByTestId("notes-filter-clear").click();
  await expect(page.getByTestId("my-notes")).toContainText("Comité de pilotage Forum");
  // Filtre par type de note.
  await page.getByTestId("notes-filter-context").selectOption("cafe");
  await page.getByTestId("notes-filter").getByRole("button", { name: "Filtrer" }).click();
  await expect(page.getByTestId("my-notes")).not.toContainText("Comité de pilotage Forum");
  // Partagée au pôle : le responsable la lit mise en forme, sans barre d'outils ni droit d'écrire.
  await page.goto("/notes");
  await page.getByTestId("my-notes").getByRole("link", { name: /Comité de pilotage Forum/ }).click();
  await page.getByTestId("note-visibility").selectOption("pole");
  await expect(page.getByTestId("note-saved")).toBeVisible();
  const url = page.url();
  await iAm(page, "Julien Barbot");
  await page.goto(url);
  await expect(page.getByTestId("note-body").locator("h1")).toHaveText("Décisions");
  await expect(page.getByTestId("note-toolbar")).toHaveCount(0);
  await expect(page.getByTestId("note-body")).toHaveAttribute("contenteditable", "false");
  await expect(page.getByText("Note partagée par Inès Cabral : en lecture.")).toBeVisible();
});

test("une note écrite en texte brut avant l'éditeur riche s'affiche en paragraphes", async ({ page }) => {
  await page.goto("/notes");
  await iAm(page, "Julien Barbot");
  // Note du jeu de démo (texte brut avec sauts de ligne) : rendue en paragraphes, pas en une seule ligne.
  await page.getByTestId("my-notes").getByRole("link", { name: /Réunion de pôle du 8 septembre/ }).click();
  const paras = page.getByTestId("note-body").locator("p");
  await expect.poll(() => paras.count()).toBeGreaterThan(1);
  await expect(page.getByTestId("note-body")).toContainText("Décisions");
});

test("une note privée se partage nominativement (la personne est prévenue) et se colore pour se repérer", async ({ page }) => {
  await page.goto("/notes");
  await iAm(page, "Inès Cabral");
  await page.getByTestId("new-note").click();
  await page.getByTestId("note-title").fill("Point Crédit Coopératif — convention simplifiée");
  await page.getByTestId("note-title").blur();
  await expect(page.getByTestId("note-saved")).toBeVisible();
  // Couleur : pastille dans l'éditeur, filet dans la liste, filtre par couleur.
  await page.getByTestId("note-color").click();
  await page.getByTestId("note-color-corail").click();
  await expect(page.getByTestId("note-color")).toContainText("Corail");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("my-notes").locator("[data-color=corail]", { hasText: "Crédit Coopératif" })).toHaveCount(1, { timeout: 15_000 });
  await page.getByTestId("notes-filter-color-vert").click();
  await expect(page.getByTestId("my-notes")).not.toContainText("Crédit Coopératif");
  await page.getByTestId("notes-filter-color-corail").click();
  await expect(page.getByTestId("my-notes")).toContainText("Crédit Coopératif");
  // Partage nominatif avec la RAF, qui n'est pas du pôle : la note reste privée pour les autres.
  await page.getByTestId("my-notes").getByRole("link", { name: /Crédit Coopératif/ }).click();
  await page.getByTestId("note-share").click();
  const nadia = page.getByTestId("note-share-list").getByRole("button", { name: "Nadia Ferrand" });
  await nadia.click();
  await expect(page.getByText("Personne prévenue")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("note-share")).toContainText("Nadia");
  await expect(page.getByText("Partagée nominativement avec Nadia Ferrand.")).toBeVisible();
  const url = page.url();
  await iAm(page, "Nadia Ferrand");
  await page.goto("/ma-semaine");
  await expect(page.getByTestId("unread-notifications")).toContainText("Note partagée : Point Crédit Coopératif");
  await page.goto(url);
  await expect(page.getByText("Partagée avec vous · note de Inès Cabral")).toBeVisible();
  await expect(page.getByTestId("note-body")).toHaveAttribute("contenteditable", "false");
  await expect(page.getByTestId("shared-notes")).toContainText("pour vous");
  // Un collègue non nommé (même pôle) ne la voit pas.
  await iAm(page, "Maxime Roussel");
  await page.goto(url);
  await expect(page.getByTestId("note-editor")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Crédit Coopératif");
});

test("la barre haute donne accès aux dernières notes et tâches, à la liste complète et à l'ajout", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Inès Cabral");
  // Icône de l'écran devant le titre, la même que dans le menu.
  await expect(page.locator("h1").first()).toContainText("Portefeuille");
  await page.getByTestId("quick-notes-open").click();
  await expect(page.getByTestId("quick-notes-open")).toBeVisible();
  await expect(page.locator("[data-testid=quick-notes-item]", { hasText: "Point partenaires du 11 septembre" })).toHaveCount(1);
  await page.getByTestId("quick-notes-all").click();
  await expect(page).toHaveURL(/\/notes$/);
  await page.getByTestId("quick-notes-add").click();
  await expect(page).toHaveURL(/note=nouvelle/);
  await expect(page.getByTestId("note-title")).toBeVisible();
  await page.getByTestId("quick-tasks-open").click();
  await expect(page.locator("[data-testid=quick-tasks-item]").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("quick-tasks-add").click();
  await expect(page).toHaveURL(/taches\?ajouter=1/);
  await expect(page.getByTestId("task-input").first()).toBeFocused();
  // Hugo n'a pas le module Notes : pas de menu Notes dans la barre haute.
  await iAm(page, "Hugo Lemaire");
  await expect(page.getByTestId("quick-notes")).toHaveCount(0);
});

test("une note s'archive : elle sort des listes et du menu du haut, reste lisible dans « Archivées », et se désarchive", async ({ page }) => {
  await page.goto("/notes");
  await iAm(page, "Inès Cabral");
  await page.getByTestId("my-notes").getByRole("link", { name: /Point partenaires du 11 septembre/ }).click();
  await page.getByTestId("note-archive").click();
  await expect(page.getByText("Note archivée")).toBeVisible();
  await expect(page.getByTestId("my-notes")).not.toContainText("Point partenaires du 11 septembre");
  await page.getByTestId("quick-notes-open").click();
  await expect(page.locator("[data-testid=quick-notes-item]", { hasText: "Point partenaires" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByTestId("notes-view-archived").click();
  await expect(page.getByTestId("my-notes")).toContainText("Point partenaires du 11 septembre");
  await page.getByTestId("my-notes").getByRole("link", { name: /Point partenaires du 11 septembre/ }).click();
  await expect(page.getByTestId("note-archived-banner")).toBeVisible();
  await page.getByTestId("note-archive").click(); // désarchiver
  await expect(page.getByText("Note désarchivée")).toBeVisible();
  await expect(page.getByTestId("note-archived-banner")).toHaveCount(0);
  await page.goto("/notes");
  await expect(page.getByTestId("my-notes")).toContainText("Point partenaires du 11 septembre");
});
