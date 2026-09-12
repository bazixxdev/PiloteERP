import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Recette 2 (lot 2) : chaque personne saisit une semaine en moins d'une minute, la RAF verrouille un mois et exporte.
test("une personne saisit sa semaine en moins d'une minute, la RAF verrouille un mois et exporte", async ({ page, request }) => {
  await page.goto("/temps?semaine=2026-W36");
  await iAm(page, "Maxime Roussel");
  await page.goto("/temps?semaine=2026-W36");
  await expect(page.getByTestId("time-grid")).toBeVisible();

  // Total attendu = total actuel − première ligne + 5 × 7 h.
  const parse = (v: string) => Number(v.replace(",", ".").replace(/[^\d.]/g, "")) || 0;
  const totalBefore = parse((await page.getByTestId("week-total").innerText()).split("/")[0]);
  let rowBefore = 0;
  for (let i = 0; i < 5; i++) rowBefore += parse(await page.getByTestId(`cell-0-${i}`).inputValue());
  const expected = totalBefore - rowBefore + 35;

  // Saisie au clavier : 5 jours sur la première ligne, Tab entre les cellules.
  const t0 = Date.now();
  const first = page.getByTestId("cell-0-0");
  await first.click();
  for (const h of ["7", "7", "7", "7", "7"]) {
    await page.keyboard.type(h);
    await page.keyboard.press("Tab");
  }
  await expect(page.getByTestId("week-total")).toContainText(`${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(expected)} h`, { timeout: 10_000 });
  expect(Date.now() - t0).toBeLessThan(60_000);

  // Le total est persistant après rechargement.
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByTestId("cell-0-4")).toHaveValue("7");

  // La RAF verrouille août pour cette personne et exporte le CSV.
  await iAm(page, "Nadia Ferrand");
  await page.goto("/cloture?mois=2026-08");
  const row = page.getByTestId("cloture-table").locator("tr", { hasText: "Maxime Roussel" });
  await row.getByRole("button", { name: "Verrouiller" }).click();
  await expect(row).toContainText("Verrouillé", { timeout: 10_000 });

  const csv = await request.get("/cloture/export?mois=2026-08&par=personne");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Maxime Roussel");

  // Une fois verrouillé, la personne ne peut plus saisir.
  await iAm(page, "Maxime Roussel");
  await page.goto("/temps?semaine=2026-W33");
  await expect(page.getByText("Mois verrouillé par la RAF : lecture seule")).toBeVisible();
  await expect(page.getByTestId("cell-0-0")).toHaveAttribute("readonly", "");
});
