import { test, expect } from "@playwright/test";
import { iAm, openEditionByName } from "./helpers";

// Revue UI/UX du 13/09 : les valeurs lues sont fiables (P1) et le travail à traiter ressort (P2).
test("le budget écrit le dépassement, la validation CA se lit en clair, la clôture dit ce qui manque", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Claire Vasseur");

  // 1. Portefeuille : l'alerte principale se lit sous le nom du projet, sans colonne lointaine.
  const line = page.getByTestId("portfolio-table").locator("tr", { hasText: "Mois de l'ESS et Prix ESS" });
  await expect(line.getByTestId("alert-summary")).toContainText(/Jalon dépassé|Enveloppe dépassée/);

  // 2. Budget : 101 %, jamais plafonné, et le dépassement en euros ; l'en-tête dit la même chose.
  await openEditionByName(page, "Mois de l'ESS et Prix ESS");
  await expect(page.getByText("Enveloppe dépassée de 160 € (101 %)")).toBeVisible();
  await page.getByRole("tab", { name: "Budget" }).click();
  await expect(page.getByTestId("budget-pct")).toContainText("101 %");
  await expect(page.getByTestId("budget-pct")).toContainText("Enveloppe dépassée de 160 €");

  // 3. Fiche : la validation CA se lit en une phrase, pas comme une case « Non renseigné ».
  await page.getByRole("tab", { name: "Fiche" }).click();
  await expect(page.getByTestId("field-boardValidated")).toHaveText("Validé par le CA le 18 décembre 2025");
  await expect(page.getByTestId("layer-validation")).not.toContainText("Non renseigné");

  // 4. Actions : les objectifs de temps se lisent en entier (77 h, 105 h) en lecture.
  await iAm(page, "Lucas Perrin");
  await page.getByRole("tab", { name: "Actions" }).click();
  await expect(page.getByTestId("actions-table")).toContainText("77 h");
  await expect(page.getByTestId("actions-table")).toContainText("105 h");
  await expect(page.getByRole("heading", { name: "Frise chronologique" })).toBeVisible();

  // 5. Clôture : couverture, déclaration et verrouillage sont trois informations ; le manque réel est écrit.
  await iAm(page, "Nadia Ferrand");
  await page.goto("/cloture?mois=2026-08");
  const thomas = page.getByTestId("cloture-table").locator("tr", { hasText: "Thomas Guérin" });
  await expect(thomas).toContainText("1 jour sans saisie");
  await expect(thomas).not.toContainText("Complet (non déclaré)");
  await page.getByTestId("lock-all-open").click();
  await expect(page.getByTestId("lock-all-list")).toBeVisible();
  await expect(page.getByTestId("lock-all-list")).not.toContainText("Thomas Guérin");
});

test("Ma semaine sépare retard, semaine et plus tard ; le CODIR ouvre sur un ordre du jour ; le contributeur n'a pas de compteur collectif", async ({ page }) => {
  await page.goto("/ma-semaine");
  await iAm(page, "Romain Tessier");
  await expect(page.getByTestId("late")).toBeVisible();
  await expect(page.getByTestId("this-week")).toBeVisible();
  await expect(page.getByTestId("later")).not.toHaveAttribute("open", "");
  await expect(page.getByTestId("later")).toContainText("Voir les échéances à 90 jours");

  // Demande de validation : le destinataire réel est nommé avant tout paramètre technique.
  await openEditionByName(page, "Mois de l'ESS et Prix ESS");
  await page.getByTestId("request-validation-open").click();
  await expect(page.getByTestId("rv-recipient")).toContainText("Sera transmis à");
  await expect(page.getByTestId("rv-recipient")).toContainText("Claire Vasseur");
  await expect(page.getByTestId("rv-file")).toBeAttached();
  await page.keyboard.press("Escape");

  // Contributeur : Ma semaine en premier, pas d'accès CODIR ni Admin, aucun compteur collectif sur Demandes (validations fusionnées).
  await iAm(page, "Lucas Perrin");
  const sidebar = page.locator("aside");
  await expect(sidebar.getByRole("link", { name: "Écran CODIR" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Validations" })).toHaveCount(0);
  // Le badge Demandes est personnel : il vaut exactement « À traiter par moi » (demandes adressées à Lucas ou à son pôle), pas un total collectif.
  await page.goto("/demandes");
  const forMe = (await page.getByTestId("requests-view-moi").innerText()).match(/\((\d+)\)/)![1];
  const badge = (await sidebar.getByRole("link", { name: /^Demandes/ }).innerText()).replace("Demandes", "").trim();
  expect(badge).toBe(forMe === "0" ? "" : forMe);
  await page.goto("/portefeuille");
  await expect(page.getByTestId("codir-mode")).toHaveCount(0);
  await page.goto("/validations");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("File des validations");
  await expect(page.getByText(/0 à traiter par moi/)).toBeVisible();

  // CODIR : 3 à 5 sujets regroupés par édition, avec problème, décision attendue, responsable, échéance.
  await iAm(page, "Claire Vasseur");
  await page.goto("/codir");
  await expect(page.getByTestId("codir-agenda")).toContainText("Ordre du jour");
  const first = page.getByTestId("agenda-0");
  await expect(first).toContainText("Problème");
  await expect(first).toContainText("Décision attendue");
  await expect(first).toContainText("Responsable");
  await expect(first).toContainText("Échéance");
  await expect(page.locator("[data-testid^=agenda-]")).toHaveCount(5);
  await expect(page.getByTestId("codir-all")).toHaveAttribute("open", "");
});

test("le menu utilisateur donne accès au compte, à l'admin selon les droits, au changement d'utilisateur et à la déconnexion", async ({ page }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Claire Vasseur");
  await page.getByTestId("person-switcher").click();
  await expect(page.getByTestId("menu-admin")).toBeVisible();
  await page.getByTestId("menu-account").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mon compte");
  await expect(page.locator("section", { hasText: "Identité et poste" })).toContainText("Claire Vasseur");

  // La recherche de la modale filtre par nom, rôle ou pôle.
  await page.getByTestId("person-switcher").click();
  await page.getByTestId("menu-switch").click();
  await page.getByTestId("person-search").fill("contrib");
  const options = page.getByTestId("person-chooser").getByRole("option");
  await expect(options.first()).toContainText("Contributeur");
  await options.filter({ hasText: "Lucas Perrin" }).click();
  await expect(page.getByTestId("person-switcher")).toContainText("Lucas Perrin");

  // Un contributeur n'a ni Admin dans le menu, ni dans la barre latérale ; la déconnexion ouvre le choix de personne.
  await page.getByTestId("person-switcher").click();
  await expect(page.getByTestId("menu-admin")).toHaveCount(0);
  await page.getByTestId("menu-logout").click();
  await expect(page.getByTestId("person-chooser")).toContainText("Se déconnecter");
  await page.keyboard.press("Escape");
  await expect(page.locator("aside").getByRole("link", { name: "Admin" })).toHaveCount(0);
});
