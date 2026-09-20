import test from "node:test";
import assert from "node:assert/strict";
import { requiredLevelFor, canDecideValidation } from "@/lib/rights";

const edition = { project: { pilotId: "pilot", poleId: "pole-a", secondaryPoles: [] } };
const actor = (id: string, validationLevel: number, poleId: string | null = "pole-a") => ({ id, role: "test", permissions: [], validationLevel, poleId });

test("le niveau serveur reste borné à 1..3 selon les seuils", () => {
  const settings = { validationThresholdLevel1: 100, validationThresholdLevel2: 1000 };
  assert.equal(requiredLevelFor(50, settings, 5000), 1);
  assert.equal(requiredLevelFor(1001, settings, 5000), 3);
  assert.equal(requiredLevelFor(50, settings, 20), 3);
});

test("un niveau invalide ou nul ne peut jamais être décidé", () => {
  const decider = actor("decider", 3);
  assert.equal(canDecideValidation(decider, { requiredLevel: 0, requesterId: "pilot", edition }), false);
  assert.equal(canDecideValidation(decider, { requiredLevel: -1, requesterId: "pilot", edition }), false);
  assert.equal(canDecideValidation(decider, { requiredLevel: 4, requesterId: "pilot", edition }), false);
  assert.equal(canDecideValidation(actor("decider", 0), { requiredLevel: 1, requesterId: "pilot", edition }), false);
});
