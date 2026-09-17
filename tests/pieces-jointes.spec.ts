import { test, expect } from "@playwright/test";
import { FRESH, iAm, openEditionByName, pick } from "./helpers";

// Pièces jointes légères : dépôt par le pilote, visible sur l'édition, téléchargement réservé aux personnes connectées.
test("le pilote dépose un compte rendu, la pièce apparaît et se télécharge ; sans connexion, refus", async ({ page, playwright }) => {
  await page.goto("/portefeuille");
  await iAm(page, "Inès Cabral");
  await openEditionByName(page, "Observatoire régional (ORESS)");
  await page.getByRole("tab", { name: "Documents" }).click();

  await expect(page.getByTestId("pieces")).toBeVisible();
  await page.getByTestId("upload-open").click();
  await expect(page.getByTestId("upload-form")).toBeVisible();
  const before = await page.getByTestId("pieces").locator("[data-testid=attachments] li").count();
  await pick(page, "upload-kind", { value: "minutes" });
  await page.getByTestId("upload-file").setInputFiles({ name: "cr-copil.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% compte rendu fictif\n%%EOF\n") });
  await page.getByTestId("upload-submit").click();
  await expect(page.getByText("Pièce déposée")).toBeVisible();
  const list = page.getByTestId("pieces").locator("[data-testid=attachments] li");
  await expect(list).toHaveCount(before + 1, { timeout: 10_000 });
  const row = list.filter({ hasText: "cr-copil.pdf" });
  await expect(row).toContainText("Compte rendu");
  await expect(row).toContainText("Inès Cabral");

  const href = await row.getByRole("link").getAttribute("href");
  const ok = await page.request.get(href!);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("application/pdf");
  const anonCtx = await playwright.request.newContext({ baseURL: new URL(page.url()).origin, storageState: FRESH });
  const anon = await anonCtx.get(href!);
  expect(anon.status()).toBe(401);

  // Une pièce trop lourde est refusée.
  await page.getByTestId("upload-file").setInputFiles({ name: "gros.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 1024, 1) });
  await page.getByTestId("upload-submit").click();
  await expect(page.getByText("Pièce trop lourde")).toBeVisible();

  // Les devis seedés sont visibles sur les validations, avec le dépôt possible pour le pilote.
  await page.getByRole("tab", { name: /Aperçu/ }).click();
  await expect(page.getByTestId("validation-0").locator("[data-testid=attachments]")).toContainText("Devis");
  await page.getByTestId("validation-upload-open-0").click();
  await expect(page.getByTestId("validation-0").getByTestId("upload-form")).toBeVisible();
});
