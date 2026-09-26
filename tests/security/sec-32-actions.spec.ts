import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { cookieOf, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

// Actions composantes (26/09) : une personne hors du projet — ni pilote, ni équipe d'une année couverte, ni responsable ou
// associée, sans droit de pôle — ne modifie l'action par aucune commande (période, jalon, personnes associées, suppression)
// ni par saveField. Les commandes sont appelées en direct, comme le ferait un client falsifié : l'interface n'est pas une garde.
const fixture = (name: string) => readFileSync(`tests/.security-${name}-action-id`, "utf8").trim();
const actionId = fixture("outside");
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

  test("une personne associée modifie l'action, mais ne gère pas la liste des associés et ne la supprime pas", async ({ baseURL }) => {
    const url = String(baseURL);
    const id = fixture("associate");
    const before = await prisma.action.findUniqueOrThrow({ where: { id }, include: { people: true } });
    const edit = await call(url, "app/actions/fields.ts", "saveField", ["action", id, "description", "SEC32_ASSOCIATE_EDIT"]);
    expect(edit).toContain('"ok":true');
    for (const [name, args] of [["setActionPeople", [id, []]], ["deleteAction", [id]]] as const) {
      const body = await call(url, FILE, name, [...args]);
      expect(body, name).toContain('"ok":false');
      expect(body, name).toMatch(/Vous ne pouvez pas/);
    }
    const after = await prisma.action.findUniqueOrThrow({ where: { id }, include: { people: true } });
    expect(after.description).toBe("SEC32_ASSOCIATE_EDIT");
    expect(after.people.map((p) => p.personId).sort()).toEqual(before.people.map((p) => p.personId).sort());
  });

  test("une personne associée ne se nomme pas responsable par saveField ; le responsable, lui, passe la main", async ({ baseURL }) => {
    const url = String(baseURL);
    const lucas = await prisma.person.findUniqueOrThrow({ where: { email: SECURITY_ACTORS.contributor.email }, select: { id: true } });
    const id = fixture("associate");
    const before = await prisma.action.findUniqueOrThrow({ where: { id }, select: { ownerId: true } });
    const grab = await call(url, "app/actions/fields.ts", "saveField", ["action", id, "ownerId", lucas.id]);
    expect(grab).toContain('"ok":false');
    expect(grab).toMatch(/Vous ne pouvez pas/);
    expect((await prisma.action.findUniqueOrThrow({ where: { id }, select: { ownerId: true } })).ownerId).toBe(before.ownerId);
    // Positif : responsable d'une action, il la confie à la direction.
    const owned = fixture("owned");
    const director = await prisma.person.findUniqueOrThrow({ where: { email: SECURITY_ACTORS.director.email }, select: { id: true } });
    const hand = await call(url, "app/actions/fields.ts", "saveField", ["action", owned, "ownerId", director.id]);
    expect(hand).toContain('"ok":true');
    expect((await prisma.action.findUniqueOrThrow({ where: { id: owned }, select: { ownerId: true } })).ownerId).toBe(director.id);
  });

  test("l'équipe d'une AUTRE année que la période couvre modifie l'action (runsIn), pas seulement celle de sa création", async ({ baseURL }) => {
    const id = fixture("multiyear");
    const body = await call(String(baseURL), FILE, "addMilestone", [id, { date: "2027-06-15", label: "SEC32_MULTIYEAR_MILESTONE" }]);
    expect(body).toContain('"ok":true');
    expect(await prisma.milestone.count({ where: { actionId: id, label: "SEC32_MULTIYEAR_MILESTONE" } })).toBe(1);
  });

  test("une action qui porte des heures ne se supprime pas, même par la direction", async ({ baseURL }) => {
    const id = fixture("hours");
    const body = await call(String(baseURL), FILE, "deleteAction", [id], SECURITY_ACTORS.director);
    expect(body).toContain('"ok":false');
    expect(body).toContain("Des heures ou des dépenses");
    expect(await prisma.action.count({ where: { id } })).toBe(1);
  });

  test("témoin : la direction passe la même garde (la commande est bien servie et l'action trouvée)", async ({ baseURL }) => {
    const a = await prisma.action.findUniqueOrThrow({ where: { id: actionId }, select: { startDate: true, endDate: true } });
    const day = (d: Date | null) => d!.toISOString().slice(0, 10);
    // Même période qu'avant : aucune donnée changée, seule la réponse compte.
    const body = await call(String(baseURL), FILE, "setActionPeriod", [actionId, day(a.startDate), day(a.endDate)], SECURITY_ACTORS.director);
    expect(body).toContain('"ok":true');
  });
});
