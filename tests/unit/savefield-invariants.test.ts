import assert from "node:assert/strict";
import { test } from "node:test";
import { FIELDS } from "../../lib/fields";

test("l'état du matériel passe par l'action métier et n'est plus éditable via saveField", () => {
  assert.equal(FIELDS.equipment.state, undefined);
  assert.ok(FIELDS.equipment.notes);
});

// Appels à projets (feat/appels-dossiers) : les champs structurants passent par saveField, avec les invariants d'addCall.
import { callFieldInvariant } from "../../lib/calls";

test("un appel modifié champ par champ garde les invariants de la création", () => {
  const open = { conventionId: null };
  assert.equal(callFieldInvariant("amountKind", "annual", open), null);
  assert.ok(callFieldInvariant("amountKind", "monthly", open));
  assert.equal(callFieldInvariant("durationYears", 2, open), null);
  assert.equal(callFieldInvariant("durationYears", null, open), null);
  assert.ok(callFieldInvariant("durationYears", 0, open));
  assert.ok(callFieldInvariant("durationYears", 1.5, open));
  assert.ok(callFieldInvariant("amountValue", -1, open));
  assert.equal(callFieldInvariant("funderId", "f2", open), null);
  assert.ok(callFieldInvariant("funderId", "f2", { conventionId: "c1" }));
  assert.equal(callFieldInvariant("label", "x", { conventionId: "c1" }), null);
});
