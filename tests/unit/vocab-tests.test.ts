import { test } from "node:test";
import assert from "node:assert/strict";
import { W, cap, pl, aucun } from "../vocab";

test("les mots des tests viennent de la configuration de l'instance", () => {
  assert.equal(`Portefeuille des ${pl(W.projet)}`, "Portefeuille des projets");
  assert.match(cap(aucun(W.edition)), /^Aucun/);
  assert.ok(W.sponsor.one.length > 0);
});
