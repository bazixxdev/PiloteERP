import { test, expect } from "@playwright/test";
import { iAm, pick } from "./helpers";

// Matériel et prêts (18/09) : l'inventaire (disponible = quantité − sorti), prêter à l'équipe ou à un contact, retour,
// retards, fiche avec historique ; l'inventaire se tient avec le droit, tout le monde emprunte.

const ymd = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv"); };

test("l'assistante ajoute du matériel ; un pilote l'emprunte pour un projet, le retard se voit, le retour libère", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/materiel");
  await iAm(page, "Léa Morin");
  await page.goto("/materiel");
  // Le seed : le vidéoprojecteur a une unité sortie en retard chez un contact, les kakemonos deux sur trois chez Hugo.
  const table = page.getByTestId("equipment-table");
  await expect(table).toContainText("Vidéoprojecteur Epson");
  await expect(page.locator('[data-testid^=equipment-][data-name="Vidéoprojecteur Epson EB-X49"]')).toHaveAttribute("data-available", "1");
  await expect(page.locator('[data-testid^=equipment-][data-name="Vidéoprojecteur Epson EB-X49"]')).toContainText("en retard");
  await expect(page.locator('[data-testid^=equipment-][data-name="Kakemono CRESS (roll-up 85 × 200)"]')).toHaveAttribute("data-available", "1");
  // Nouveau matériel : la fiche s'ouvre.
  await page.getByTestId("new-equipment").click();
  await page.getByTestId("equipment-name").fill("Paperboard sur pied");
  await page.getByTestId("equipment-category").fill("Animation");
  await page.getByTestId("equipment-quantity").fill("2");
  await page.getByTestId("equipment-location").fill("Salle de réunion");
  await page.getByTestId("equipment-submit").click();
  await expect(page.getByTestId("equipment-panel")).toContainText("Paperboard sur pied");
  await expect(page.getByTestId("equipment-loans")).toContainText("Jamais prêté");
  await page.keyboard.press("Escape");
  // Un pilote emprunte (à l'équipe, pour un projet, retour dans 3 jours) ; il ne crée pas de matériel.
  await page.goto("/materiel");
  await iAm(page, "Maxime Roussel");
  await page.goto("/materiel?q=paperboard");
  await expect(page.getByTestId("new-equipment")).toHaveCount(0);
  const paper = page.locator('[data-testid^=equipment-][data-name="Paperboard sur pied"]');
  await paper.locator("[data-testid^=loan-open-]").click();
  await pick(page, "loan-person", "Maxime Roussel");
  await expect(page.getByTestId("loan-submit")).toBeDisabled(); // le retour attendu est obligatoire
  await page.getByTestId("loan-due").fill(ymd(3));
  await page.getByTestId("loan-deposit").fill("150");
  await page.getByTestId("loan-submit").click();
  await expect(page.getByText(/Prêt enregistré/)).toBeVisible();
  // La fiche de prêt : numéro, emprunteur, retour attendu, caution, envoi par mail, impression.
  await expect(page).toHaveURL(/\/materiel\/pret\//);
  const fiche = page.getByTestId("loan-fiche");
  await expect(fiche).toHaveAttribute("data-status", "open");
  await expect(page.getByTestId("loan-number")).toContainText(/P-\d{4}/);
  await expect(page.getByTestId("loan-who")).toContainText("Maxime Roussel");
  await expect(page.getByTestId("loan-deposit-amount")).toHaveValue("150");
  const mailto = (await page.getByTestId("loan-send").getAttribute("href"))!;
  expect(mailto.startsWith("mailto:")).toBe(true);
  expect(decodeURIComponent(mailto)).toContain("Paperboard sur pied");
  expect(decodeURIComponent(mailto)).toContain("Retour attendu le");
  await expect(page.getByTestId("loan-print")).toBeVisible();
  // Une pièce sur la fiche (la fiche signée).
  await page.getByTestId("file-label").fill("Fiche signée");
  await page.getByTestId("file-input").setInputFiles({ name: "fiche-signee.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% fiche de pret signee\n%%EOF\n") });
  await page.getByTestId("file-submit").click();
  await expect(page.getByTestId("loan-files")).toContainText("Fiche signée");
  // Retour depuis l'inventaire : disponible 1/2, l'emprunteur affiché.
  await page.goto("/materiel?q=paperboard");
  await expect(paper).toHaveAttribute("data-available", "1");
  await expect(paper).toContainText("Maxime Roussel");
  // Une seconde unité, puis la troisième est refusée.
  await paper.locator("[data-testid^=loan-open-]").click();
  await pick(page, "loan-person", "Maxime Roussel");
  await page.getByTestId("loan-due").fill(ymd(5));
  await page.getByTestId("loan-submit").click();
  await expect(page).toHaveURL(/\/materiel\/pret\//);
  await page.goto("/materiel?q=paperboard");
  await expect(paper).toHaveAttribute("data-available", "0");
  await expect(paper.locator("[data-testid^=loan-open-]")).toBeDisabled();
  // Prêter à une organisation : il faut toujours quelqu'un qui prend le matériel (contact existant, ou créé).
  await page.goto("/materiel?q=tables");
  const tables = page.locator('[data-testid^=equipment-][data-name="Tables pliantes"]');
  await tables.locator("[data-testid^=loan-open-]").click();
  await page.getByTestId("loan-to-organisation").click();
  await pick(page, "loan-organisation", "Coop'Alim Berry");
  await page.getByTestId("loan-due").fill(ymd(7));
  await expect(page.getByTestId("loan-submit")).toBeDisabled(); // pas de contact désigné
  await pick(page, "loan-org-contact", "Bastien Lefort");
  await page.getByTestId("loan-quantity").fill("4");
  await page.getByTestId("loan-submit").click();
  await expect(page).toHaveURL(/\/materiel\/pret\//);
  await expect(page.getByTestId("loan-who")).toContainText("Bastien Lefort");
  await expect(page.getByTestId("loan-who")).toContainText("Coop'Alim Berry");
  // Prêts en cours : le retard du vidéoprojecteur, le retour libère.
  await page.goto("/materiel?vue=prets");
  const loans = page.getByTestId("loans-table");
  await expect(loans).toContainText("Paperboard sur pied");
  const lateRow = page.locator('[data-testid^=loan-][data-late="1"]');
  await expect(lateRow).toHaveCount(1);
  await expect(lateRow).toContainText("Vidéoprojecteur");
  await lateRow.locator("[data-testid^=loan-return-]").first().click();
  await lateRow.locator("[data-testid^=loan-return-note-]").fill("télécommande manquante");
  await lateRow.locator("[data-testid^=loan-return-confirm-]").click();
  await expect(page.getByText(/retour enregistré/)).toBeVisible();
  await expect(page.locator('[data-testid^=loan-][data-late="1"]')).toHaveCount(0);
  // Le commentaire de retour se lit sur la fiche du prêt (rendu), modifiable.
  await page.goto("/materiel?q=epson");
  await page.locator("[data-testid^=equipment-open-]").first().click();
  await page.getByTestId("equipment-loans").locator('[data-returned="1"]').first().getByRole("link").click();
  await expect(page.getByTestId("loan-fiche")).toHaveAttribute("data-status", "returned");
  await expect(page.getByTestId("loan-return-note")).toContainText("télécommande manquante"); // Maxime lit (prêt saisi par Léa)
  await page.goto("/materiel?q=epson");
  await expect(page.locator('[data-testid^=equipment-][data-name="Vidéoprojecteur Epson EB-X49"]')).toHaveAttribute("data-available", "2");
  await page.locator("[data-testid^=equipment-open-]").first().click();
  await expect(page.getByTestId("equipment-loans")).toContainText("télécommande manquante");
  // Filtre « disponible seulement » : le paperboard, tout sorti, disparaît.
  await page.goto("/materiel?dispo=1");
  await expect(page.locator('[data-testid^=equipment-][data-name="Paperboard sur pied"]')).toHaveCount(0);
});
