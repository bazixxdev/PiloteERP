import { test, expect, type Page } from "@playwright/test";
import { dayjs } from "../lib/format";
import { iAm } from "./helpers";
import { W, cap, pl } from "./vocab";

// « Mes actions » (26/09) remplace « Ma délégation » : les actions dont une personne est responsable ou associée, avec
// ce qui leur est confié, leur marge de décision, leurs jalons de la période (les points de contrôle mis en avant) et,
// pour elle-même, ses tâches — jamais celles d'un tiers. La coordination (droit sur le temps de l'équipe) voit la page
// de chacun via `personne=`. Projet créé pour le test : rien du jeu de démo ne bouge.
const year = new Date().getFullYear();
const PROJECT = "Projet recette Mes actions";
const ENTRUSTED = "Six ateliers menés, dix structures accompagnées.";
const LATITUDE = "Jusqu'à 500 € par achat sans validation.";
const MILESTONE = "Bilan à mi-parcours";
const TASK = "Relancer la structure accompagnée";

async function createProject(page: Page, name: string, code: string) {
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  await page.getByTestId("cp-open").click();
  await page.getByTestId("cp-name").fill(name);
  await page.getByTestId("cp-code").fill(code);
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name, { timeout: 30_000 });
}

test("Mes actions : ce qui est confié, la marge de décision, les jalons de la période et mes tâches ; la coordination voit les actions de chacun", async ({ page, request }) => {
  await createProject(page, PROJECT, "MA-01");

  // Une action, avec un responsable (Lucas Perrin) et une personne associée (Nadia Ferrand).
  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Accompagnement individuel");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  const actionUrl = page.url().split("?")[0];
  const actionId = actionUrl.split("/").pop()!;

  await page.getByTestId("action-owner").click();
  const ownerList = page.locator("[data-slot=select-list]");
  await expect(ownerList).toBeVisible();
  const lucasOption = ownerList.getByRole("option", { name: /Lucas Perrin/ });
  const lucasId = await lucasOption.getAttribute("data-value");
  await lucasOption.click();
  await expect(ownerList).toBeHidden();
  expect(lucasId).toBeTruthy();

  await page.getByTestId("action-people-edit").click();
  await page.getByTestId("action-people").getByRole("button", { name: "Nadia Ferrand" }).click();
  await expect(page.getByTestId("action-people").getByRole("button", { name: "Nadia Ferrand" })).toHaveAttribute("aria-pressed", "true");

  // Ce qui est confié, la marge de décision.
  await page.getByTestId("action-entrusted-field").fill(ENTRUSTED);
  await page.getByTestId("action-entrusted-field").blur();
  await page.getByTestId("action-latitude").fill(LATITUDE);
  await page.getByTestId("action-latitude").blur();
  await expect(page.getByTestId("action-entrusted-field")).toHaveValue(ENTRUSTED);

  // Un jalon proche, marqué point de contrôle : dans le semestre en cours (périodes par défaut de l'admin, 01-06/07-12) et
  // jamais au-delà du 31/12, pour ne pas dépendre du jour de lancement (I4, revue finale du 26/09) — sinon un jalon posé à
  // dix jours change de semestre (ou d'année) selon la date, et la page par défaut (sans `periode=`) ne le montre plus.
  const now = dayjs();
  const semesterEnd = now.month() < 6 ? dayjs(`${now.year()}-06-30`) : dayjs(`${now.year()}-12-31`);
  const inTenDays = now.add(10, "day");
  const soon = (inTenDays.isAfter(semesterEnd, "day") ? semesterEnd : inTenDays).format("YYYY-MM-DD");
  await page.getByTestId("milestone-add").click();
  await page.getByTestId("milestone-add-date").fill(soon);
  await page.getByTestId("milestone-add-label").fill(MILESTONE);
  await page.getByTestId("milestone-add-submit").click();
  await expect(page.getByTestId("milestone-label-0")).toHaveValue(MILESTONE);
  await page.getByTestId("milestone-checkpoint-0").check();
  await page.reload();
  await expect(page.getByTestId("milestone-checkpoint-0")).toBeChecked();

  // Lucas, responsable : une tâche personnelle rattachée à l'action.
  await iAm(page, "Lucas Perrin");
  await page.goto(`${actionUrl}?annee=${year}`);
  await page.getByTestId("action-tasks").getByTestId("task-from-edition").click();
  await page.getByTestId("task-from-edition-label").fill(TASK);
  await page.getByTestId("task-from-edition-submit").click();
  await expect(page.getByTestId("action-tasks")).toContainText(TASK);

  // Sa page « Mes actions » : le projet, ce qui lui est confié, sa marge de décision, le jalon (point de contrôle), sa tâche.
  await page.goto("/mes-actions");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Mes ${pl(W.action)}`);
  await expect(page.getByTestId(`mes-actions-entrusted-${actionId}`)).toHaveText(ENTRUSTED);
  await expect(page.getByTestId(`mes-actions-latitude-${actionId}`)).toHaveText(LATITUDE);
  const milestones = page.getByTestId(`mes-actions-milestones-${actionId}`);
  await expect(milestones).toContainText(MILESTONE);
  await expect(milestones.locator('[aria-label="Point de contrôle"]')).toBeVisible();
  // Lucas (contributeur de longue date du jeu de démo) peut déjà avoir d'autres actions : on cible la carte de CE projet,
  // jamais la première de la page.
  const projectCard = page.locator("[data-testid^=mes-actions-project-]").filter({ hasText: PROJECT });
  await expect(projectCard).toHaveCount(1);
  const editionId = (await projectCard.getAttribute("data-testid"))!.replace("mes-actions-project-", "");
  await expect(page.getByTestId(`mes-actions-tasks-${editionId}`)).toContainText(TASK);
  // Simple contributeur, aucun droit sur le temps de personne d'autre : pas de liste « Personnes » (rien à y montrer).
  await expect(page.getByTestId("mes-actions-people")).toHaveCount(0);

  // « Toute l'année » : le jalon proche reste visible (une action pleine année en couvre toutes les périodes).
  await page.getByTestId("mes-actions-period-annee").click();
  await expect(page.getByTestId(`mes-actions-milestones-${actionId}`)).toContainText(MILESTONE);

  // Export .docx : les mêmes données, sans les tâches (on ne vérifie que le transport ici, comme l'ancien export délégation).
  const href = await page.getByTestId("mes-actions-export").getAttribute("href");
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const doc = await request.get(href!, { headers: { cookie } });
  expect(doc.status()).toBe(200);
  expect(doc.headers()["content-type"]).toContain("wordprocessingml");

  // Nadia, personne associée : voit aussi l'action confiée à Lucas, jamais la tâche de Lucas (personnelle).
  await iAm(page, "Nadia Ferrand");
  await page.goto("/mes-actions");
  await expect(page.getByTestId(`mes-actions-entrusted-${actionId}`)).toHaveText(ENTRUSTED);
  await expect(page.getByTestId(`mes-actions-tasks-${editionId}`)).toContainText("Aucune.");
  await expect(page.getByTestId(`mes-actions-tasks-${editionId}`)).not.toContainText(TASK);

  // Claire (direction, droit sur le temps de l'équipe) : atteint la page de Lucas depuis la liste « Personnes » (spec § 4,
  // « la coordination voit Mes actions de chacun »), jamais une adresse tapée à la main ; voit ses actions, jamais ses tâches.
  await iAm(page, "Claire Vasseur");
  await page.goto("/mes-actions");
  await page.getByTestId("mes-actions-people").getByRole("link", { name: "Lucas Perrin" }).click();
  await expect(page).toHaveURL(new RegExp(`personne=${lucasId}`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lucas Perrin");
  await expect(page.getByTestId(`mes-actions-entrusted-${actionId}`)).toHaveText(ENTRUSTED);
  await expect(page.getByTestId(`mes-actions-tasks-${editionId}`)).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(TASK);
});
