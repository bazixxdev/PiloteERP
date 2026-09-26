import { test } from "node:test";
import assert from "node:assert/strict";
import { canEditAction } from "../../lib/rights";
import { parseDay } from "../../lib/actions";

// Même forme d'acteur que les autres tests de droits (lib/roles.ts, Actor) : rôle, permissions, niveau de validation.
const actor = (permissions: string[]) => ({ id: "me", role: "pilot", permissions, validationLevel: 0, poleId: "pole-a" });

test("modifie une action : l'équipe d'une année couverte, le pilote, le responsable ou un associé ; pas un tiers", () => {
  const base = { isPilot: false, isTeamOfCoveredYear: false, samePole: false, isOwnerOrAssociate: false };
  assert.equal(canEditAction(actor(["edition.contribute"]), { ...base, isTeamOfCoveredYear: true }), true);
  assert.equal(canEditAction(actor([]), { ...base, isOwnerOrAssociate: true }), true);
  assert.equal(canEditAction(actor([]), { ...base, isPilot: true }), true);
  assert.equal(canEditAction(actor(["edition.contribute"]), base), false);
});

test("droits sur une action : le responsable de pôle sur son pôle seulement, la direction partout, l'équipe sans droit de contribuer non", () => {
  const base = { isPilot: false, isTeamOfCoveredYear: false, samePole: false, isOwnerOrAssociate: false };
  assert.equal(canEditAction(actor(["pole.manage"]), { ...base, samePole: true }), true);
  assert.equal(canEditAction(actor(["pole.manage"]), base), false);
  assert.equal(canEditAction(actor(["edition.edit_all"]), base), true);
  assert.equal(canEditAction(actor([]), { ...base, isTeamOfCoveredYear: true }), false);
});

test("un jour saisi se lit à minuit UTC ; un texte qui n'est pas un jour est refusé", () => {
  assert.equal(parseDay("2026-03-01")?.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(parseDay("2026-02-30"), null);
  assert.equal(parseDay("2026-3-1"), null);
  assert.equal(parseDay(""), null);
  assert.equal(parseDay("2026-03-01T12:00:00Z"), null);
});
