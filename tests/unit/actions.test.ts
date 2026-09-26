import { test } from "node:test";
import assert from "node:assert/strict";
import { runsIn, defaultPeriod, validPeriod, spanLabel, yearsOf, yearsLabel, toRenew, shiftYear, propagationTargets, fundingOverflow, actionAlerts, balance, milestoneTitle, withYearActions, editionForMilestone } from "../../lib/actions";
import { computeReminders, nextMilestone } from "../../lib/alerts";
import { deadlineKey } from "../../lib/deadline-notifications";
import { dayjs } from "../../lib/format";

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

test("reconduction : une action terminée dont la période court déjà sur l'année suivante n'est pas proposée (déjà là)", () => {
  const a = [{ id: "termine-mais-continue", ...P("2026-01-01", "2027-06-30"), state: "done" }];
  assert.deepEqual(toRenew(a, 2026).map((x) => x.id), []);
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

test("les actions d'une année : même projet, période qui chevauche l'année, heures de CETTE année", () => {
  const eds = [{ id: "e25", projectId: "p", year: 2025 }, { id: "e26", projectId: "p", year: 2026 }, { id: "x26", projectId: "autre", year: 2026 }];
  const acts = [
    { id: "long", projectId: "p", ...P("2025-09-01", "2026-06-30") },
    { id: "court", projectId: "p", ...P("2026-02-01", "2026-03-31") },
    { id: "orpheline", projectId: null, startDate: null, endDate: null },
  ];
  const byYear = new Map([[2025, new Map<string | null, number>([["long", 12]])], [2026, new Map<string | null, number>([["long", 30], ["court", 4]])]]);
  const total = new Map<string | null, number>([["long", 42], ["court", 4]]);
  const out = withYearActions(eds, acts, byYear, total);
  const view = (e: (typeof out)[number]) => e.actions.map((a) => [a.id, a.hoursYear, a.hoursTotal]);
  assert.deepEqual(view(out[0]), [["long", 12, 42]]);
  assert.deepEqual(view(out[1]), [["long", 30, 42], ["court", 4, 4]]);
  assert.deepEqual(view(out[2]), []);
});

test("un jalon se rattache à l'année de sa date, sinon à la première année couverte ; titres et années", () => {
  const a = { projectId: "p", ...P("2025-09-01", "2026-06-30") };
  const eds = [{ id: "e26", projectId: "p", year: 2026 }, { id: "e25", projectId: "p", year: 2025 }];
  assert.equal(editionForMilestone({ date: new Date("2026-03-15") }, a, eds)?.id, "e26");
  assert.equal(editionForMilestone({ date: new Date("2025-10-15") }, a, eds)?.id, "e25");
  assert.equal(editionForMilestone({ date: new Date("2027-01-15") }, a, eds)?.id, "e25");
  assert.equal(editionForMilestone({ date: new Date("2026-03-15") }, a, [{ id: "q", projectId: "autre", year: 2026 }]), null);
  assert.equal(milestoneTitle("Forum", "Forum"), "Forum");
  assert.equal(milestoneTitle("Forum", "Bilan"), "Forum · Bilan");
  assert.equal(yearsLabel(P("2025-09-01", "2026-06-30")), "2025–2026");
  assert.equal(yearsLabel(P("2026-01-01", "2026-12-31")), "2026");
});

// Relances : un rappel par jalon non fait, au responsable, aux associés et au pilote ; jamais deux pour une action pluriannuelle.
const day = (n: number) => dayjs().add(n, "day").startOf("day").toDate();
const edition = (id: string, year: number, actions: Parameters<typeof computeReminders>[0][number]["actions"]) => ({
  id, projectId: "p", year, budgetEnvelope: null, spent: 0, expenses: [], fundingLines: [], validations: [],
  project: { name: "Projet", pilot: { id: "pil", name: "Pilote Un" } }, actions,
});
const act = (milestones: { id: string; date: Date; done: boolean; label: string }[], over: Partial<Parameters<typeof computeReminders>[0][number]["actions"][number]> = {}) => ({
  id: "a", name: "Forum", state: "doing", projectId: "p", startDate: new Date(`${dayjs().year() - 1}-09-01`), endDate: new Date(`${dayjs().year() + 1}-06-30`), timeTarget: null,
  owner: { id: "own", name: "Resp Un" }, people: [{ person: { id: "ass", name: "Asso Un" } }], milestones, ...over,
});

test("relances : un jalon fait ne relance pas ; un jalon à venir relance le responsable, les associés et le pilote", () => {
  const eds = [edition("e", dayjs().year(), [act([{ id: "m1", date: day(5), done: true, label: "Lancement" }, { id: "m2", date: day(6), done: false, label: "Bilan" }])])];
  const r = computeReminders(eds, null, [30, 7], 60);
  assert.deepEqual(r.map((x) => [x.label, x.kind, x.whoIds]), [["Forum · Bilan", "milestone", ["own", "ass", "pil"]]]);
  assert.deepEqual(computeReminders([edition("e", dayjs().year(), [act([{ id: "m1", date: day(5), done: true, label: "x" }])])], null, [30, 7], 60), []);
  // Action terminée : ses jalons non cochés ne relancent plus.
  assert.deepEqual(computeReminders([edition("e", dayjs().year(), [act([{ id: "m1", date: day(5), done: false, label: "x" }], { state: "done" })])], null, [30, 7], 60), []);
  assert.deepEqual(nextMilestone(eds[0]), { name: "Forum · Bilan", date: day(6) });
});

test("relances : une action qui court sur deux années vivantes ne relance qu'une fois par jalon", () => {
  const a = act([{ id: "m", date: day(3), done: false, label: "Bilan" }]);
  const y = dayjs(day(3)).year();
  const r = computeReminders([edition("prev", y - 1, [a]), edition("cur", y, [a])], null, [30, 7], 60);
  assert.deepEqual(r.map((x) => [x.editionId, x.label]), [["cur", "Forum · Bilan"]]);
  // La clé de notification est celle du jalon : ni l'année où il est rangé, ni son titre n'y entrent.
  const key = deadlineKey(r[0]);
  assert.equal(key, `deadline:milestone:m:${dayjs(day(3)).format("YYYY-MM-DD")}:${r[0].stage}`);
  assert.equal(deadlineKey({ ...r[0], editionId: "prev", label: "Autre titre" }), key);
});
