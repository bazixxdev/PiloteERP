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
