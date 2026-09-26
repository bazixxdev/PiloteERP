import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatrix, type MatrixEdition, type MatrixLine } from "../../lib/matrix";

// Projets internes (spec actions § 2) : jamais signalés « sans financement » ; absents de la matrice tant qu'ils n'ont
// aucune ligne, une ligne de financement les fait apparaître comme n'importe quel projet.

function edition(id: string, kind: string, fundingLines: MatrixLine[] = []): MatrixEdition {
  return {
    id, year: 2026, status: "in_progress", budgetEnvelope: null, fundingLines,
    project: { id: `p-${id}`, name: `Projet ${id}`, analyticCode: `COD-${id}`, poleId: "pole1", kind, pole: { name: "Pôle 1" }, pilot: { name: "Alix" } },
  };
}

const line: MatrixLine = { id: "l1", funderId: "f1", status: "confirmed", amountGranted: 1000, amountRequested: null, conventionId: null, deliverables: [] };
const funders = [{ id: "f1", name: "Financeur" }];

test("matrice : un projet interne sans ligne n'est ni une ligne ni un orphelin", () => {
  const m = buildMatrix(2026, [edition("interne", "internal")], [], []);
  assert.equal(m.rows.length, 0);
  assert.equal(m.attention.orphans.length, 0);
});

test("matrice : un projet interne avec une ligne est une ligne comme les autres", () => {
  const m = buildMatrix(2026, [edition("interne", "internal", [line])], funders, []);
  assert.equal(m.rows.length, 1);
  assert.equal(m.rows[0].orphan, false);
  assert.equal(m.attention.orphans.length, 0);
});

test("matrice : un projet financé sans ligne reste un orphelin (comportement inchangé)", () => {
  const m = buildMatrix(2026, [edition("finance", "funded")], [], []);
  assert.equal(m.rows.length, 1);
  assert.equal(m.rows[0].orphan, true);
  assert.equal(m.attention.orphans.length, 1);
});
