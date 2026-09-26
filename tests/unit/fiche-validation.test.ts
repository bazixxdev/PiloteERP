import { test } from "node:test";
import assert from "node:assert/strict";
import { nextLevel, statusAfter, isCircuitComplete, currentRound, circuitSteps, isLevelPermission, FICHE_LEVEL_PERMISSIONS, decisionLevel, ficheDecisionRefusal } from "../../lib/fiche-validation";

const L = [{ id: "l1", order: 1, label: "Direction", permission: "fiche.validate.1", active: true }, { id: "l2", order: 2, label: "CA", permission: "fiche.validate.2", active: true }];
const d = (levelId: string, decision: "approved" | "rework" | "refused", day: number) => ({ levelId, decision, decidedAt: new Date(2026, 0, day) });

test("les niveaux se décident dans l'ordre", () => {
  assert.equal(nextLevel(L, [])?.id, "l1");
  assert.equal(nextLevel(L, [d("l1", "approved", 1)])?.id, "l2");
  assert.equal(nextLevel(L, [d("l1", "approved", 1), d("l2", "approved", 2)]), null);
});

test("validée au dernier niveau ; « à retravailler » re-challenge et fait repartir du premier niveau", () => {
  assert.equal(statusAfter(L, [d("l1", "approved", 1), d("l2", "approved", 2)], "proposed"), "validated");
  const rework = [d("l1", "approved", 1), d("l2", "rework", 2)];
  assert.equal(statusAfter(L, rework, "proposed"), "rechallenged");
  assert.deepEqual(currentRound(rework), []);
  assert.equal(nextLevel(L, rework)?.id, "l1");
  assert.equal(isCircuitComplete(L, [...rework, d("l1", "approved", 3), d("l2", "approved", 4)]), true);
});

test("un refus laisse le statut ; un niveau inactif est sauté", () => {
  assert.equal(statusAfter(L, [d("l1", "refused", 1)], "proposed"), "proposed");
  const L2 = [L[0], { ...L[1], active: false }];
  assert.equal(statusAfter(L2, [d("l1", "approved", 1)], "proposed"), "validated");
});

test("un refus ne fait pas avancer le circuit : le même niveau reste à décider", () => {
  assert.equal(nextLevel(L, [d("l1", "refused", 1)])?.id, "l1");
  assert.equal(nextLevel(L, [d("l1", "approved", 1), d("l2", "refused", 2)])?.id, "l2");
});

test("un circuit terminé ne fait pas reculer une année déjà en cours ou close", () => {
  const done = [d("l1", "approved", 1), d("l2", "approved", 2)];
  assert.equal(statusAfter(L, done, "in_progress"), "in_progress");
  assert.equal(statusAfter(L, done, "closed"), "closed");
  assert.equal(statusAfter(L, done, "rechallenged"), "validated");
});

test("« à retravailler » sur une année en cours : le circuit repart, l'année reste en cours ; validée → re-challengée", () => {
  const reopened = [d("l1", "approved", 1), d("l2", "approved", 2), d("l2", "rework", 3)];
  assert.equal(statusAfter(L, reopened, "in_progress"), "in_progress");
  assert.equal(isCircuitComplete(L, reopened), false);
  assert.equal(nextLevel(L, reopened)?.id, "l1");
  assert.equal(statusAfter(L, reopened, "validated"), "rechallenged");
  assert.equal(statusAfter(L, reopened, "rechallenged"), "rechallenged");
  assert.equal(statusAfter(L, reopened, "closed"), "closed");
});

test("sans niveau actif, le circuit n'est jamais terminé", () => {
  const off = L.map((l) => ({ ...l, active: false }));
  assert.equal(isCircuitComplete(off, []), false);
  assert.equal(nextLevel(off, []), null);
});

test("les étapes du circuit : la décision du tour courant par niveau, le niveau à décider", () => {
  const steps = circuitSteps(L, [d("l1", "rework", 1), d("l1", "approved", 3)]);
  assert.deepEqual(steps.map((s) => [s.level.id, s.decision?.decision ?? null, s.isNext]), [["l1", "approved", false], ["l2", null, true]]);
  // Le « à retravailler » a remis le circuit à zéro : aucune décision du tour courant.
  assert.deepEqual(circuitSteps(L, [d("l1", "approved", 1), d("l2", "rework", 2)]).map((s) => s.decision), [null, null]);
});

test("seuls les droits du circuit sont acceptés pour un niveau", () => {
  assert.deepEqual([...FICHE_LEVEL_PERMISSIONS], ["fiche.validate.1", "fiche.validate.2", "fiche.validate.3"]);
  assert.equal(isLevelPermission("fiche.validate.2"), true);
  assert.equal(isLevelPermission("admin.manage"), false);
});

test("la garde de decideFiche : droit du niveau, jamais sa propre fiche, commentaire exigé, circuit terminé", () => {
  const base = { levels: L, decisions: [] as ReturnType<typeof d>[], status: "proposed", isPilot: false, holds: (p: string) => p === "fiche.validate.1", decision: "approved" as const, comment: "" };
  assert.equal(ficheDecisionRefusal(base), null);
  // Le niveau 2 n'est pas proposé tant que le 1 n'est pas validé : qui ne tient que le niveau 2 ne décide rien.
  assert.match(ficheDecisionRefusal({ ...base, holds: (p) => p === "fiche.validate.2" }) ?? "", /droit de décider au niveau « Direction »/);
  assert.match(ficheDecisionRefusal({ ...base, isPilot: true, holds: () => true }) ?? "", /propre fiche/);
  assert.match(ficheDecisionRefusal({ ...base, decision: "rework", comment: "  " }) ?? "", /commentaire est obligatoire/);
  assert.equal(ficheDecisionRefusal({ ...base, decision: "refused", comment: "Budget flou" }), null);
  assert.match(ficheDecisionRefusal({ ...base, status: "closed" }) ?? "", /close/);
  const done = [d("l1", "approved", 1), d("l2", "approved", 2)];
  assert.match(ficheDecisionRefusal({ ...base, decisions: done, holds: () => true }) ?? "", /Circuit terminé/);
  // Rouvrir une fiche validée : « à retravailler », au dernier niveau, par qui en tient le droit.
  assert.equal(decisionLevel(L, done, "rework")?.id, "l2");
  assert.equal(ficheDecisionRefusal({ ...base, decisions: done, decision: "rework", comment: "À reprendre", holds: (p) => p === "fiche.validate.2" }), null);
  assert.match(ficheDecisionRefusal({ ...base, levels: L.map((l) => ({ ...l, active: false })) }) ?? "", /Aucun niveau/);
  // Un niveau réglé sur un droit hors circuit ne se décide pas.
  assert.match(ficheDecisionRefusal({ ...base, levels: [{ ...L[0], permission: "admin.manage" }], holds: () => true }) ?? "", /droit de décider/);
});
