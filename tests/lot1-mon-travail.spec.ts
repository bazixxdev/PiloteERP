import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Lot 1 « Mon travail » (retour du 14/09) : listes de tâches partagées, notes, répartition en parts, modules, part fixe.

test("l'assistante gère ses listes ; son responsable lit une liste partagée, sans y écrire", async ({ page }) => {
  await page.goto("/taches");
  await iAm(page, "Léa Morin");
  // Les listes du jeu de démo dans la colonne, puis une nouvelle liste visible de toute la CRESS : créée, on l'ouvre.
  await expect(page.getByTestId("tasks-lists").locator('[data-name="Vie statutaire"]')).toBeVisible();
  await page.getByTestId("new-list").first().click();
  await page.getByTestId("new-list-name").fill("Forum TESS");
  await page.getByTestId("new-list-color-vert").click();
  await page.getByTestId("new-list-vis-all").check();
  await page.getByTestId("new-list-submit").click();
  const forum = page.getByTestId("tasks-main");
  await expect(forum).toHaveAttribute("data-name", "Forum TESS");
  await forum.getByTestId("task-input").fill("Réserver la salle du forum !lundi");
  await expect(forum.getByTestId("task-bang-due")).toBeVisible();
  await forum.getByTestId("task-input").press("Enter");
  await expect(forum).toContainText("Réserver la salle du forum");
  await expect(forum.locator("[data-testid^=task-due-]").first()).toContainText("Pour lun.");
  await expect(forum.locator("[data-testid^=list-visibility-]")).toHaveAttribute("data-value", "all");
  // Ranger une tâche : la pastille de liste est un menu ; le glisser-déposer sur la colonne fait la même chose.
  await forum.locator("[data-testid^=task-list-]").first().click();
  await page.locator("[data-testid$=-none]", { hasText: "À trier" }).click();
  await expect(forum).not.toContainText("Réserver la salle du forum");
  await page.getByTestId("tasks-view-trier").click();
  const trier = page.getByTestId("tasks-main");
  await expect(trier).toContainText("Réserver la salle du forum");
  const row = trier.locator("li", { hasText: "Réserver la salle du forum" });
  await row.dragTo(page.getByTestId("tasks-lists").locator('[data-name="Forum TESS"]'));
  await expect(page.getByText("Rangée dans « Forum TESS »")).toBeVisible();
  await page.getByTestId("tasks-lists").locator('[data-name="Forum TESS"]').click();
  await expect(forum).toContainText("Réserver la salle du forum");
  // Réglages de la liste : renommer, sans sélecteur dans le titre.
  await forum.locator("[data-testid^=list-settings-]").click();
  await page.locator("[data-testid^=list-name-]").fill("Forum TESS 2026");
  await page.locator("[data-testid^=list-name-]").blur();
  await expect(forum.locator("h2")).toContainText("Forum TESS 2026");
  await page.keyboard.press("Escape");

  // Le responsable du pôle 1 lit la liste « Suivi hebdo » d'Inès (visibilité « mon responsable ») et la liste « Forum TESS » (toute la CRESS), en lecture.
  await iAm(page, "Julien Barbot");
  await page.goto("/taches");
  const shared = page.getByTestId("shared-lists");
  await expect(shared).toContainText("Suivi hebdo avec mon responsable");
  await expect(shared).toContainText("Forum TESS 2026");
  await shared.locator('[data-name="Forum TESS 2026"]').click();
  await expect(page.getByTestId("tasks-main").locator("[data-readonly=true]")).toBeVisible();
  await expect(page.getByTestId("tasks-main").getByTestId("task-input")).toHaveCount(0);
  await expect(page.getByTestId("tasks-main")).toContainText("Réserver la salle du forum");
  // Une liste privée ne se voit pas.
  await expect(shared).not.toContainText("Demandes du jour");
});

test("une note se prend, s'enregistre en quittant le champ, se rattache à une édition et se retrouve depuis sa fiche", async ({ page }) => {
  await page.goto("/notes");
  await iAm(page, "Inès Cabral");
  await page.getByTestId("new-note").click();
  await page.getByTestId("note-title").fill("Point jury du 15 septembre");
  await page.getByTestId("note-body").fill("Le jury est calé. Relancer les partenaires pour les prix.");
  await page.getByTestId("note-body").blur();
  await expect(page.getByTestId("note-saved")).toBeVisible();
  await expect(page.getByTestId("my-notes")).toContainText("Point jury du 15 septembre", { timeout: 15_000 });
  // Rattachement à une édition puis lecture depuis l'onglet Documents.
  const select = page.getByTestId("note-edition");
  const value = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(value!);
  await expect(page.getByTestId("note-saved")).toBeVisible();
  await page.goto(`/edition/${value}?onglet=documents`);
  await expect(page.getByTestId("edition-notes")).toContainText("Point jury du 15 septembre", { timeout: 15_000 });
  // Mode focus : la navigation disparaît, Échap la ramène.
  await page.goto("/notes?note=nouvelle&focus=1");
  await expect(page.getByTestId("focus-exit")).toBeVisible();
  await expect(page.locator("aside").first()).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("aside").first()).toBeVisible();
});

test("la semaine se répartit en parts de mon temps et devient des heures pour la RAF", async ({ page }) => {
  await page.goto("/temps");
  await iAm(page, "Inès Cabral");
  await page.getByTestId("mode-parts").click();
  await expect(page.getByTestId("week-split")).toBeVisible();
  // La semaine porte déjà des heures : on repart de zéro avant de répartir.
  for (const input of await page.locator("[data-testid^=split-pct-]").all()) await input.fill("0");
  await page.getByTestId("split-pct-0").fill("60");
  await page.getByTestId("split-pct-2").fill("40");
  await expect(page.getByTestId("split-total")).toContainText("100 %");
  await page.getByTestId("split-save").click();
  await expect(page.getByText("Répartition enregistrée")).toBeVisible();
  // Retour à la grille : le total attendu du rythme est entièrement réparti.
  await page.goto("/temps");
  await expect(page.getByTestId("week-status")).toContainText("Semaine entièrement répartie");
  await expect(page.getByTestId("week-total")).toContainText("41,25 h");
});

test("les modules se coupent par personne ; une part fixe n'a rien à répartir", async ({ page }) => {
  await page.goto("/ma-semaine");
  await iAm(page, "Hugo Lemaire");
  // Hugo n'a que la répartition : ni Tâches ni Notes dans la barre haute, ni panneau de tâches dans Ma semaine.
  await expect(page.getByTestId("quick-tasks")).toHaveCount(0);
  await expect(page.getByTestId("my-tasks")).toHaveCount(0);
  await page.goto("/taches");
  await expect(page.getByText("Module désactivé")).toBeVisible();
  await page.goto("/compte");
  await page.getByTestId("module-tasks").check();
  await expect(page.getByTestId("quick-tasks")).toBeVisible();
  // Yasmine est à part fixe (lettre de mission) : pas de grille, une explication.
  await iAm(page, "Yasmine Benali");
  await page.goto("/temps");
  await expect(page.getByTestId("fixed-share-banner")).toContainText("Part fixe");
  await expect(page.getByTestId("time-grid")).toHaveCount(0);
});
