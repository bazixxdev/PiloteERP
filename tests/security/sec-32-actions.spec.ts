import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { cookieOf, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

// Actions composantes (26/09) : une personne hors du projet — ni pilote, ni équipe d'une année couverte, ni responsable ou
// associée, sans droit de pôle — ne modifie l'action par aucune commande (période, jalon, personnes associées, suppression)
// ni par saveField. Les commandes sont appelées en direct, comme le ferait un client falsifié : l'interface n'est pas une garde.
const actionId = readFileSync("tests/.security-outside-action-id", "utf8").trim();
const FILE = "app/actions/actions.ts";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.SECURITY_DATABASE_URL } } });

async function call(baseURL: string, file: string, name: string, args: unknown[], actor = SECURITY_ACTORS.contributor) {
  const res = await postServerAction(baseURL, serverActionId(file, name), args, cookieOf(actor));
  expect(res.status, `${name} : HTTP ${res.status}`).toBe(200);
  return res.text();
}

test.describe("SEC-32 — commandes de l'action", () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test("une personne hors du projet ne modifie l'action par aucune commande ni par saveField", async ({ baseURL }) => {
    const url = String(baseURL);
    const before = await prisma.action.findUniqueOrThrow({ where: { id: actionId }, include: { people: true, milestones: true } });
    const lucas = await prisma.person.findUniqueOrThrow({ where: { email: SECURITY_ACTORS.contributor.email }, select: { id: true } });
    const attempts: [string, string, unknown[]][] = [
      [FILE, "setActionPeriod", [actionId, "2020-01-01", "2020-12-31"]],
      [FILE, "addMilestone", [actionId, { date: "2026-05-04", label: "SEC32_MILESTONE" }]],
      [FILE, "setActionPeople", [actionId, [lucas.id]]],
      [FILE, "deleteAction", [actionId]],
      ["app/actions/fields.ts", "saveField", ["action", actionId, "name", "SEC32_RENAMED"]],
    ];
    for (const [file, name, args] of attempts) {
      const body = await call(url, file, name, args);
      expect(body, name).toContain('"ok":false');
      expect(body, name).toMatch(/Vous ne pouvez pas/);
    }
    const after = await prisma.action.findUniqueOrThrow({ where: { id: actionId }, include: { people: true, milestones: true } });
    expect(after.name).toBe(before.name);
    expect(after.startDate?.toISOString()).toBe(before.startDate?.toISOString());
    expect(after.endDate?.toISOString()).toBe(before.endDate?.toISOString());
    expect(after.people.map((p) => p.personId).sort()).toEqual(before.people.map((p) => p.personId).sort());
    expect(after.milestones.length).toBe(before.milestones.length);
  });

  test("témoin : la direction passe la même garde (la commande est bien servie et l'action trouvée)", async ({ baseURL }) => {
    const a = await prisma.action.findUniqueOrThrow({ where: { id: actionId }, select: { startDate: true, endDate: true } });
    const day = (d: Date | null) => d!.toISOString().slice(0, 10);
    // Même période qu'avant : aucune donnée changée, seule la réponse compte.
    const body = await call(String(baseURL), FILE, "setActionPeriod", [actionId, day(a.startDate), day(a.endDate)], SECURITY_ACTORS.director);
    expect(body).toContain('"ok":true');
  });
});
