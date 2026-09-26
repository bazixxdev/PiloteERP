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

// Dépenses et indicateurs rattachés à une action (26/09) : saveField n'accepte qu'une action du même projet qui court l'année.
import { attachOptions, attachRefusal, attachable, openForWork } from "../../lib/actions";

test("une dépense ou un indicateur ne se rattache qu'à une action du projet qui court l'année", () => {
  const year = { projectId: "p1", year: 2026 };
  const run = (projectId: string | null, start: string, end: string, state = "doing") => ({ id: "a1", projectId, startDate: new Date(start), endDate: new Date(end), state });
  // Action d'un autre projet : refus, même si sa période couvre l'année.
  assert.equal(attachRefusal(run("p2", "2026-01-01", "2026-12-31"), year), "project");
  // Même projet, mais la période ne touche pas l'année : refus.
  assert.equal(attachRefusal(run("p1", "2025-01-01", "2025-12-31"), year), "year");
  assert.equal(attachRefusal(run("p1", "2027-01-01", "2027-06-30"), year), "year");
  assert.equal(attachRefusal({ id: "a1", projectId: "p1", startDate: null, endDate: null, state: "doing" }, year), "year");
  // Action introuvable : refus.
  assert.equal(attachRefusal(null, year), "missing");
  // Même projet, période qui chevauche l'année (y compris pluriannuelle) : accepté.
  assert.equal(attachRefusal(run("p1", "2026-03-01", "2026-06-30"), year), null);
  assert.equal(attachRefusal(run("p1", "2025-09-01", "2027-06-30"), year), null);
  // Abandonnée : refusée partout ; terminée : refusée pour une tâche seulement.
  const ok = "2026-01-01", end = "2026-12-31";
  assert.equal(attachRefusal(run("p1", ok, end, "abandoned"), year), "state");
  assert.equal(attachRefusal(run("p1", ok, end, "abandoned"), year, { use: "task" }), "state");
  assert.equal(attachRefusal(run("p1", ok, end, "done"), year), null);
  assert.equal(attachRefusal(run("p1", ok, end, "done"), year, { use: "task" }), "state");
  // La valeur actuelle, réenregistrée telle quelle, passe toujours (attachOptions la propose) — pas une autre.
  assert.equal(attachRefusal(run("p1", ok, end, "abandoned"), year, { current: "a1" }), null);
  assert.equal(attachRefusal(run("p1", ok, end, "done"), year, { use: "task", current: "a1" }), null);
  assert.equal(attachRefusal(run("p1", "2025-01-01", "2025-06-30"), year, { current: "a1" }), null);
  assert.equal(attachRefusal(run("p1", ok, end, "abandoned"), year, { current: "autre" }), "state");
  // Le champ est bien ouvert à saveField sur les deux modèles (et nulle part ailleurs dans ce lot).
  assert.ok(FIELDS.expense.actionId);
  assert.ok(FIELDS.indicator.actionId);
});

test("sélecteurs d'action : une abandonnée n'est jamais proposée, une terminée l'est pour rattacher, pas pour une tâche", () => {
  assert.deepEqual(["todo", "doing", "done", "abandoned"].map((state) => openForWork({ state })), [true, true, false, false]);
  assert.deepEqual(["todo", "doing", "done", "abandoned"].map((state) => attachable({ state })), [true, true, true, false]);
});

test("sélecteur d'une dépense ou d'un indicateur : les rattachables, plus l'actuelle si elle n'en est plus", () => {
  const actions = [{ id: "a", name: "A", state: "doing" }, { id: "b", name: "B", state: "abandoned" }, { id: "c", name: "C", state: "done" }];
  assert.deepEqual(attachOptions(actions, null).map((o) => o.value), ["a", "c"]);
  assert.deepEqual(attachOptions(actions, { id: "b", name: "B" }).map((o) => o.value), ["a", "c", "b"]);
  assert.deepEqual(attachOptions(actions, { id: "a", name: "A" }).map((o) => o.value), ["a", "c"]);
  assert.deepEqual(attachOptions(actions, { id: "z", name: "Z" }).map((o) => o.value), ["a", "c", "z"]);
});
