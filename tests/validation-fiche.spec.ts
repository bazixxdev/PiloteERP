import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { iAm, pick } from "./helpers";
import { W, cap, du } from "./vocab";

// Circuit de validation de la fiche (26/09, tâche 13) : la direction valide le niveau 1, un administrateur du CA (ici le rôle
// RAF, qui reçoit le seul droit du niveau 2 le temps du test) valide le niveau 2 : la fiche est verrouillée. « À retravailler »
// la rouvre (re-challengée) et le circuit repart du niveau 1. Le pilote ne décide jamais sa propre fiche : pas de bouton, et
// l'impasse est dite quand il est le seul à tenir le droit. Projets créés pour le test ; le rôle RAF est remis comme avant.
const prisma = new PrismaClient(); // DATABASE_URL = base de recette (playwright.config.ts)
let rafPermissions = "";

test.beforeAll(async () => {
  const raf = await prisma.role.findUniqueOrThrow({ where: { code: "raf" }, select: { permissions: true } });
  rafPermissions = raf.permissions;
  await prisma.role.update({ where: { code: "raf" }, data: { permissions: `${raf.permissions},fiche.validate.2` } });
});
test.afterAll(async () => {
  if (rafPermissions) await prisma.role.update({ where: { code: "raf" }, data: { permissions: rafPermissions } });
  await prisma.$disconnect();
});

async function createProject(page: Page, name: string, code: string, pilot: string) {
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  await page.getByTestId("cp-open").click();
  await page.getByTestId("cp-name").fill(name);
  await page.getByTestId("cp-code").fill(code);
  await pick(page, "cp-pilot", pilot);
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name, { timeout: 30_000 });
  return `${page.url().split("?")[0]}?onglet=fiche`;
}

async function decide(page: Page, button: "approved" | "rework" | "refused", comment = "") {
  if (comment) await page.getByTestId("fiche-decide-comment").fill(comment);
  await page.getByTestId(`fiche-decide-${button}`).click();
}

test("la direction valide le niveau 1, le CA le niveau 2 : la fiche se verrouille ; « à retravailler » la rouvre", async ({ page }) => {
  const fiche = await createProject(page, "Projet recette circuit", "REC-13A", "Thomas Guérin");
  await page.goto(fiche);
  const layer = page.getByTestId("layer-validation");
  await expect(layer.getByTestId("fiche-level-1")).toContainText(`1. ${cap(W.direction)}`);
  await expect(layer.getByTestId("fiche-level-1")).toContainText("à décider");
  await expect(layer.getByTestId("fiche-level-2")).toContainText("en attente du niveau précédent");
  await layer.screenshot({ path: "test-results/task13-couche4-avant.png" });

  // Niveau 1 : la direction valide.
  await decide(page, "approved");
  await expect(layer.getByTestId("fiche-level-1")).toContainText("Validé");
  await expect(layer.getByTestId("fiche-level-1")).toContainText("Claire Vasseur");
  await expect(layer.getByTestId("fiche-level-2")).toContainText("à décider");
  await expect(page.getByTestId("fiche-locked")).toHaveCount(0);

  // Le pilote n'a aucun bouton sur sa fiche.
  await iAm(page, "Thomas Guérin");
  await page.goto(fiche);
  await expect(layer).toBeVisible();
  await expect(page.getByTestId("fiche-decide")).toHaveCount(0);

  // Niveau 2 : le CA (rôle RAF) valide ; la fiche est verrouillée, l'année « validée ».
  await iAm(page, "Nadia Ferrand");
  await page.goto(fiche);
  await decide(page, "approved", "Vu au CA");
  await expect(page.getByTestId("fiche-locked")).toBeVisible();
  await expect(page.getByTestId("fiche-locked")).toContainText(cap(W.direction));
  await expect(page.getByTestId("fiche-locked")).toContainText("CA");
  await expect(layer).toContainText("Circuit terminé");
  await expect(layer.getByTestId("fiche-level-2")).toContainText("« Vu au CA »");
  await expect(page.getByTestId("edition-status")).toContainText("Validée");
  await layer.getByTestId("fiche-reopen").locator("summary").click();
  await layer.screenshot({ path: "test-results/task13-couche4-apres.png" });

  // « À retravailler » (commentaire obligatoire) : re-challengée, rouverte, le circuit repart du niveau 1.
  await expect(page.getByTestId("fiche-decide-rework")).toBeDisabled();
  await decide(page, "rework", "Budget à revoir");
  await expect(page.getByTestId("fiche-locked")).toHaveCount(0);
  await expect(page.getByTestId("edition-status")).toContainText("Re-challengée");
  await expect(layer.getByTestId("fiche-level-1")).toContainText("à décider");
  await expect(layer.getByTestId("fiche-levels-past")).toContainText("3 décisions");
  // Le CA seul ne décide plus rien : le niveau 1 attend la direction.
  await expect(page.getByTestId("fiche-decide")).toHaveCount(0);
  // L'historique garde la décision.
  await page.getByTestId("history").locator("summary").click();
  await expect(page.getByTestId("changelog")).toContainText("Validation de la fiche");
  await expect(page.getByTestId("changelog")).toContainText("CA : à retravailler");
});

test("le pilote ne décide pas sa propre fiche : pas de bouton, et l'impasse est dite quand lui seul tient le droit", async ({ page }) => {
  const fiche = await createProject(page, "Projet recette sa propre fiche", "REC-13B", "Claire Vasseur");
  await page.goto(fiche);
  const layer = page.getByTestId("layer-validation");
  await expect(layer.getByTestId("fiche-level-1")).toContainText("à décider");
  await expect(page.getByTestId("fiche-decide")).toHaveCount(0);
  await expect(layer.getByTestId("fiche-decide-blocked")).toContainText("On ne décide pas sa propre fiche");
  await expect(layer.getByTestId("fiche-level-dead-end")).toContainText(`Seul·e Claire Vasseur, ${W.pilote.one} ${du(W.projet)}`);
  await expect(layer.getByTestId("fiche-level-dead-end")).toContainText("Admin › Rôles et droits");
  // Pour les autres, rien à décider ni à expliquer.
  await iAm(page, "Lucas Perrin");
  await page.goto(fiche);
  await expect(page.getByTestId("fiche-decide")).toHaveCount(0);
  await expect(layer.getByTestId("fiche-decide-blocked")).toHaveCount(0);
  await expect(layer.getByTestId("fiche-level-1")).toContainText("à décider");
});

test("Admin › Paramètres : le circuit se lit et se règle (libellé, droit, ordre)", async ({ page }) => {
  await page.goto("/admin?section=parametres");
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=parametres");
  const section = page.getByTestId("fiche-levels-section");
  await expect(section.getByTestId("fiche-level-label-1")).toHaveValue(cap(W.direction));
  await expect(section.getByTestId("fiche-level-label-2")).toHaveValue("CA");
  await expect(section).toContainText(cap(W.direction)); // le rôle qui tient les droits par défaut
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: "test-results/task13-admin-niveaux.png" });
  // Renommer le niveau 2 puis le remettre : l'enregistrement relit la base.
  await section.getByTestId("fiche-level-label-2").fill("Conseil d'administration");
  await section.getByTestId("fiche-levels-save").click();
  await expect(page.getByText("Circuit de validation enregistré")).toBeVisible();
  await page.reload();
  await expect(section.getByTestId("fiche-level-label-2")).toHaveValue("Conseil d'administration");
  await section.getByTestId("fiche-level-label-2").fill("CA");
  await section.getByTestId("fiche-levels-save").click();
  await expect(page.getByText("Circuit de validation enregistré").first()).toBeVisible();
  await page.reload();
  await expect(section.getByTestId("fiche-level-label-2")).toHaveValue("CA");
  // Le niveau 2 a des décisions (jeu de démo) : il ne se retire pas, il se désactive.
  await expect(section.getByTestId("fiche-level-row-2").getByRole("button", { name: "Retirer" })).toBeDisabled();
});
