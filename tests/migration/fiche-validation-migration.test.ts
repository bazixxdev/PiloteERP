// Contrôle de la migration 20260927100000_fiche_validation_semantics (décision du contrôleur du 26/09) : l'ancienne
// codirDecision = fiche validée au niveau 1 + décision pour l'année suivante. Lit la base de DATABASE_URL (pilote_dev par le
// `.env`) en lecture seule ; hors de `npm run check` car il dépend d'une base. À la main :
//   npx tsx --test tests/migration/fiche-validation-migration.test.ts
// Affiche aussi les chiffres (décisions par valeur, Decision créées, fiches verrouillées avant / après).
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { isLocked, LOCKED_STATUSES } from "../../lib/lock";
import { prepareDecisionBody, isPrepareChoice } from "../../lib/preparer";

const prisma = new PrismaClient();
test("après migration : toute codirDecision est validée au niveau 1 et consignée pour l'année suivante ; le verrou ne change pas", async (t) => {
  try {
    try { await prisma.$queryRaw`select 1`; } catch { t.skip("base injoignable"); return; }
    const [editions, levels, byDecision, prep] = await Promise.all([
      prisma.edition.findMany({ select: { id: true, year: true, status: true, codirDecision: true, boardValidated: true, ficheValidations: { select: { id: true, levelId: true, decision: true, comment: true, decidedAt: true } }, decisions: { select: { id: true, body: true } } } }),
      prisma.ficheValidationLevel.findMany({ select: { id: true, order: true, label: true, permission: true, active: true } }),
      prisma.ficheValidation.groupBy({ by: ["levelId", "decision"], _count: { _all: true }, orderBy: [{ levelId: "asc" }, { decision: "asc" }] }),
      prisma.decision.count({ where: { id: { startsWith: "dprep_" } } }),
    ]);
    const withCodir = editions.filter((e) => e.codirDecision);
    for (const e of withCodir) {
      const fv1 = e.ficheValidations.find((f) => f.id === `fv1_${e.id}`);
      assert.ok(fv1, `fv1 manquante pour ${e.id}`);
      assert.deepEqual([fv1.levelId, fv1.decision, fv1.comment], ["fvl_1", "approved", null], `fv1 de ${e.id}`);
      const body = prepareDecisionBody(isPrepareChoice(e.codirDecision) ? e.codirDecision : "stop", e.year + 1);
      // Au moins une : « Préparer » a pu consigner la même décision ensuite (sur une base qui a vécu).
      assert.ok(e.decisions.some((d) => d.body === body), `décision « ${body} » de ${e.id}`);
    }
    const oldLocked = (e: (typeof editions)[number]) => LOCKED_STATUSES.includes(e.status) || Boolean(e.codirDecision);
    const newLocked = editions.filter((e) => isLocked(e, levels));
    const before = editions.filter(oldLocked);
    // Cas accepté (décision du contrôleur) : une décision CODIR sans validation du CA verrouillait la fiche ; dans le circuit,
    // le niveau CA attend encore. Compté à part, hors de l'égalité des verrous.
    const codirWithoutBoard = (e: (typeof editions)[number]) => Boolean(e.codirDecision) && !e.boardValidated;
    const accepted = editions.filter((e) => codirWithoutBoard(e) && oldLocked(e) !== isLocked(e, levels));
    const differ = editions.filter((e) => !codirWithoutBoard(e) && oldLocked(e) !== isLocked(e, levels));
    console.log(JSON.stringify({
      editions: editions.length, codirDecision: withCodir.length, boardValidated: editions.filter((e) => e.boardValidated).length,
      ficheValidation: byDecision.map((r) => `${r.levelId}:${r.decision}=${r._count._all}`), dprepDecisions: prep,
      lockedOld: before.length, lockedNew: newLocked.length, codirWithoutBoard: editions.filter(codirWithoutBoard).length, unlockedCodirWithoutBoard: accepted.length,
      differ: differ.map((e) => ({ id: e.id, status: e.status, codirDecision: e.codirDecision, boardValidated: e.boardValidated })),
    }));
    assert.equal(differ.length, 0, "verrou différent de l'ancienne règle (codirDecision posée ou statut verrouillé), hors décision CODIR sans CA");
  } finally {
    await prisma.$disconnect();
  }
});
