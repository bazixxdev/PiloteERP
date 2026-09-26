// Contrôle de la copie de la migration 20260927090000_actions_composantes (spec actions § 1). Lit la base du `.env`
// (pilote_dev) en lecture seule ; hors du motif de `npm run check` car il dépend d'une base. À la main :
//   npx tsx --test tests/migration/actions-migration.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test("après migration : aucune action sans projet ni période, un jalon par ancienne date, un lien par ancien financeur", async (t) => {
  try {
    try { await prisma.$queryRaw`select 1`; } catch { t.skip("base de dev injoignable"); return; }
    const [noProject, noPeriod, dated, milestones, linked, links] = await Promise.all([
      prisma.action.count({ where: { projectId: null } }),
      prisma.action.count({ where: { OR: [{ startDate: null }, { endDate: null }] } }),
      prisma.action.count({ where: { milestoneDate: { not: null } } }),
      prisma.milestone.count({ where: { id: { startsWith: "ms_" } } }),
      prisma.action.count({ where: { fundingLineId: { not: null } } }),
      prisma.actionFunding.count(),
    ]);
    assert.equal(noProject, 0); assert.equal(noPeriod, 0);
    assert.ok(milestones >= dated); assert.ok(links >= linked);
  } finally {
    await prisma.$disconnect();
  }
});
