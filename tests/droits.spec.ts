import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Lot F2 — Rôles et droits en base : la matrice de l'admin change ce qu'une personne peut faire tout de suite ; un rôle se crée
// par copie, se supprime seulement s'il n'est porté par personne ; la Direction garde toujours l'administration.
// Les 49 autres tests, écrits avant le lot, prouvent que les droits par défaut sont ceux d'avant.

test("donner « Gère les financements » aux contributeurs rend les versements modifiables, le retirer les referme", async ({ page }) => {
  await page.goto("/admin?section=roles");
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=roles");
  await expect(page.getByTestId("roles-matrix")).toBeVisible();
  const box = page.getByTestId("perm-contributor-funding.edit");
  await expect(box).not.toBeChecked();
  await box.check();
  await page.waitForTimeout(600);

  // Lucas (contributeur) peut maintenant ajouter un versement.
  await iAm(page, "Lucas Perrin");
  await page.goto("/conventions");
  await page.getByTestId("open-convention-FSE-2026-2028").click();
  await expect(page.getByTestId("convention-payments-list-add-open")).toBeVisible();

  // Retour en arrière par la direction : la porte se referme à la requête suivante.
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=roles");
  await page.getByTestId("perm-contributor-funding.edit").uncheck();
  await page.waitForTimeout(600);
  await iAm(page, "Lucas Perrin");
  await page.goto("/conventions");
  await page.getByTestId("open-convention-FSE-2026-2028").click();
  await expect(page.getByTestId("convention-payments-list")).toContainText("Acompte 2027");
  await expect(page.getByTestId("convention-payments-list-add-open")).toHaveCount(0);
});

test("un rôle se crée par copie, se donne à une personne, ne se supprime que libre ; la Direction garde l'administration", async ({ page }) => {
  await page.goto("/admin?section=roles");
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=roles");

  // Copie de Contributeur → « Stagiaire », mêmes droits.
  await page.getByTestId("role-copy-contributor").click();
  await page.getByTestId("role-add-input").fill("Stagiaire");
  await page.getByTestId("role-add-submit").click();
  await expect(page.getByTestId("role-card-stagiaire")).toBeVisible();
  await expect(page.getByTestId("perm-stagiaire-edition.contribute")).toBeChecked();
  await expect(page.getByTestId("perm-stagiaire-funding.edit")).not.toBeChecked();

  // Le rôle est proposé dans l'admin › Personnes ; on le donne à Manon, puis la suppression est refusée tant qu'elle le porte.
  await page.goto("/admin?section=personnes");
  const row = page.locator("tr").filter({ has: page.locator('input[value="Manon Girard"]') }).first();
  await pick(page, row.locator("[data-testid^=role-]"), "Stagiaire");
  await page.waitForTimeout(500);
  await page.goto("/admin?section=roles");
  await expect(page.getByTestId("role-card-stagiaire")).toContainText("1 personne");
  await expect(page.getByTestId("role-delete-stagiaire")).toBeDisabled();

  // Manon voit l'outil comme une contributrice (pas d'Admin dans la barre).
  await iAm(page, "Manon Girard");
  await page.goto("/portefeuille");
  await expect(page.getByTestId("person-switcher")).toContainText("Stagiaire");
  await expect(page.locator("aside").getByRole("link", { name: "Admin" })).toHaveCount(0);

  // On la remet contributrice, le rôle devient libre et se supprime.
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=personnes");
  await pick(page, row.locator("[data-testid^=role-]"), "Contributeur");
  await page.waitForTimeout(500);
  await page.goto("/admin?section=roles");
  await expect(page.getByTestId("role-delete-stagiaire")).toBeEnabled();
  await page.getByTestId("role-delete-stagiaire").click();
  await expect(page.getByTestId("role-card-stagiaire")).toHaveCount(0);

  // Garde-fou : « Administre l'outil » ne se retire pas à la Direction.
  await page.getByTestId("perm-director-admin.manage").uncheck();
  await expect(page.getByText("Le rôle Direction garde toujours l'administration")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("perm-director-admin.manage")).toBeChecked();
});
