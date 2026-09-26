import { test } from "node:test";
import assert from "node:assert/strict";
import { allocationCheck, allocationOf, conventionCovers, reusableLine } from "../../lib/conventions";

// Financements pluriannuels (question de Gaël, 26/09) : un dossier sur une seule année ne suit pas le projet l'année
// suivante (la ligne reconduite repart « à déposer ») ; un dossier sur plusieurs années reste rattaché et plafonne ses affectations.

test("un dossier annuel ne couvre que son année ; un dossier 2026-2028 couvre les trois", () => {
  const annuel = { startYear: 2026, endYear: 2026 };
  assert.equal(conventionCovers(annuel, 2026), true);
  assert.equal(conventionCovers(annuel, 2027), false);
  const triennal = { startYear: 2026, endYear: 2028 };
  assert.deepEqual([2025, 2026, 2027, 2028, 2029].map((y) => conventionCovers(triennal, y)), [false, true, true, true, false]);
});

test("les affectations d'un dossier pluriannuel sont plafonnées au notifié, le reste à répartir est calculé", () => {
  const c = { amountNotified: 90_000, amountRequested: 90_000, lines: [{ id: "a2026", amountGranted: 30_000, amountRequested: 30_000 }, { id: "a2027", amountGranted: 30_000, amountRequested: 30_000 }, { id: "a2028", amountGranted: null, amountRequested: 30_000 }] };
  assert.deepEqual(allocationOf(c), { granted: 60_000, requested: 90_000, ceiling: 90_000, remaining: 30_000, over: false });
  assert.deepEqual(allocationCheck(c, "a2028", 30_000), { ok: true });
  const refused = allocationCheck(c, "a2028", 35_000);
  assert.equal(refused.ok, false);
  // Modifier une affectation existante ne compte pas son ancien montant : 30 000 (2027) + 60 000 = 90 000, accepté ; 61 000, refusé.
  assert.deepEqual(allocationCheck(c, "a2026", 60_000), { ok: true });
  assert.equal(allocationCheck(c, "a2026", 61_000).ok, false);
});

test("sans montant notifié, rien n'est plafonné", () => {
  const c = { amountNotified: null, amountRequested: 50_000, lines: [{ id: "x", amountGranted: 80_000, amountRequested: 50_000 }] };
  assert.deepEqual(allocationCheck(c, "x", 80_000), { ok: true });
  assert.equal(allocationOf(c).remaining, null);
});

// Doublon du 26/09 : reconduire 2026 → 2027 recrée une ligne ADEME « à déposer » hors dossier ; rattacher ensuite l'année au
// dossier ADEME 2027 doit reprendre cette ligne, pas en créer une seconde.
test("rattacher une année à un dossier reprend sa ligne libre du même financeur", () => {
  const ademe = { id: "l1", funderId: "ademe", conventionId: null };
  assert.equal(reusableLine([ademe, { id: "l2", funderId: "region", conventionId: null }], "ademe"), ademe);
  // Déjà rattachée à un autre dossier : pas libre.
  assert.equal(reusableLine([{ id: "l3", funderId: "ademe", conventionId: "fse" }], "ademe"), null);
  // Deux lignes libres du même financeur : on ne devine pas.
  assert.equal(reusableLine([ademe, { id: "l4", funderId: "ademe", conventionId: null }], "ademe"), null);
  assert.equal(reusableLine([], "ademe"), null);
});
