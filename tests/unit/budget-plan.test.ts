import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetTable, canPlanBudget, canSeePersonnelDetail, canValidateBudget, classifyAccount, ledgerByCategory, monthlyCost, nextStatusAfterEdit, overBudget, personnelActual, type Category } from "../../lib/budget-plan";

const cat = (id: string, prefixes: string, source: Category["source"] = "ledger", order = 0): Category => ({ id, label: id, accountPrefixes: prefixes, source, order, active: true });
const CATS = [cat("personnel", "64", "time", 1), cat("prestations", "604,611,622", "ledger", 3), cat("achats", "606", "ledger", 4), cat("autre", "6", "ledger", 9), cat("indirects", "", "none", 2)];

test("un compte va à la catégorie au préfixe le plus long ; les produits et l'inconnu sont écartés", () => {
  assert.equal(classifyAccount("6063", CATS)?.id, "achats");
  assert.equal(classifyAccount("6226", CATS)?.id, "prestations");
  assert.equal(classifyAccount("6512", CATS)?.id, "autre");
  assert.equal(classifyAccount("7061", CATS), null);
  assert.equal(classifyAccount("6411", CATS)?.id, "personnel");
});

test("le grand livre ne nourrit que les catégories « ledger » ; le reste va en non classé", () => {
  const r = ledgerByCategory([{ accountNumber: "6063", amount: 100 }, { accountNumber: "6411", amount: 900 }, { accountNumber: "6226", amount: 50 }], CATS.filter((c) => c.id !== "autre"));
  assert.equal(r.byCategory.get("achats"), 100);
  assert.equal(r.byCategory.get("prestations"), 50);
  assert.equal(r.byCategory.get("personnel"), undefined); // Personnel se lit dans le temps, pas dans le 64
  assert.equal(r.unclassified, 0);
  const r2 = ledgerByCategory([{ accountNumber: "6512", amount: 30 }], [cat("achats", "606")]);
  assert.equal(r2.unclassified, 30);
});

test("coût mensuel d'une personne : règle RH active ce mois, convertie en mensuel", () => {
  const rules = [
    { personId: "p1", amount: 3000, period: "monthly", startMonth: "2026-01", endMonth: "2026-06", active: true, kind: "hr" },
    { personId: "p1", amount: 3300, period: "monthly", startMonth: "2026-07", endMonth: null, active: true, kind: "hr" },
    { personId: "p2", amount: 12000, period: "quarterly", startMonth: "2026-01", endMonth: null, active: true, kind: "hr" },
    { personId: "p3", amount: 2000, period: "monthly", startMonth: "2026-01", endMonth: null, active: false, kind: "hr" },
  ];
  assert.equal(monthlyCost("p1", "2026-03", rules), 3000);
  assert.equal(monthlyCost("p1", "2026-09", rules), 3300);
  assert.equal(monthlyCost("p2", "2026-02", rules), 4000);
  assert.equal(monthlyCost("p3", "2026-02", rules), null);
  assert.equal(monthlyCost("p9", "2026-02", rules), null);
});

test("le temps se valorise au coût du mois ; une heure sans coût est comptée et signalée, jamais valorisée", () => {
  const cost = (p: string, m: string) => (p === "p1" ? (m === "2026-01" ? 20 : 25) : null);
  const r = personnelActual([{ personId: "p1", month: "2026-01", hours: 10 }, { personId: "p1", month: "2026-02", hours: 4 }, { personId: "p2", month: "2026-01", hours: 3 }], cost);
  assert.equal(r.amount, 300);
  assert.equal(r.hours, 17);
  assert.deepEqual(r.unvalued, [{ personId: "p2", hours: 3 }]);
  assert.deepEqual(r.byPerson.find((x) => x.personId === "p1"), { personId: "p1", hours: 14, amount: 300 });
});

test("tableau : la surcharge l'emporte, l'engagé s'ajoute, l'écart et le pourcentage suivent", () => {
  const t = budgetTable({
    categories: CATS,
    lines: [{ categoryId: "personnel", amount: 40000 }, { categoryId: "achats", amount: 1000 }, { categoryId: "achats", amount: 500 }],
    computed: new Map([["personnel", 27000], ["achats", 900]]),
    overrides: [{ categoryId: "personnel", amount: 30000, reason: "paie de septembre" }],
    engaged: new Map([["achats", 800]]),
    unclassified: 12,
  });
  const p = t.rows.find((r) => r.categoryId === "personnel")!;
  assert.equal(p.actual, 30000);
  assert.equal(p.computed, 27000);
  assert.equal(p.gap, 10000);
  const a = t.rows.find((r) => r.categoryId === "achats")!;
  assert.equal(a.planned, 1500);
  assert.equal(a.gap, -200);
  assert.equal(a.pct, 113);
  assert.equal(t.unclassified, 12);
  assert.deepEqual(overBudget(t.rows).map((r) => r.categoryId), ["achats"]);
  assert.equal(t.rows.find((r) => r.categoryId === "indirects")!.pct, null); // rien de prévu : pas de pourcentage
});

test("droits : préparer sur ses éditions (pilote, équipe, pôle pour qui le gère) ou partout avec scope.all", () => {
  const base = { id: "me", poleId: "A", role: "pilot", validationLevel: 1 };
  const ed = { pilotId: "other", poleIds: ["B"], teamIds: [] as string[] };
  assert.equal(canPlanBudget({ ...base, permissions: ["edition.contribute"] }, { ...ed, pilotId: "me" }), false); // pas le droit budget.plan
  assert.equal(canPlanBudget({ ...base, permissions: ["budget.plan"] }, { ...ed, pilotId: "me" }), true);
  assert.equal(canPlanBudget({ ...base, permissions: ["budget.plan"] }, { ...ed, teamIds: ["me"] }), true);
  assert.equal(canPlanBudget({ ...base, permissions: ["budget.plan"] }, ed), false); // autre pôle, ni pilote ni équipe
  assert.equal(canPlanBudget({ ...base, permissions: ["budget.plan", "pole.manage"] }, { ...ed, poleIds: ["A"] }), true);
  assert.equal(canPlanBudget({ ...base, permissions: ["budget.plan", "scope.all"] }, ed), true);
  assert.equal(canValidateBudget({ ...base, permissions: ["budget.plan"] }), false);
  assert.equal(canValidateBudget({ ...base, permissions: ["budget.validate"] }), true);
  assert.equal(canSeePersonnelDetail({ ...base, permissions: ["budget.plan"] }), false);
  assert.equal(canSeePersonnelDetail({ ...base, permissions: ["treasury.view"] }), true);
});

test("modifier un budget validé le repasse à valider, sauf pour qui valide", () => {
  const me = { role: "pilot", validationLevel: 1 };
  assert.equal(nextStatusAfterEdit("validated", { ...me, permissions: ["budget.plan"] }), "submitted");
  assert.equal(nextStatusAfterEdit("validated", { ...me, permissions: ["budget.plan", "budget.validate"] }), "validated");
  assert.equal(nextStatusAfterEdit("draft", { ...me, permissions: ["budget.plan"] }), "draft");
});
