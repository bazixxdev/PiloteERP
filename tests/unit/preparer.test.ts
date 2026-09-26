import { test } from "node:test";
import assert from "node:assert/strict";
import { isPrepareChoice, prepareChoiceOf, prepareDecisionBody, prepareInstance, toPrepare } from "../../lib/preparer";

test("« Préparer » : la décision consignée se relit pour l'année visée, la plus récente d'abord", () => {
  assert.equal(prepareDecisionBody("renew", 2027), "Reconduit pour 2027");
  assert.equal(prepareDecisionBody("adjust", 2027), "Ajusté pour 2027");
  assert.equal(prepareDecisionBody("stop", 2027), "Arrêté pour 2027");
  assert.equal(prepareChoiceOf(["Arrêté pour 2027", "Reconduit pour 2027"], 2027), "stop");
  assert.equal(prepareChoiceOf(["Reconduit pour 2026", "Dépassement accepté"], 2027), null);
  assert.equal(prepareChoiceOf([], 2027), null);
});

test("« Préparer » : instance choisie si elle est dans la liste, sinon la première ; choix inconnus refusés", () => {
  assert.equal(prepareInstance(["codir", "board"], "board"), "board");
  assert.equal(prepareInstance(["codir", "board"], "inventee"), "codir");
  assert.equal(prepareInstance(["codir", "board"], null), "codir");
  assert.equal(prepareInstance([], "codir"), null);
  assert.equal(isPrepareChoice("stop"), true);
  assert.equal(isPrepareChoice("delete"), false);
});

test("« Préparer » : à décider en lot seulement sans année visée, depuis l'année précédente, et pas déjà arrêté", () => {
  const row = { nextId: null, sourceId: "e26", sourceYear: 2026, decision: null };
  assert.equal(toPrepare(row, 2027), true);
  assert.equal(toPrepare({ ...row, decision: "renew" }, 2027), true);
  assert.equal(toPrepare({ ...row, decision: "stop" }, 2027), false);
  assert.equal(toPrepare({ ...row, nextId: "e27" }, 2027), false);
  assert.equal(toPrepare({ ...row, sourceYear: 2025 }, 2027), false);
  assert.equal(toPrepare({ ...row, sourceId: null, sourceYear: null }, 2027), false);
});
