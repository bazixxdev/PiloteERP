import test from "node:test";
import assert from "node:assert/strict";
import { canAcceptProposedField } from "@/lib/proposal-permissions";

const pilot = {
  id: "pilot",
  role: "pilot",
  permissions: ["edition.contribute"] as const,
  validationLevel: 1,
  poleId: "pole-a",
};

const raf = {
  ...pilot,
  id: "raf",
  role: "raf",
  permissions: ["fiche.budget"] as const,
};

test("une proposition budgétaire exige la permission fiche.budget", () => {
  assert.equal(canAcceptProposedField(pilot, "budgetEnvelope"), false);
  assert.equal(canAcceptProposedField(pilot, "spent"), false);
  assert.equal(canAcceptProposedField(raf, "budgetEnvelope"), true);
});

test("les propositions ordinaires conservent le workflow existant", () => {
  assert.equal(canAcceptProposedField(pilot, "operationalObjectives"), true);
  assert.equal(canAcceptProposedField(pilot, "unknownField"), false);
});
