import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Flux agenda iCal : l'adresse apparaît dans « Ma semaine », le flux est un calendrier valide avec les jalons de la personne.
test("le flux iCal personnel expose les jalons de la personne, le flux équipe tous les jalons", async ({ page, request }) => {
  await page.goto("/ma-semaine");
  await iAm(page, "Inès Cabral");
  const url = await page.getByTestId("ics-url-me").innerText();
  expect(url).toMatch(/\/api\/agenda\/[A-Za-z0-9_-]+\.ics$/);

  const res = await request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const ics = await res.text();
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("X-WR-CALNAME:Pilote · échéances de Inès Cabral");
  expect(ics).toContain("BEGIN:VEVENT");
  expect(ics).toContain("SUMMARY:Jalon ·");
  for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);

  const bad = await request.get("/api/agenda/jeton-inconnu.ics");
  expect(bad.status()).toBe(404);

  await page.goto("/cafe");
  const teamUrl = await page.getByTestId("ics-url-team").innerText();
  const team = await request.get(teamUrl);
  expect(team.status()).toBe(200);
  expect((await team.text()).match(/BEGIN:VEVENT/g)!.length).toBeGreaterThan(20);
});

// Connexions « gratuites » : jeton d'API sur les exports (Excel), flux public pour le site.
test("les exports exigent le jeton d'API hors de l'outil ; le flux public est ouvert", async ({ page, request }) => {
  await page.goto("/admin?section=donnees");
  await iAm(page, "Nadia Ferrand");
  const url = await page.getByTestId("api-url-temps").innerText();
  expect(url).toMatch(/jeton=/);

  const ok = await request.get(url);
  expect(ok.status()).toBe(200);
  expect(await ok.text()).toContain("personne;date;projet");

  const bad = await request.get(url.replace(/jeton=.*$/, "jeton=faux"));
  expect(bad.status()).toBe(401);

  const pub = await request.get("/api/agenda/public.ics");
  expect(pub.status()).toBe(200);
  const ics = await pub.text();
  expect(ics).toContain("X-WR-CALNAME:CRESS Centre-Val de Loire · agenda");
  expect(ics).toContain("SUMMARY:Soirée de remise");
  expect(ics).not.toContain("Reporting national");
});
