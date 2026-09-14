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
