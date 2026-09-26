import { test } from "node:test";
import assert from "node:assert/strict";
import { fundedActionsCsv, hiddenPeopleLabel, splitHours, type FundedAction } from "../../lib/funded-actions";

const P = (id: string, name: string, poleId: string | null = "p1") => ({ id, name, poleId });

test("les heures d'une personne non visible ne sortent qu'agrégées (compte et somme), jamais son nom", () => {
  const r = splitHours([{ person: P("a", "Alice"), hours: 3 }, { person: P("b", "Bruno", "p2"), hours: 5 }, { person: P("c", "Chloé", "p2"), hours: 2 }], (p) => p.poleId === "p1");
  assert.equal(r.totalHours, 10);
  assert.deepEqual(r.visible, [{ person: { id: "a", name: "Alice" }, hours: 3 }]);
  assert.deepEqual(r.hidden, { count: 2, hours: 7 });
  assert.ok(!JSON.stringify(r).includes("Bruno"));
  assert.equal(hiddenPeopleLabel(1), "1 autre personne : détail non visible");
  assert.equal(hiddenPeopleLabel(2), "2 autres personnes : détail non visible");
});

const F = (over: Partial<FundedAction>): FundedAction => ({
  lineId: "l", year: 2026, amount: null, action: { id: "x", name: "Atelier", projectName: "Projet" }, totalHours: 0, visible: [], hidden: { count: 0, hours: 0 }, milestonesDone: 0, achievements: 0, ...over,
});

test("CSV : en-tête fixe, une ligne par personne, montant sur la première seulement, action sans heure gardée, formules neutralisées", () => {
  const csv = fundedActionsCsv([
    F({ action: { id: "1", name: "=HYPERLINK(\"x\")", projectName: "+Projet" }, amount: 1200, totalHours: 12.5, visible: [{ person: { id: "a", name: "@Alice" }, hours: 10 }], hidden: { count: 1, hours: 2.5 } }),
    F({ action: { id: "2", name: "Bilan", projectName: "Projet" }, amount: null }),
  ]).split("\n");
  assert.equal(csv[0], "projet;action;personne;heures;montant");
  assert.equal(csv[1], `'+Projet;"'=HYPERLINK(""x"")";'@Alice;10,00;1200`);
  assert.equal(csv[2], `'+Projet;"'=HYPERLINK(""x"")";1 autre personne : détail non visible;2,50;`);
  assert.equal(csv[3], "Projet;Bilan;;0,00;");
  assert.equal(csv.length, 4);
});
