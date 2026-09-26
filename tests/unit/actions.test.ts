import { test } from "node:test";
import assert from "node:assert/strict";
import { runsIn, defaultPeriod, validPeriod, spanLabel, yearsOf, toRenew, shiftYear, propagationTargets, fundingOverflow, actionAlerts, balance } from "../../lib/actions";

const P = (a: string, b: string) => ({ startDate: new Date(a), endDate: new Date(b) });

test("une action apparaît dans chaque année que sa période touche", () => {
  const o2r = P("2025-01-01", "2027-11-30");
  assert.deepEqual([2024, 2025, 2026, 2027, 2028].map((y) => runsIn(o2r, y)), [false, true, true, true, false]);
  assert.equal(runsIn(P("2026-11-01", "2027-03-31"), 2027), true);
  assert.equal(runsIn(P("2026-12-31", "2026-12-31"), 2026), true);
  assert.deepEqual(yearsOf(o2r), [2025, 2026, 2027]);
});

test("période par défaut, validation, libellé de débordement", () => {
  assert.deepEqual(defaultPeriod(2026), P("2026-01-01", "2026-12-31"));
  assert.equal(validPeriod(new Date("2026-05-01"), new Date("2026-04-01")), "La fin précède le début.");
  assert.equal(validPeriod(new Date("2026-05-01"), new Date("2026-05-01")), null);
  assert.equal(spanLabel(P("2025-01-01", "2027-11-30"), 2026), "depuis 2025 · jusqu'en 2027");
  assert.equal(spanLabel(P("2026-02-01", "2026-06-30"), 2026), null);
  assert.equal(spanLabel(P("2026-02-01", "2027-06-30"), 2026), "jusqu'en 2027");
});

test("reconduction : on propose les actions qui finissent dans l'année, pas celles qui continuent ni les abandonnées", () => {
  const a = [{ id: "fin", ...P("2026-01-01", "2026-12-31"), state: "done" }, { id: "continue", ...P("2026-01-01", "2027-06-30"), state: "doing" }, { id: "abandon", ...P("2026-01-01", "2026-12-31"), state: "abandoned" }];
  assert.deepEqual(toRenew(a, 2026).map((x) => x.id), ["fin"]);
  assert.deepEqual(shiftYear(P("2026-03-01", "2026-06-30")), P("2027-03-01", "2027-06-30"));
});

test("un lien vers un dossier pluriannuel s'étend aux années couvertes du même projet", () => {
  const lines = [
    { id: "l26", conventionId: "ademe", editionYear: 2026, projectId: "p" },
    { id: "l27", conventionId: "ademe", editionYear: 2027, projectId: "p" },
    { id: "l28", conventionId: "ademe", editionYear: 2028, projectId: "p" },
    { id: "autre", conventionId: "ademe", editionYear: 2027, projectId: "q" },
  ];
  assert.deepEqual(propagationTargets({ projectId: "p", ...P("2026-01-01", "2027-12-31") }, lines, "ademe"), ["l26", "l27"]);
});

test("somme des montants face à l'obtenu", () => {
  assert.equal(fundingOverflow({ amountGranted: 10_000, amountRequested: 12_000 }, [6_000, 5_000]), 1_000);
  assert.equal(fundingOverflow({ amountGranted: null, amountRequested: 12_000 }, [6_000, null]), null);
  assert.equal(fundingOverflow({ amountGranted: null, amountRequested: null }, [6_000]), null);
});

test("alertes d'une action", () => {
  const today = new Date("2026-06-15");
  const k = (x: ReturnType<typeof actionAlerts>) => x.map((a) => a.kind);
  assert.deepEqual(k(actionAlerts({ name: "Forum", state: "doing", endDate: new Date("2026-12-31"), timeTarget: 10, hours: 12, milestones: [{ date: new Date("2026-06-01"), done: false, label: "Lancement" }] }, today)), ["milestone_overdue", "time_over"]);
  assert.deepEqual(k(actionAlerts({ name: "Note", state: "doing", endDate: new Date("2026-05-31"), timeTarget: null, hours: 0, milestones: [] }, today)), ["action_overdue"]);
  assert.deepEqual(k(actionAlerts({ name: "Vieille", state: "abandoned", endDate: new Date("2026-05-31"), timeTarget: null, hours: 0, milestones: [{ date: new Date("2026-01-01"), done: false, label: "x" }] }, today)), []);
});

test("alertes : comparaison par jour, pas par horodatage (jalon ou fin datés d'aujourd'hui ne sont pas en retard)", () => {
  const today = new Date("2026-06-15");
  assert.deepEqual(actionAlerts({ name: "Jalon du jour", state: "doing", endDate: new Date("2026-12-31"), timeTarget: null, hours: 0, milestones: [{ date: new Date("2026-06-15"), done: false, label: "x" }] }, today), []);
  assert.deepEqual(actionAlerts({ name: "Fin du jour", state: "doing", endDate: new Date("2026-06-15"), timeTarget: null, hours: 0, milestones: [] }, today), []);
});

test("équilibre d'une action : l'engagé ne double pas le réalisé rattaché (même règle que lib/budget.ts)", () => {
  // committed peut déjà inclure le facturé (spent) : la dépense pèse pour max(committed, spent), jamais la somme des deux
  // (lib/budget.ts, budgetOf : réalisé + engagements restants = spent + max(0, committed - spent)).
  assert.deepEqual(balance({ fundings: [12_000, null, 3_000], expenses: [{ committed: 1_000, spent: 4_000 }], hours: 100, hourlyCost: 30 }), { income: 15_000, spending: 4_000, timeCost: 3_000, gap: 8_000 });
  assert.equal(balance({ fundings: [10_000], expenses: [{ committed: 6_000, spent: 2_000 }], hours: 0, hourlyCost: null }).spending, 6_000);
  assert.equal(balance({ fundings: [], expenses: [], hours: 10, hourlyCost: null }).timeCost, null);
});
