import { test } from "node:test";
import assert from "node:assert/strict";
import { actionRights, canEditAction } from "../../lib/rights";
import { parseDay, periodIncluding } from "../../lib/actions";

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

test("moindre privilège : l'associé modifie, ne gère pas la liste, ne supprime pas ; le responsable gère la liste sans supprimer", () => {
  const base = { isPilot: false, isTeamOfCoveredYear: false, samePole: false, isOwner: false, isAssociate: false };
  assert.deepEqual(actionRights(actor([]), { ...base, isAssociate: true }), { edit: true, managePeople: false, delete: false });
  assert.deepEqual(actionRights(actor([]), { ...base, isOwner: true }), { edit: true, managePeople: true, delete: false });
  assert.deepEqual(actionRights(actor(["edition.contribute"]), { ...base, isTeamOfCoveredYear: true }), { edit: true, managePeople: true, delete: true });
  assert.deepEqual(actionRights(actor([]), { ...base, isPilot: true }), { edit: true, managePeople: true, delete: true });
  assert.deepEqual(actionRights(actor(["pole.manage"]), { ...base, samePole: true }), { edit: true, managePeople: true, delete: true });
  assert.deepEqual(actionRights(actor(["edition.contribute"]), base), { edit: false, managePeople: false, delete: false });
});

test("un jalon hors de la période l'étend ; dedans, la période ne bouge pas", () => {
  const p = { startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") };
  assert.deepEqual(periodIncluding(p, new Date("2026-06-15")), p);
  assert.deepEqual(periodIncluding(p, new Date("2027-03-01")), { startDate: p.startDate, endDate: new Date("2027-03-01") });
  assert.deepEqual(periodIncluding(p, new Date("2025-11-20")), { startDate: new Date("2025-11-20"), endDate: p.endDate });
  assert.deepEqual(periodIncluding(p, new Date("2026-12-31")), p);
});
