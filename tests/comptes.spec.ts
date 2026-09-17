import { test, expect } from "@playwright/test";
import { DEMO_PASSWORD, FRESH, iAm, login } from "./helpers";

// Lot F — Comptes et connexion : e-mail / mot de passe (better-auth), redirection vers la connexion, déconnexion,
// mot de passe oublié via la boîte d'envoi (pas de mail dans le prototype), comptes gérés par l'admin, désactivation qui ferme
// les sessions, changement de mot de passe. Mode démo : « Changer d'utilisateur » reste ouvert aux personnes connectées.

test.describe("sans session", () => {
  test.use({ storageState: FRESH });

  test("sans session, tout renvoie à la connexion ; un mauvais mot de passe est refusé ; la déconnexion ramène à la connexion", async ({ page }) => {
    await page.goto("/matrice?annee=2026");
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fmatrice/);
    await expect(page.getByTestId("login-form")).toBeVisible();
    // Pas de barre latérale ni de menu : la page nue.
    await expect(page.getByTestId("person-switcher")).toHaveCount(0);

    await page.getByTestId("login-email").fill("nadia.ferrand@exemple.fr");
    await page.getByTestId("login-password").fill("pas-le-bon-mot-de-passe");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toContainText("incorrect");

    await page.getByTestId("login-password").fill(DEMO_PASSWORD);
    await page.getByTestId("login-submit").click();
    // Retour à la page demandée, connectée comme Nadia (RAF).
    await expect(page).toHaveURL(/\/matrice\?annee=2026/);
    await expect(page.getByTestId("person-switcher")).toContainText("Nadia Ferrand");

    await page.getByTestId("person-switcher").click();
    await page.getByTestId("menu-logout").click();
    await expect(page).toHaveURL(/\/connexion/);
    await page.goto("/portefeuille");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("mot de passe oublié : le lien va dans la boîte d'envoi de l'admin, puis sert une fois", async ({ page, browser }) => {
    await page.goto("/mot-de-passe-oublie");
    await page.getByTestId("forgot-email").fill("thomas.guerin@exemple.fr");
    await page.getByTestId("forgot-submit").click();
    await expect(page.getByTestId("forgot-done")).toContainText("un lien a été préparé");

    // L'admin (direction) trouve le courrier et copie le lien.
    const admin = await browser.newContext();
    const a = await admin.newPage();
    await login(a, "claire.vasseur@exemple.fr", DEMO_PASSWORD);
    await a.goto("/admin?section=comptes");
    const mail = a.getByTestId("outbox-list").locator("li", { hasText: "thomas.guerin@exemple.fr" }).first();
    await expect(mail).toBeVisible();
    const url = (await mail.locator("[data-testid^=mail-link-]").getAttribute("href"))!;
    // Le lien passe par l'API d'auth (qui vérifie le jeton) puis renvoie sur la page de nouveau mot de passe.
    expect(url).toContain("/api/auth/reset-password/");
    await admin.close();

    // Nouveau mot de passe depuis le lien, puis connexion avec.
    await page.goto(url);
    await expect(page).toHaveURL(/\/reinitialiser\?token=/);
    await page.getByTestId("reset-p1").fill("nouveau-mdp-thomas-1");
    await page.getByTestId("reset-p2").fill("nouveau-mdp-thomas-1");
    await page.getByTestId("reset-submit").click();
    await expect(page).toHaveURL(/\/connexion/);
    await login(page, "thomas.guerin@exemple.fr", "nouveau-mdp-thomas-1");
    await expect(page.getByTestId("person-switcher")).toContainText("Thomas Guérin");
    // Retour au mot de passe de démo (les tests suivants se connectent avec).
    await page.goto("/compte");
    await page.getByTestId("pw-current").fill("nouveau-mdp-thomas-1");
    await page.getByTestId("pw-1").fill(DEMO_PASSWORD);
    await page.getByTestId("pw-2").fill(DEMO_PASSWORD);
    await page.getByTestId("pw-submit").click();
    await expect(page.getByText("Mot de passe changé")).toBeVisible();
    // Le lien ne sert qu'une fois.
    await page.getByTestId("person-switcher").click();
    await page.getByTestId("menu-logout").click();
    await page.goto(url);
    await expect(page.getByTestId("reset-invalid")).toContainText("Ce lien n'est plus valable");
  });
});

test("l'admin crée un compte (lien d'accès dans la boîte d'envoi), ferme les sessions, et désactiver coupe l'accès", async ({ page, browser }) => {
  await page.goto("/admin?section=comptes");
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=comptes");
  await expect(page.getByTestId("accounts-table").locator('input[value="nadia.ferrand@exemple.fr"]')).toBeVisible();

  // Une nouvelle personne, une adresse, un compte : le lien d'accès est préparé.
  await page.goto("/admin?section=personnes");
  await page.getByTestId("add-person-open").click();
  await page.getByTestId("add-person-input").fill("Test Compte");
  await page.getByTestId("add-person-submit").click();
  await expect(page.getByText("Test Compte").first()).toBeVisible();
  await page.goto("/admin?section=comptes");
  const row = page.getByTestId("account-row-Test Compte");
  await expect(row).toContainText("aucun");
  const create = row.locator("[data-testid^=account-create-]");
  await expect(create).toBeDisabled();
  const id = (await create.getAttribute("data-testid"))!.replace("account-create-", "");
  const email = page.getByTestId(`email-${id}`);
  await email.fill("test.compte@exemple.fr");
  await email.blur();
  await expect(page.getByTestId(`account-create-${id}`)).toBeEnabled();
  await page.getByTestId(`account-create-${id}`).click();
  await expect(page.getByText("Compte créé : le lien d'accès est dans la boîte d'envoi")).toBeVisible();
  await expect(page.getByTestId("account-row-Test Compte")).toContainText("actif");
  const mail = page.getByTestId("outbox-list").locator("li", { hasText: "test.compte@exemple.fr" }).first();
  await expect(mail).toHaveAttribute("data-kind", "invitation");
  await mail.locator("[data-testid^=mail-handed-]").click();
  await expect(page.getByTestId("outbox-list").locator("li", { hasText: "test.compte@exemple.fr" })).toHaveCount(0);

  // Thomas se connecte ailleurs ; la direction le désactive : sa session tombe.
  const other = await browser.newContext({ storageState: FRESH });
  const t = await other.newPage();
  await login(t, "thomas.guerin@exemple.fr", DEMO_PASSWORD);
  await expect(t.getByTestId("person-switcher")).toContainText("Thomas Guérin");
  await page.goto("/admin?section=comptes");
  await expect(page.getByTestId("account-row-Thomas Guérin")).toContainText(/Sessions|[1-9]/);
  await page.goto("/admin?section=personnes");
  const personRow = page.locator("tr").filter({ has: page.locator('input[value="Thomas Guérin"]') }).first();
  await personRow.locator('input[type="checkbox"]').last().uncheck();
  await page.waitForTimeout(800);
  await t.goto("/portefeuille");
  await expect(t).toHaveURL(/\/connexion/);
  // Et il ne peut plus se connecter, même avec le bon mot de passe.
  await login(t, "thomas.guerin@exemple.fr", DEMO_PASSWORD, false);
  await expect(t.getByTestId("login-error")).toContainText("désactivé");
  await other.close();
  // On le réactive pour les tests suivants.
  await page.goto("/admin?section=personnes");
  await page.locator("tr").filter({ has: page.locator('input[value="Thomas Guérin"]') }).first().locator('input[type="checkbox"]').last().check();
  await page.waitForTimeout(500);
});

// Dans un contexte vierge et comme Nadia : la session partagée de Claire (storageState) ne doit pas être fermée, car
// « changer son mot de passe » ferme les autres sessions du compte et les tests suivants en dépendent.
test.describe("mon compte", () => {
  test.use({ storageState: FRESH });

  test("chacun change son mot de passe dans Mon compte ; l'ancien ne passe plus, les autres sessions tombent", async ({ page, browser }) => {
    // Nadia est ouverte dans deux navigateurs.
    const ctx = await browser.newContext({ storageState: FRESH });
    const p2 = await ctx.newPage();
    await login(p2, "nadia.ferrand@exemple.fr", DEMO_PASSWORD);
    await login(page, "nadia.ferrand@exemple.fr", DEMO_PASSWORD);
    await page.goto("/compte");
    await expect(page.getByTestId("account-section")).toContainText("nadia.ferrand@exemple.fr");
    await page.getByTestId("pw-current").fill("mauvais-mot-de-passe");
    await page.getByTestId("pw-1").fill("nadia-nouveau-mdp-1");
    await page.getByTestId("pw-2").fill("nadia-nouveau-mdp-1");
    await page.getByTestId("pw-submit").click();
    await expect(page.getByText("Mot de passe actuel incorrect.")).toBeVisible();
    await page.getByTestId("pw-current").fill(DEMO_PASSWORD);
    await page.getByTestId("pw-submit").click();
    await expect(page.getByText("Mot de passe changé")).toBeVisible();
    // Celle-ci reste connectée ; l'autre navigateur est renvoyé à la connexion.
    await page.goto("/compte");
    await expect(page.getByTestId("person-switcher")).toContainText("Nadia Ferrand");
    await p2.goto("/portefeuille");
    await expect(p2).toHaveURL(/\/connexion/);
    // L'ancien mot de passe ne passe plus, le nouveau oui ; puis retour au mot de passe de démo.
    await login(p2, "nadia.ferrand@exemple.fr", DEMO_PASSWORD, false);
    await login(p2, "nadia.ferrand@exemple.fr", "nadia-nouveau-mdp-1");
    await p2.goto("/compte");
    await p2.getByTestId("pw-current").fill("nadia-nouveau-mdp-1");
    await p2.getByTestId("pw-1").fill(DEMO_PASSWORD);
    await p2.getByTestId("pw-2").fill(DEMO_PASSWORD);
    await p2.getByTestId("pw-submit").click();
    await expect(p2.getByText("Mot de passe changé")).toBeVisible();
    await ctx.close();
  });
});
