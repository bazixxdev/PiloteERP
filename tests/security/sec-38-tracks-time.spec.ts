import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { cookieOf, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

// « Suit son temps » (26/09, tâche 16, revue fix round 1) : une personne décochée n'écrit plus une seule heure, par aucune
// des commandes qui créent une TimeEntry ou une WeekDeclaration — même en appelant la commande serveur en direct, comme le
// ferait un client falsifié (l'interface, qui redirige /temps vers /ma-semaine, n'est pas une garde) — et la relance de
// saisie (remindTime) la refuse aussi. Le contributeur de recette (Lucas Perrin) sert de cobaye : sa case est décochée pour
// la durée de ce fichier seulement, puis remise à true (aucune autre spec ne doit hériter du réglage).
const TIME_FILE = "app/actions/time.ts";
const NOTIF_FILE = "app/actions/notifications.ts";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.SECURITY_DATABASE_URL } } });

async function call(baseURL: string, file: string, name: string, args: unknown[], actor = SECURITY_ACTORS.contributor) {
  const res = await postServerAction(baseURL, serverActionId(file, name), args, cookieOf(actor));
  expect(res.status, `${name} : HTTP ${res.status}`).toBe(200);
  return res.text();
}

test.describe("SEC-38 — écriture de temps refusée à qui ne suit pas son temps", () => {
  let lucasId: string;

  test.beforeAll(async () => {
    const lucas = await prisma.person.findUniqueOrThrow({ where: { email: SECURITY_ACTORS.contributor.email }, select: { id: true } });
    lucasId = lucas.id;
    await prisma.person.update({ where: { id: lucasId }, data: { tracksTime: false } });
  });

  test.afterAll(async () => {
    await prisma.person.update({ where: { id: lucasId }, data: { tracksTime: true } });
    await prisma.$disconnect();
  });

  test("saveTime n'écrit rien pour elle-même, ni pour elle par une main autorisée à saisir pour un tiers", async ({ baseURL }) => {
    const url = String(baseURL);
    const before = await prisma.timeEntry.count({ where: { personId: lucasId } });
    const self = await call(url, TIME_FILE, "saveTime", [{ date: "2026-08-10", hours: 3 }]);
    expect(self).toContain('"ok":false');
    expect(self).toMatch(/aucune saisie n'est possible/);
    // La RAF a le droit de saisir pour un tiers (canLockMonths) : la case décochée l'emporte quand même.
    const byRaf = await call(url, TIME_FILE, "saveTime", [{ date: "2026-08-10", hours: 3, personId: lucasId }], SECURITY_ACTORS.raf);
    expect(byRaf).toContain('"ok":false');
    expect(byRaf).toMatch(/ne suit pas son temps/);
    expect(await prisma.timeEntry.count({ where: { personId: lucasId } })).toBe(before);
  });

  test("saveWeekSplit n'écrit rien", async ({ baseURL }) => {
    const before = await prisma.timeEntry.count({ where: { personId: lucasId } });
    const body = await call(String(baseURL), TIME_FILE, "saveWeekSplit", ["2026-08-10", [{ projectId: null, actionId: null, timeCodeId: null, percent: 100 }]]);
    expect(body).toContain('"ok":false');
    expect(body).toMatch(/aucune saisie n'est possible/);
    expect(await prisma.timeEntry.count({ where: { personId: lucasId } })).toBe(before);
  });

  test("declareWeek et copyPreviousWeek sont refusées aussi (même garde, un seul helper)", async ({ baseURL }) => {
    const url = String(baseURL);
    const declBefore = await prisma.weekDeclaration.count({ where: { personId: lucasId } });
    const decl = await call(url, TIME_FILE, "declareWeek", ["2026-W33"]);
    expect(decl).toContain('"ok":false');
    expect(await prisma.weekDeclaration.count({ where: { personId: lucasId } })).toBe(declBefore);

    const entriesBefore = await prisma.timeEntry.count({ where: { personId: lucasId } });
    const copy = await call(url, TIME_FILE, "copyPreviousWeek", ["2026-08-10"]);
    expect(copy).toContain('"ok":false');
    expect(await prisma.timeEntry.count({ where: { personId: lucasId } })).toBe(entriesBefore);
  });

  test("remindTime refuse une personne qui ne suit pas son temps, avant toute écriture", async ({ baseURL }) => {
    const before = await prisma.notification.count({ where: { personId: lucasId, kind: "time_reminder" } });
    const body = await call(String(baseURL), NOTIF_FILE, "remindTime", [lucasId, "2026-08"], SECURITY_ACTORS.raf);
    expect(body).toContain('"ok":false');
    expect(body).toMatch(/ne suit pas son temps/);
    expect(await prisma.notification.count({ where: { personId: lucasId, kind: "time_reminder" } })).toBe(before);
  });

  test("témoin : la même commande réussit pour quelqu'un qui suit son temps", async ({ baseURL }) => {
    const thomas = await prisma.person.findUniqueOrThrow({ where: { email: SECURITY_ACTORS.pilot.email }, select: { id: true, tracksTime: true } });
    expect(thomas.tracksTime).toBe(true);
    const body = await call(String(baseURL), TIME_FILE, "declareWeek", ["2026-W33"], SECURITY_ACTORS.pilot);
    expect(body).toContain('"ok":true');
  });
});
