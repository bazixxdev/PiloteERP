import assert from "node:assert/strict";
import { test } from "node:test";
import { canReadDelegation, canWriteDelegation, dueInPeriod, objectiveInPeriod, periodFor, periodsOf } from "../../lib/delegation";

const d = (s: string) => new Date(`${s}T12:00:00`);

test("les périodes viennent du réglage, suivies de toute l'année ; bornes au premier et au dernier jour", () => {
  const ps = periodsOf("01-06,07-08,09-12", 2026);
  assert.deepEqual(ps.map((p) => p.key), ["01-06", "07-08", "09-12", "annee"]);
  assert.equal(ps[1].label, "juillet – août");
  assert.equal(ps[2].from.getMonth(), 8);
  assert.equal(ps[2].to.getMonth(), 11);
  assert.equal(ps[2].to.getDate(), 31);
  assert.equal(ps[3].label, "toute l'année");
  // Un réglage abîmé ne casse rien : il reste l'année.
  assert.deepEqual(periodsOf("n'importe quoi", 2026).map((p) => p.key), ["annee"]);
});

test("la période par défaut est celle qui contient aujourd'hui, sinon l'année", () => {
  const ps = periodsOf("01-06,07-08,09-12", 2026);
  assert.equal(periodFor(undefined, ps, d("2026-09-25")).key, "09-12");
  assert.equal(periodFor("07-08", ps, d("2026-09-25")).key, "07-08");
  assert.equal(periodFor("zz", ps, d("2026-09-25")).key, "09-12");
  assert.equal(periodFor(undefined, ps, d("2027-02-01")).key, "annee");
});

test("un objectif tombe dans une période par son échéance ; sans échéance, tant qu'il n'est pas terminé ; en cours, s'il déborde", () => {
  const p = periodsOf("09-12", 2026)[0];
  assert.equal(objectiveInPeriod({ milestoneDate: d("2026-10-15"), state: "todo" }, p), true);
  assert.equal(objectiveInPeriod({ milestoneDate: d("2026-03-15"), state: "done" }, p), false);
  assert.equal(objectiveInPeriod({ milestoneDate: d("2026-03-15"), state: "late" }, p), true); // en retard : toujours à l'ordre du jour
  assert.equal(objectiveInPeriod({ milestoneDate: null, state: "todo" }, p), true);
  assert.equal(objectiveInPeriod({ milestoneDate: null, state: "done" }, p), false);
  assert.equal(objectiveInPeriod({ milestoneDate: d("2027-02-01"), state: "doing" }, p), true);
  assert.equal(objectiveInPeriod({ milestoneDate: d("2027-02-01"), state: "todo" }, p), false);
  assert.equal(dueInPeriod(d("2026-12-31"), p), true);
  assert.equal(dueInPeriod(d("2027-01-01"), p), false);
});

test("droits : la personne elle-même, qui lit tout, qui rédige sur son pôle", () => {
  const base = { id: "me", poleId: "A", role: "pilot", validationLevel: 1 };
  const deleg = { personId: "thomas", poleIds: ["A"] };
  assert.equal(canReadDelegation({ ...base, id: "thomas", permissions: [] }, deleg), true);
  assert.equal(canReadDelegation({ ...base, permissions: [] }, deleg), false);
  assert.equal(canReadDelegation({ ...base, permissions: ["delegation.view_all"] }, { ...deleg, poleIds: ["B"] }), true);
  assert.equal(canReadDelegation({ ...base, permissions: ["delegation.write"] }, deleg), true);
  assert.equal(canReadDelegation({ ...base, permissions: ["delegation.write"] }, { ...deleg, poleIds: ["B"] }), false);
  assert.equal(canWriteDelegation({ ...base, permissions: ["delegation.write", "scope.all"] }, ["B"]), true);
  assert.equal(canWriteDelegation({ ...base, permissions: ["delegation.view_all"] }, ["A"]), false);
});
