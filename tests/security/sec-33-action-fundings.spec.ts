import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { cookieOf, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

// Financements de l'action (26/09) : lier une ligne, régler son montant, retirer le lien exigent le droit de modifier l'action.
// Une personne hors du projet (l'action « outside » de SEC-32) est refusée par les trois commandes, appelées en direct comme le
// ferait un client falsifié ; et même la direction, qui a ce droit, ne lie pas une ligne d'un AUTRE projet.
const actionId = readFileSync("tests/.security-outside-action-id", "utf8").trim();
const FILE = "app/actions/actions.ts";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.SECURITY_DATABASE_URL } } });

async function call(baseURL: string, name: string, args: unknown[], actor = SECURITY_ACTORS.contributor) {
  const res = await postServerAction(baseURL, serverActionId(FILE, name), args, cookieOf(actor));
  expect(res.status, `${name} : HTTP ${res.status}`).toBe(200);
  return res.text();
}

let ownLineId = "";
let foreignLineId = "";

test.describe("SEC-33 — financements de l'action", () => {
  test.beforeAll(async () => {
    const a = await prisma.action.findUniqueOrThrow({ where: { id: actionId }, select: { projectId: true, startDate: true, endDate: true } });
    const [from, to] = [a.startDate!.getUTCFullYear(), a.endDate!.getUTCFullYear()];
    const own = await prisma.fundingLine.findFirst({ where: { edition: { projectId: a.projectId!, year: { gte: from, lte: to } } }, orderBy: { id: "asc" }, select: { id: true } });
    const foreign = await prisma.fundingLine.findFirst({ where: { edition: { projectId: { not: a.projectId! } } }, orderBy: { id: "asc" }, select: { id: true } });
    if (!own || !foreign) throw new Error("Fixture SEC-33 : lignes de financement introuvables (même projet sur la période, autre projet).");
    ownLineId = own.id;
    foreignLineId = foreign.id;
    // Un lien existant, posé par la base : la cible de setFundingAmount et unlinkFunding.
    await prisma.actionFunding.upsert({ where: { actionId_fundingLineId: { actionId, fundingLineId: ownLineId } }, create: { actionId, fundingLineId: ownLineId, amount: 100 }, update: { amount: 100 } });
  });

  test.afterAll(async () => {
    await prisma.actionFunding.deleteMany({ where: { actionId } });
    await prisma.$disconnect();
  });

  test("une personne hors du projet ne lie pas de ligne, ne règle pas de montant, ne retire pas de lien", async ({ baseURL }) => {
    const url = String(baseURL);
    const attempts: [string, unknown[]][] = [
      ["linkFunding", [actionId, ownLineId, 5_000]],
      ["setFundingAmount", [actionId, ownLineId, 999_999]],
      ["unlinkFunding", [actionId, ownLineId]],
    ];
    for (const [name, args] of attempts) {
      const body = await call(url, name, args);
      expect(body, name).toContain('"ok":false');
      expect(body, name).toMatch(/Vous ne pouvez pas/);
    }
    const links = await prisma.actionFunding.findMany({ where: { actionId } });
    expect(links.map((l) => [l.fundingLineId, l.amount])).toEqual([[ownLineId, 100]]);
  });

  test("la direction, qui modifie l'action, ne lie pas une ligne d'un autre projet", async ({ baseURL }) => {
    const body = await call(String(baseURL), "linkFunding", [actionId, foreignLineId, null], SECURITY_ACTORS.director);
    expect(body).toContain('"ok":false');
    expect(body).toContain("introuvable sur ce projet");
    expect(await prisma.actionFunding.count({ where: { actionId, fundingLineId: foreignLineId } })).toBe(0);
  });

  test("témoin : la direction règle le montant d'un lien de l'action (la commande est servie, la garde passe)", async ({ baseURL }) => {
    const body = await call(String(baseURL), "setFundingAmount", [actionId, ownLineId, 250], SECURITY_ACTORS.director);
    expect(body).toContain('"ok":true');
    expect((await prisma.actionFunding.findUniqueOrThrow({ where: { actionId_fundingLineId: { actionId, fundingLineId: ownLineId } } })).amount).toBe(250);
  });
});
