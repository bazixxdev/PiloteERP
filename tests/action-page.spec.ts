import { test, expect, type Page } from "@playwright/test";
import { iAm, openEditionByName, pick } from "./helpers";
import { W, cap, pl } from "./vocab";

// La page de l'action (26/09) : on l'ouvre depuis l'onglet, on y règle la période (refusée si elle laisse un jalon dehors),
// les jalons (ajout, fait, date qu'on ne peut pas vider, suppression) et les personnes associées ; une action sur trois
// années se lit « depuis … · jusqu'en … » dans l'année du milieu. Projet créé pour le test : rien du jeu de démo ne bouge.
const year = new Date().getFullYear();

async function createProject(page: Page, name: string, code: string) {
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  await page.getByTestId("cp-open").click();
  await page.getByTestId("cp-name").fill(name);
  await page.getByTestId("cp-code").fill(code);
  await pick(page, "cp-pilot", "Inès Cabral");
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name, { timeout: 30_000 });
  return page.url().split("?")[0];
}

test("la page de l'action : ouverte depuis l'onglet, période, jalons, personnes associées, lecture seule hors du projet", async ({ page }) => {
  const editionUrl = await createProject(page, "Projet recette Gamma", "REC-03");

  // Créer ouvre la page ; l'onglet liste l'action avec sa période, et son nom mène à la page.
  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Parcours d'accompagnement");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("action-back").click();
  await expect(page.getByTestId("actions-table")).toBeVisible();
  await expect(page.getByTestId("action-period-0")).toContainText(`${String(year).slice(2)}`);
  await page.getByTestId("action-link-0").click();
  await expect(page).toHaveURL(new RegExp(`/action/[^/?]+\\?annee=${year}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Parcours d'accompagnement");
  const actionUrl = page.url().split("?")[0];
  // Renommer : le crayon ouvre le champ, qui se referme une fois enregistré.
  await page.getByTestId("action-name-edit").click();
  await page.getByTestId("action-name").fill("Parcours d'accompagnement renforcé");
  await page.getByTestId("action-name").blur();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Parcours d'accompagnement renforcé");

  // Jalons : ajout.
  await page.getByTestId("milestone-add").click();
  await page.getByTestId("milestone-add-date").fill(`${year}-11-20`);
  await page.getByTestId("milestone-add-label").fill("Bilan collectif");
  await page.getByTestId("milestone-add-submit").click();
  await expect(page.getByTestId("milestone-label-0")).toHaveValue("Bilan collectif");
  await expect(page.getByTestId("milestone-date-0")).toHaveValue(`${year}-11-20`);

  // Date tapée au clavier : en cours de frappe, le champ natif émet « 0002-11-11 », « 0020-… » ; rien de cela ne part, la
  // période ne s'étend pas jusqu'à l'an 2. Jour = mois (11/11) : l'ordre des segments (jj/mm ou mm/jj) ne compte pas.
  await page.getByTestId("milestone-date-0").pressSequentially(`1111${year}`, { delay: 60 });
  await page.getByTestId("milestone-date-0").blur();
  await expect(page.getByTestId("milestone-date-0")).toHaveValue(`${year}-11-11`);
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByTestId("milestone-date-0")).toHaveValue(`${year}-11-11`);
  await expect(page.getByTestId("period-start")).toHaveValue(`${year}-01-01`);
  await expect(page.getByTestId("action-years")).toHaveCount(0);

  // Période : refusée quand elle laisse le jalon dehors ; le message de la commande s'affiche, rien ne change.
  await page.getByTestId("period-start").fill(`${year}-12-01`);
  await page.getByTestId("period-end").fill(`${year}-12-31`);
  await page.getByTestId("period-submit").click();
  await expect(page.getByTestId("period-error")).toContainText("Des jalons tomberaient hors de cette période");
  await page.reload();
  await expect(page.getByTestId("period-start")).toHaveValue(`${year}-01-01`);

  // Période sur trois années : l'année du milieu la dit « depuis … · jusqu'en … ».
  await page.getByTestId("period-start").fill(`${year - 1}-09-01`);
  await page.getByTestId("period-end").fill(`${year + 1}-06-30`);
  await page.getByTestId("period-submit").click();
  await expect(page.getByText("Période enregistrée")).toBeVisible();
  await expect(page.getByTestId("action-span")).toContainText(`depuis ${year - 1} · jusqu'en ${year + 1}`);
  await expect(page.getByTestId("action-years")).toContainText(`${year - 1}`);
  await expect(page.getByTestId("action-years")).toContainText(`${year + 1}`);
  // Dans l'onglet de l'année aussi.
  await page.goto(`${editionUrl}?onglet=actions`);
  await expect(page.getByTestId("action-period-0")).toContainText(`depuis ${year - 1} · jusqu'en ${year + 1}`);
  await page.goto(`${actionUrl}?annee=${year}`);

  // Jalon fait, puis date vidée : refusée, le jalon garde sa date.
  await page.getByTestId("milestone-done-0").check();
  await expect(page.getByTestId("milestone-row-0")).toHaveAttribute("data-done", "true");
  await page.getByTestId("milestone-date-0").fill("");
  await page.getByTestId("milestone-date-0").blur();
  await expect(page.getByText("Indiquez une date : le jalon est conservé")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("milestone-date-0")).toHaveValue(`${year}-11-11`);
  await expect(page.getByTestId("milestone-done-0")).toBeChecked();

  // Personne associée : la liste se lit (« Aucune. »), « Modifier » ouvre le sélecteur ; l'en-tête la nomme.
  await expect(page.getByTestId("action-people-list")).toHaveText("Aucune.");
  await page.getByTestId("action-people-edit").click();
  await page.getByTestId("action-people").getByRole("button", { name: "Lucas Perrin" }).click();
  await expect(page.getByTestId("action-people").getByRole("button", { name: "Lucas Perrin" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("action-associates")).toContainText("Lucas Perrin");
  await page.reload();
  await expect(page.getByTestId("action-people-list")).toHaveText("Lucas Perrin");

  // Une tâche personnelle (hors liste) rattachée à l'action : son autrice la voit ici, personne d'autre (plus bas).
  await page.getByTestId("action-tasks").getByTestId("task-from-edition").click();
  await page.getByTestId("task-from-edition-label").fill("Relancer le partenaire du parcours");
  await page.getByTestId("task-from-edition-submit").click();
  await expect(page.getByTestId("action-tasks")).toContainText("Relancer le partenaire du parcours");

  // Suppression du jalon.
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("milestone-delete-0").click();
  await expect(page.getByText("Jalon supprimé")).toBeVisible();
  await expect(page.getByTestId("milestone-row-0")).toHaveCount(0);

  // La fiche du projet liste l'action sur sa période.
  await page.getByTestId("action-summary").getByRole("link", { name: "Projet recette Gamma" }).click();
  await expect(page.getByTestId("project-actions")).toContainText("Parcours d'accompagnement");
  await expect(page.getByTestId("project-actions")).toContainText(`${year - 1}–${year + 1}`);

  // Hors du projet (un autre pôle, ni équipe ni responsable) : la page se lit, sans aucun contrôle d'écriture.
  await iAm(page, "Thomas Guérin");
  await page.goto(`${actionUrl}?annee=${year}`);
  await expect(page.getByTestId("outside-scope")).toBeVisible();
  await expect(page.getByTestId("action-name-edit")).toHaveCount(0);
  await expect(page.getByTestId("period-submit")).toHaveCount(0);
  await expect(page.getByTestId("milestone-add")).toHaveCount(0);
  await expect(page.getByTestId("action-people-edit")).toHaveCount(0);
  await expect(page.getByTestId("action-people-list")).toHaveText("Lucas Perrin");
  await expect(page.getByTestId("action-delete")).toHaveCount(0);
  // La tâche personnelle de la direction ne sort pas chez un tiers (ni chez la personne associée).
  await expect(page.getByTestId("action-tasks")).toContainText("Aucune tâche en cours.");
  await expect(page.getByTestId("action-tasks")).not.toContainText("Relancer le partenaire du parcours");
  await iAm(page, "Lucas Perrin");
  await page.reload();
  await expect(page.getByTestId("action-tasks")).not.toContainText("Relancer le partenaire du parcours");

  // Supprimer : permis à qui a le droit sur l'année (la direction) quand ni heure ni dépense n'y est rattachée ; retour à l'onglet.
  await iAm(page, "Claire Vasseur");
  await page.reload();
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("action-delete").click();
  await expect(page).toHaveURL(/\/edition\/[^/?]+\?onglet=actions$/);
  await expect(page.getByTestId("actions-table")).toHaveCount(0);
});

// Jeu de démo, sans rien modifier d'enregistré : « Petit-déjeuner ORESS · mars · emploi » porte 32 h de Julien Barbot
// (responsable de pôle) ; la visibilité du temps est « soi, son responsable de pôle, la RAF ».
test("heures par personne selon la visibilité du temps ; une action qui porte des heures ne se supprime pas", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Inès Cabral");
  await openEditionByName(page, "Observatoire régional (ORESS)");
  await page.goto(`${page.url().split("?")[0]}?onglet=actions`);
  await page.getByTestId("action-link-2").click();
  await expect(page.getByTestId("action-page")).toBeVisible();
  const url = page.url();
  // Une chargée de mission ne voit pas le détail des heures de son responsable de pôle : la ligne agrégée seulement.
  const hours = page.getByTestId("action-hours");
  await expect(hours).toContainText("32 h");
  await expect(hours).toContainText("1 autre personne : détail non visible.");
  await expect(hours).not.toContainText("Julien Barbot");
  // Lui voit les siennes.
  await iAm(page, "Julien Barbot");
  await page.goto(url);
  await expect(hours).toContainText("Julien Barbot");
  await expect(hours).not.toContainText("détail non visible");
  // La direction a le droit de supprimer, mais la commande refuse : des heures y sont rattachées.
  await iAm(page, "Claire Vasseur");
  await page.goto(url);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("action-delete").click();
  await expect(page.getByText("Des heures ou des dépenses y sont rattachées")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("action-page")).toBeVisible();
});
