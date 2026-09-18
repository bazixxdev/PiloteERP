import { test, expect, type Page } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Connecteur Brevo (18/09), contre le faux Brevo de tests/brevo-mock.mjs : suivre une liste, synchroniser (tous les contacts
// entrent dans l'annuaire, complétés sans doublon, désinscrits marqués), miroir en lecture ; envoi d'une liste à soi vers Brevo.

const MOCK = `http://localhost:${Number(process.env.PW_PORT ?? 3100) + 199}`;
const mockState = async (page: Page) => (await page.request.get(`${MOCK}/__state`)).json() as Promise<{ lists: { id: number; name: string; folderId: number }[]; folders: { id: number; name: string }[]; contacts: { id: number; email: string; listIds: number[]; attributes: Record<string, string> }[] }>;

test.beforeAll(async ({ request }) => { await request.post(`${MOCK}/__reset`); });

test("l'admin suit une liste Brevo : l'annuaire se remplit, la liste est un miroir en lecture avec ses attributs en colonnes", async ({ page }) => {
  await page.goto("/admin?section=donnees");
  await iAm(page, "Claire Vasseur");
  await page.goto("/admin?section=donnees");
  const panel = page.getByTestId("brevo-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("brevo-last-sync")).toContainText("Jamais synchronisé");
  await expect(page.getByTestId("brevo-lists")).toContainText("Newsletter ESS");
  await expect(page.getByTestId("brevo-list-11")).toHaveAttribute("data-followed", "0");
  await page.getByTestId("brevo-follow-11").click();
  await expect(page.getByText(/« Newsletter ESS » suivie/)).toBeVisible();
  await expect(page.getByTestId("brevo-list-11")).toHaveAttribute("data-followed", "1");
  await expect(panel.getByTestId("brevo-last-sync")).toContainText("4 contacts lus · 3 créés");
  // Le miroir, à part dans la colonne de gauche ; ses membres et l'attribut TERRITOIRE en colonne, en lecture.
  await page.goto("/contacts");
  await page.getByTestId("brevo-contact-lists").locator('[data-name="Newsletter ESS"]').click();
  await expect(page.getByTestId("contacts-main")).toHaveAttribute("data-name", "Newsletter ESS");
  await expect(page.getByTestId("contact-list-mirror")).toContainText("synchronisée le");
  await expect(page.getByTestId("contact-list-count")).toContainText("3 contacts");
  const table = page.getByTestId("contact-list-table");
  await expect(table).toContainText("Fatou Diallo");
  await expect(table).toContainText("Karim Benali");
  await expect(table).toContainText("Coop Berry");
  await expect(page.getByTestId("col-brevo_territoire")).toBeVisible();
  await expect(table.locator("tr", { hasText: "Karim Benali" }).locator("[data-testid^=cell-brevo_territoire-]")).toHaveAttribute("data-value", "Cher");
  await expect(table.locator("tr", { hasText: "Nadia Roux" }).locator("[data-testid^=brevo-status-]")).toContainText("Désinscrit");
  await expect(page.getByTestId("contact-list-add")).toHaveCount(0);
  await expect(page.getByTestId("contact-list-import")).toHaveCount(0);
  await expect(page.locator("[data-testid^=contact-item-remove-]")).toHaveCount(0);
  // Fatou, déjà connue : complétée (identifiant Brevo, attribut), pas dupliquée.
  await page.goto("/contacts?q=diallo");
  await expect(page.locator("[data-testid^=contact-row-]")).toHaveCount(1);
  await page.locator("[data-testid^=contact-open-]").click();
  await expect(page.getByTestId("contact-brevo-status")).toHaveAttribute("data-value", "active");
  await expect(page.getByTestId("contact-brevo-attributes")).toContainText("Indre-et-Loire");
  await expect(page.getByTestId("contact-where")).toContainText("Newsletter ESS");
  // Le contact sans attribut est entré sous son e-mail ; une seconde synchronisation ne recrée rien.
  await page.goto("/contacts?q=sans-nom");
  await expect(page.locator("[data-testid^=contact-row-]")).toHaveCount(1);
  await page.goto("/admin?section=donnees");
  await page.getByTestId("brevo-sync").click();
  await expect(page.getByText(/4 contacts lus · 0 créés/).first()).toBeVisible();
});

test("une liste à soi s'envoie vers Brevo : liste créée dans le dossier Pilote, contacts inscrits, sans e-mail ignoré, retrait répercuté", async ({ page }) => {
  await page.goto("/contacts");
  await iAm(page, "Thomas Guérin");
  await page.goto("/contacts");
  await page.getByTestId("new-contact-list").first().click();
  await page.getByTestId("new-contact-list-name").fill("Séminaire 2026 · envoi");
  await page.getByTestId("new-contact-list-submit").click();
  await expect(page.getByTestId("contacts-main")).toHaveAttribute("data-name", "Séminaire 2026 · envoi");
  await page.getByTestId("contact-list-add").click();
  await pick(page, "add-existing-contact", "Marius Garnier");
  await page.getByTestId("add-existing-submit").click();
  await expect(page.getByTestId("contact-list-table")).toContainText("Marius Garnier");
  await pick(page, "add-existing-contact", "Fatou Diallo");
  await page.getByTestId("add-existing-submit").click();
  await expect(page.getByTestId("contact-list-table")).toContainText("Fatou Diallo");
  await page.getByTestId("add-mode-new").click();
  await page.getByTestId("add-new-lastName").fill("Sans-Courriel");
  await page.getByTestId("add-new-firstName").fill("Paul");
  await page.getByTestId("add-new-submit").click();
  await expect(page.getByTestId("contact-list-count")).toContainText("3 contacts");
  // L'envoi dit ce qui part et ce qui ne part pas.
  await page.getByTestId("contact-list-push").click();
  await expect(page.getByTestId("push-summary")).toContainText("créée dans Brevo");
  await expect(page.getByTestId("push-summary")).toContainText("1 sans e-mail");
  await page.getByTestId("push-run").click();
  await expect(page.getByText(/Brevo : 2 contacts envoyés/)).toBeVisible();
  await expect(page.getByTestId("contact-list-pushed")).toContainText("dans Brevo");
  const st = await mockState(page);
  const list = st.lists.find((l) => l.name === "Séminaire 2026 · envoi")!;
  expect(list).toBeTruthy();
  expect(st.folders.find((f) => f.id === list.folderId)?.name).toBe("Pilote");
  const members = st.contacts.filter((c) => c.listIds.includes(list.id));
  expect(members.map((c) => c.email).sort()).toEqual(["f.diallo@exemple.fr", "m.garnier@exemple.fr"]);
  expect(members.find((c) => c.email === "m.garnier@exemple.fr")?.attributes).toMatchObject({ PRENOM: "Marius", NOM: "Garnier", SOCIETE: "Initiative Loiret" });
  // Marius est désormais connu de Brevo (identifiant posé ici) ; retiré de la liste → sorti de la liste Brevo, gardé dans Brevo.
  await page.locator("tr", { hasText: "Marius Garnier" }).locator("[data-testid^=contact-item-remove-]").click();
  await expect(page.getByTestId("contact-list-count")).toContainText("2 contacts");
  await page.getByTestId("contact-list-push").click();
  await expect(page.getByTestId("push-summary")).toContainText("mise à jour");
  await page.getByTestId("push-run").click();
  await expect(page.getByText(/1 contact envoyé · 1 retiré/)).toBeVisible();
  const after = await mockState(page);
  expect(after.contacts.find((c) => c.email === "m.garnier@exemple.fr")?.listIds).not.toContain(list.id);
  expect(after.contacts.some((c) => c.email === "m.garnier@exemple.fr")).toBe(true);
  await page.goto("/contacts?q=garnier");
  await page.locator("[data-testid^=contact-open-]").click();
  await expect(page.getByTestId("contact-brevo-status")).toHaveAttribute("data-value", "active");
});
