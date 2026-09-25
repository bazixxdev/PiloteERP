# Budget prévisionnel par catégorie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saisir un budget prévisionnel par catégorie sur chaque édition et le comparer au réalisé (temps valorisé pour le Personnel, grand livre pour le reste), avec validation, surcharge manuelle motivée et alerte de dépassement.

**Architecture:** Calculs purs dans `lib/budget-plan.ts` (testés en unitaire), accès base et filtrage des salaires dans `lib/budget-plan-db.ts`, écritures par commandes dédiées dans `app/actions/budget-plan.ts` (jamais `saveField`), une section serveur + client dans l'onglet Budget de l'édition, un référentiel dans l'admin. Module d'instance `budget`.

**Tech Stack:** Next.js 15 (App Router, Server Actions), Prisma 6 / PostgreSQL 16, node:test (`npm run test:unit`), Playwright (`npm test`, `npm run test:security`).

**Spec:** `docs/superpowers/specs/2026-09-25-budget-previsionnel-design.md`

## Global Constraints

- Règles du dépôt : `AGENTS.md` + `.agents/rules/*.md` (lire `securite-autorisation.md` et `donnees-migrations.md` avant de coder).
- Migration « expand » seulement : aucune colonne existante renommée ni supprimée.
- Montants, statut et surcharge : **commandes dédiées**, jamais `saveField` ; `lib/fields.ts` n'est pas modifié (la sentinelle `tests/unit/guardrails.test.ts` doit rester verte sans être touchée).
- Tout texte affiché passe par `lib/vocab.ts` quand il contient un mot du vocabulaire (`npm run check:vocab`).
- Le détail Personnel par personne n'est **sérialisé** que pour `treasury.view` ou `budget.validate`.
- CSV par `csvCell` / `csvRow` (`lib/csv.ts`).
- `npm run check` vert avant chaque commit ; messages de commit en français terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Données de seed 100 % fictives.

---

## File Structure

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | 3 modèles, 3 champs sur `Edition`, 1 sur `Expense` |
| `prisma/migrations/20260925120000_budget_plan/migration.sql` | tables, colonnes, catégories par défaut, droits des rôles système |
| `lib/budget-plan.ts` | fonctions pures : classement des comptes, coût horaire, valorisation du temps, tableau d'écart, droits |
| `lib/budget-plan-db.ts` | chargement : lignes, surcharges, dépenses, grand livre, temps, règles RH, rythmes → tableau ; filtre des salaires |
| `app/actions/budget-plan.ts` | commandes (lignes, statut, surcharge, catégorie d'une dépense, référentiel) |
| `lib/permissions.ts` | droits `budget.plan`, `budget.validate` + rôles par défaut |
| `lib/modules.ts` | module d'instance `budget` |
| `lib/alerts.ts` | type d'alerte `budget_over` |
| `app/edition/[id]/budget-plan.tsx` | section serveur (tableau) |
| `app/edition/[id]/budget-plan-forms.tsx` | client : ajout / modification de ligne, statut, surcharge |
| `app/edition/[id]/page.tsx` | branche la section et l'alerte |
| `app/edition/[id]/budget.tsx` | sélecteur de catégorie sur les dépenses |
| `app/edition/[id]/budget-plan/export/route.ts` | export CSV |
| `app/admin/budget-categories.tsx` | référentiel des catégories |
| `app/conventions/[id]/page.tsx` | bloc lecture « Budget des projets financés » |
| `config/clients/tlst.ts`, `prisma/seeds/tlst.ts` | module actif + démo |
| `tests/unit/budget-plan.test.ts` | unitaires |
| `tests/security/sec-30-budget-salaires.spec.ts` + `tests/security/global-setup.ts` | salaires masqués |
| `tests/budget-previsionnel.spec.ts` | recette |

---

### Task 1: Schéma et migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260925120000_budget_plan/migration.sql`

**Interfaces:**
- Produces: modèles Prisma `BudgetCategory`, `BudgetLine`, `BudgetActualOverride` ; `Edition.budgetPlanStatus`, `Edition.budgetPlanValidatedAt`, `Edition.budgetPlanValidatedById` ; `Expense.budgetCategoryId`.

- [ ] **Step 1: Ajouter les modèles au schéma**

Dans `prisma/schema.prisma`, à la fin :

```prisma
// Budget prévisionnel (25/09) : grille commune de l'instance. Une catégorie utilisée se désactive, elle ne se supprime pas.
model BudgetCategory {
  id              String                 @id @default(cuid())
  label           String
  // Préfixes de comptes du grand livre classés ici, séparés par des virgules (« 64 », « 604,611,622 »). Le plus long l'emporte.
  accountPrefixes String                 @default("")
  source          String                 @default("ledger") // time (Personnel : temps valorisé) | ledger (grand livre) | none (forfait, surcharge manuelle)
  order           Int                    @default(0)
  active          Boolean                @default(true)
  lines           BudgetLine[]
  overrides       BudgetActualOverride[]
  expenses        Expense[]
}

// Le prévu d'une édition : plusieurs lignes possibles par catégorie.
model BudgetLine {
  id         String         @id @default(cuid())
  editionId  String
  edition    Edition        @relation(fields: [editionId], references: [id], onDelete: Cascade)
  categoryId String
  category   BudgetCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  label      String?
  amount     Float
  note       String?
  order      Int            @default(0)
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  @@index([editionId])
}

// Réalisé saisi à la main : remplace le calcul de la catégorie pour cette édition ; le calcul reste affiché à côté.
model BudgetActualOverride {
  id         String         @id @default(cuid())
  editionId  String
  edition    Edition        @relation(fields: [editionId], references: [id], onDelete: Cascade)
  categoryId String
  category   BudgetCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  amount     Float
  reason     String
  authorId   String
  author     Person         @relation("BudgetOverrideAuthor", fields: [authorId], references: [id])
  createdAt  DateTime       @default(now())

  @@unique([editionId, categoryId])
}
```

Dans `model Edition`, après `spent Float @default(0)` :

```prisma
  // Budget prévisionnel (25/09) : draft | submitted | validated ; changé par commandes dédiées (jamais saveField).
  budgetPlanStatus        String                 @default("draft")
  budgetPlanValidatedAt   DateTime?
  budgetPlanValidatedById String?
  budgetLines             BudgetLine[]
  budgetOverrides         BudgetActualOverride[]
```

Dans `model Expense`, après `paidAt DateTime?` :

```prisma
  budgetCategoryId String? // catégorie du budget prévisionnel (facultative) : l'engagement tombe dans sa ligne
  budgetCategory   BudgetCategory? @relation(fields: [budgetCategoryId], references: [id], onDelete: SetNull)
```

Dans `model Person`, dans la liste des relations :

```prisma
  budgetOverrides    BudgetActualOverride[] @relation("BudgetOverrideAuthor")
```

- [ ] **Step 2: Générer la migration sans l'appliquer**

Run: `npx prisma migrate dev --name budget_plan --create-only`
Puis renommer le dossier créé en `prisma/migrations/20260925120000_budget_plan/` s'il porte un autre horodatage (garder l'ordre après la dernière migration existante).

- [ ] **Step 3: Compléter le SQL par les données par défaut**

Ajouter à la fin de `migration.sql` :

```sql
-- Grille commune par défaut (25/09) : posée une fois, modifiable ensuite dans Admin › Référentiels.
INSERT INTO "BudgetCategory" ("id", "label", "accountPrefixes", "source", "order", "active") VALUES
  ('bcat_personnel',     'Personnel',                '64',                          'time',   1, true),
  ('bcat_indirects',     'Coûts indirects',          '',                            'none',   2, true),
  ('bcat_prestations',   'Prestations',              '604,611,622,628',             'ledger', 3, true),
  ('bcat_achats',        'Achats et fournitures',    '601,602,606',                 'ledger', 4, true),
  ('bcat_deplacements',  'Déplacements',             '625',                         'ledger', 5, true),
  ('bcat_communication', 'Communication',            '623',                         'ledger', 6, true),
  ('bcat_locaux',        'Locaux et fonctionnement', '613,614,615,616,618,626,627', 'ledger', 7, true),
  ('bcat_investissement','Investissement',           '2',                           'ledger', 8, true),
  ('bcat_autre',         'Autre',                    '6',                           'ledger', 9, true)
ON CONFLICT ("id") DO NOTHING;

-- Droits nouveaux donnés aux rôles système, sans rien retirer (les rôles restent modifiables dans Admin › Rôles et droits).
UPDATE "Role" SET "permissions" = "permissions" || ',budget.plan,budget.validate'
  WHERE "code" IN ('director', 'raf') AND "permissions" NOT LIKE '%budget.plan%';
UPDATE "Role" SET "permissions" = "permissions" || ',budget.plan'
  WHERE "code" IN ('pole_lead', 'pilot') AND "permissions" NOT LIKE '%budget.plan%';
```

- [ ] **Step 4: Appliquer et régénérer**

Run: `npx prisma migrate dev && npx prisma generate`
Expected: « All migrations have been successfully applied » ; `npx tsc --noEmit` sans erreur.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260925120000_budget_plan
git commit -m "Budget prévisionnel : schéma (catégories, lignes, surcharges, statut sur l'édition) et grille par défaut"
```

---

### Task 2: Calculs purs et droits

**Files:**
- Create: `lib/budget-plan.ts`
- Test: `tests/unit/budget-plan.test.ts`

**Interfaces:**
- Produces:
  - `type Category = { id: string; label: string; accountPrefixes: string; source: "time" | "ledger" | "none"; order: number; active: boolean }`
  - `classifyAccount(account: string, categories: Category[]): Category | null`
  - `ledgerByCategory(accounts: { accountNumber: string; amount: number }[], categories: Category[]): { byCategory: Map<string, number>; unclassified: number }`
  - `type HrRule = { personId: string | null; amount: number; period: string; startMonth: string; endMonth: string | null; active: boolean; kind: string }`
  - `monthlyCost(personId: string, month: string, rules: HrRule[]): number | null`
  - `personnelActual(entries: { personId: string; month: string; hours: number }[], costOf: (personId: string, month: string) => number | null): { amount: number; hours: number; byPerson: { personId: string; hours: number; amount: number }[]; unvalued: { personId: string; hours: number }[] }`
  - `type PlanRow = { categoryId: string; label: string; source: string; planned: number; computed: number; override: { amount: number; reason: string } | null; actual: number; engaged: number; gap: number; pct: number | null }`
  - `budgetTable(input: { categories: Category[]; lines: { categoryId: string; amount: number }[]; computed: Map<string, number>; overrides: { categoryId: string; amount: number; reason: string }[]; engaged: Map<string, number>; unclassified: number }): { rows: PlanRow[]; unclassified: number; totals: { planned: number; actual: number; engaged: number; gap: number } }`
  - `overBudget(rows: PlanRow[]): PlanRow[]`
  - `canPlanBudget(me: Viewer, ed: { pilotId: string; poleIds: string[]; teamIds: string[] }): boolean`
  - `canValidateBudget(me: Actor): boolean`
  - `canSeePersonnelDetail(me: Actor): boolean`
  - `nextStatusAfterEdit(current: string, me: Actor): string`

- [ ] **Step 1: Écrire les tests**

`tests/unit/budget-plan.test.ts` :

```ts
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
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx tsx --test tests/unit/budget-plan.test.ts`
Expected: FAIL (module `lib/budget-plan` introuvable).

- [ ] **Step 3: Implémenter `lib/budget-plan.ts`**

```ts
// Budget prévisionnel par catégorie (25/09, docs/superpowers/specs/2026-09-25-budget-previsionnel-design.md) — fonctions pures.
// Le prévu vit sur l'édition ; le réalisé Personnel vient du temps valorisé, le reste du grand livre classé par préfixe de compte.
import { has, type Actor } from "./rights";
import type { Viewer } from "./scope";

export type Category = { id: string; label: string; accountPrefixes: string; source: "time" | "ledger" | "none"; order: number; active: boolean };

const prefixesOf = (c: Category) => c.accountPrefixes.split(",").map((p) => p.trim()).filter(Boolean);

// Préfixe le plus long qui correspond ; seules les charges (6x) et l'investissement (2x) se classent.
export function classifyAccount(account: string, categories: Category[]): Category | null {
  if (!account.startsWith("6") && !account.startsWith("2")) return null;
  let best: { c: Category; len: number } | null = null;
  for (const c of categories) for (const p of prefixesOf(c)) if (account.startsWith(p) && (!best || p.length > best.len)) best = { c, len: p.length };
  return best?.c ?? null;
}

// Grand livre → catégories « ledger ». Un compte classé dans une catégorie « time » (le 64 du Personnel) n'est pas compté ici :
// le Personnel se lit dans le temps valorisé. Ce qu'aucune catégorie ne reconnaît va en non classé, visible.
export function ledgerByCategory(accounts: { accountNumber: string; amount: number }[], categories: Category[]) {
  const byCategory = new Map<string, number>();
  let unclassified = 0;
  for (const a of accounts) {
    const c = classifyAccount(a.accountNumber, categories);
    if (!c) { if (a.accountNumber.startsWith("6") || a.accountNumber.startsWith("2")) unclassified += a.amount; continue; }
    if (c.source !== "ledger") continue;
    byCategory.set(c.id, (byCategory.get(c.id) ?? 0) + a.amount);
  }
  return { byCategory, unclassified };
}

export type HrRule = { personId: string | null; amount: number; period: string; startMonth: string; endMonth: string | null; active: boolean; kind: string };

const PER_MONTH: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

// Coût mensuel chargé d'une personne un mois donné (règle « ressource humaine » de la trésorerie active ce mois-là).
export function monthlyCost(personId: string, month: string, rules: HrRule[]): number | null {
  const r = rules.find((x) => x.kind === "hr" && x.active && x.personId === personId && x.startMonth <= month && (!x.endMonth || month <= x.endMonth) && PER_MONTH[x.period]);
  return r ? r.amount / PER_MONTH[r.period] : null;
}

// Temps du projet × coût horaire du mois. Une heure sans coût connu est comptée et signalée, jamais valorisée à un coût deviné.
export function personnelActual(entries: { personId: string; month: string; hours: number }[], costOf: (personId: string, month: string) => number | null) {
  const per = new Map<string, { hours: number; amount: number; unvalued: number }>();
  for (const e of entries) {
    const p = per.get(e.personId) ?? { hours: 0, amount: 0, unvalued: 0 };
    p.hours += e.hours;
    const c = costOf(e.personId, e.month);
    if (c === null) p.unvalued += e.hours; else p.amount += e.hours * c;
    per.set(e.personId, p);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const byPerson = [...per].map(([personId, p]) => ({ personId, hours: p.hours, amount: round(p.amount) }));
  return {
    amount: round(byPerson.reduce((s, p) => s + p.amount, 0)),
    hours: byPerson.reduce((s, p) => s + p.hours, 0),
    byPerson,
    unvalued: [...per].filter(([, p]) => p.unvalued > 0).map(([personId, p]) => ({ personId, hours: p.unvalued })),
  };
}

export type PlanRow = { categoryId: string; label: string; source: string; planned: number; computed: number; override: { amount: number; reason: string } | null; actual: number; engaged: number; gap: number; pct: number | null };

// Écart = prévu − réalisé retenu − engagé restant ; % consommé = (réalisé + engagé) ÷ prévu, jamais plafonné.
export function budgetTable(input: { categories: Category[]; lines: { categoryId: string; amount: number }[]; computed: Map<string, number>; overrides: { categoryId: string; amount: number; reason: string }[]; engaged: Map<string, number>; unclassified: number }) {
  const used = new Set([...input.lines.map((l) => l.categoryId), ...input.overrides.map((o) => o.categoryId), ...input.computed.keys(), ...input.engaged.keys()]);
  const rows: PlanRow[] = [...input.categories]
    .filter((c) => c.active || used.has(c.id))
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const planned = input.lines.filter((l) => l.categoryId === c.id).reduce((s, l) => s + l.amount, 0);
      const computed = input.computed.get(c.id) ?? 0;
      const o = input.overrides.find((x) => x.categoryId === c.id);
      const actual = o ? o.amount : computed;
      const engaged = Math.max(0, input.engaged.get(c.id) ?? 0);
      return { categoryId: c.id, label: c.label, source: c.source, planned, computed, override: o ? { amount: o.amount, reason: o.reason } : null, actual, engaged, gap: planned - actual - engaged, pct: planned > 0 ? Math.round(((actual + engaged) / planned) * 100) : null };
    });
  const sum = (k: "planned" | "actual" | "engaged" | "gap") => rows.reduce((s, r) => s + r[k], 0);
  return { rows, unclassified: input.unclassified, totals: { planned: sum("planned"), actual: sum("actual") + input.unclassified, engaged: sum("engaged"), gap: sum("gap") - input.unclassified } };
}

export const overBudget = (rows: PlanRow[]) => rows.filter((r) => r.planned > 0 && r.actual + r.engaged > r.planned);

// Préparer : le droit budget.plan, et l'édition est la sienne (pilote, équipe), de son pôle pour qui le gère, ou partout avec scope.all.
export function canPlanBudget(me: Viewer, ed: { pilotId: string; poleIds: string[]; teamIds: string[] }): boolean {
  if (!has(me, "budget.plan")) return false;
  if (has(me, "scope.all")) return true;
  if (ed.pilotId === me.id || ed.teamIds.includes(me.id)) return true;
  return has(me, "pole.manage") && me.poleId !== null && ed.poleIds.includes(me.poleId);
}

export const canValidateBudget = (me: Actor) => has(me, "budget.validate");

// Le détail Personnel par personne révèle une rémunération : trésorerie ou validation du budget seulement.
export const canSeePersonnelDetail = (me: Actor) => has(me, "treasury.view") || has(me, "budget.validate");

export function nextStatusAfterEdit(current: string, me: Actor): string {
  return current === "validated" && !canValidateBudget(me) ? "submitted" : current;
}
```

- [ ] **Step 4: Lancer les tests**

Run: `npx tsx --test tests/unit/budget-plan.test.ts`
Expected: PASS (7 tests). `has()` et `PermissionKey` : si TypeScript refuse les clés `budget.plan` / `budget.validate`, c'est la Task 3 (catalogue) — faire la Task 3 avant de relancer `tsc`.

- [ ] **Step 5: Commit**

```bash
git add lib/budget-plan.ts tests/unit/budget-plan.test.ts
git commit -m "Budget prévisionnel : calculs purs (classement des comptes, temps valorisé, écart) et droits, avec tests"
```

---

### Task 3: Droits et module d'instance

**Files:**
- Modify: `lib/permissions.ts` (catalogue + rôles par défaut)
- Modify: `lib/modules.ts` (`INSTANCE_MODULES`)
- Modify: `config/clients/tlst.ts` (`modules`)

**Interfaces:**
- Produces: `PermissionKey` inclut `"budget.plan"` et `"budget.validate"` ; `InstanceModuleKey` inclut `"budget"`.

- [ ] **Step 1: Catalogue**

Dans `PERMISSIONS`, après `fiche.budget` :

```ts
  { key: "budget.plan", module: "editions", label: "Prépare le budget prévisionnel", help: `Sur ses ${pl(V.edition)} (${le(V.pilote)}, équipe), celles de ${son(V.pole)} pour qui le gère, ou partout avec « ${tout(V.org)} ».` },
  { key: "budget.validate", module: "editions", label: "Valide le budget prévisionnel", help: "Valide le prévu, pose une saisie manuelle du réalisé (avec motif), voit le détail du personnel par personne." },
```

Dans `DEFAULT_ROLES` : ajouter `"budget.plan", "budget.validate"` aux permissions de `director` et `raf` ; `"budget.plan"` à `pole_lead` et `pilot`.

- [ ] **Step 2: Module**

Dans `INSTANCE_MODULES` (`lib/modules.ts`) :

```ts
  { key: "budget", label: "Budget prévisionnel", hint: `Le prévu par catégorie de chaque ${V.edition.one}, comparé au réalisé (temps valorisé, grand livre), avec validation. Section de l'onglet Budget.` },
```

Dans `config/clients/tlst.ts` : `modules: "veille,adherents,tresorerie,materiel,budget"`.

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npx tsx --test tests/unit/budget-plan.test.ts tests/unit/clients.test.ts`
Expected: aucune erreur, tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/permissions.ts lib/modules.ts config/clients/tlst.ts
git commit -m "Budget prévisionnel : droits « prépare » et « valide » (configurables) et module d'instance"
```

---

### Task 4: Chargement et filtre des salaires

**Files:**
- Create: `lib/budget-plan-db.ts`

**Interfaces:**
- Consumes: Task 2 (`budgetTable`, `ledgerByCategory`, `monthlyCost`, `personnelActual`, `canSeePersonnelDetail`), `realizedForEdition` (`lib/ledger-db.ts`), `expectedDaysOfMonth`, `loadRhythms`, `PersonRhythms` (`lib/time.ts`).
- Produces:
  - `loadCategories(): Promise<Category[]>`
  - `type BudgetPlanView = { status: string; validatedAt: Date | null; validatedBy: string | null; categories: Category[]; lines: { id: string; categoryId: string; label: string | null; amount: number; note: string | null }[]; table: ReturnType<typeof budgetTable>; personnel: { hours: number; unvaluedHours: number; detail: { name: string; hours: number; amount: number }[] | null; unvaluedPeople: string[] | null } }`
  - `loadBudgetPlan(edition: { id: string; year: number; projectId: string }, me: Actor): Promise<BudgetPlanView>`

- [ ] **Step 1: Implémenter**

```ts
import { prisma } from "./db";
import { dayjs } from "./format";
import { realizedForEdition } from "./ledger-db";
import { expectedDaysOfMonth, loadRhythms, type PersonRhythms } from "./time";
import { budgetTable, canSeePersonnelDetail, ledgerByCategory, monthlyCost, personnelActual, type Category } from "./budget-plan";
import type { Actor } from "./rights";

export async function loadCategories(): Promise<Category[]> {
  const rows = await prisma.budgetCategory.findMany({ orderBy: { order: "asc" } });
  return rows.map((c) => ({ ...c, source: (["time", "ledger", "none"].includes(c.source) ? c.source : "ledger") as Category["source"] }));
}

// Tout ce qu'il faut pour le tableau d'une édition. Le détail Personnel par personne (heures × coût = salaire) n'est
// renvoyé qu'à qui a le droit de le voir : le filtre est ici, avant toute sérialisation vers le navigateur.
export async function loadBudgetPlan(edition: { id: string; year: number; projectId: string }, me: Actor) {
  const [ed, categories, lines, overrides, expenses, settings, rules, rhythms, entries] = await Promise.all([
    prisma.edition.findUnique({ where: { id: edition.id }, select: { budgetPlanStatus: true, budgetPlanValidatedAt: true, budgetPlanValidatedById: true } }),
    loadCategories(),
    prisma.budgetLine.findMany({ where: { editionId: edition.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.budgetActualOverride.findMany({ where: { editionId: edition.id } }),
    prisma.expense.findMany({ where: { editionId: edition.id }, select: { budgetCategoryId: true, committed: true, spent: true, status: true } }),
    prisma.settings.findUnique({ where: { id: 1 }, select: { realizedSource: true } }),
    prisma.cashRule.findMany({ where: { kind: "hr" } }),
    loadRhythms(),
    prisma.timeEntry.findMany({ where: { projectId: edition.projectId, date: { gte: new Date(`${edition.year}-01-01`), lt: new Date(`${edition.year + 1}-01-01`) } }, select: { personId: true, date: true, hours: true } }),
  ]);

  // Réalisé hors Personnel : grand livre si c'est la source réglée, sinon les dépenses rangées dans une catégorie (jamais les deux).
  let computed = new Map<string, number>();
  let unclassified = 0;
  if (settings?.realizedSource === "ledger") {
    const { realized } = await realizedForEdition(edition);
    const r = ledgerByCategory(realized.byAccount.map((a) => ({ accountNumber: a.accountNumber, amount: a.amount })), categories);
    computed = r.byCategory;
    unclassified = r.unclassified;
  } else {
    for (const x of expenses) if (x.budgetCategoryId) computed.set(x.budgetCategoryId, (computed.get(x.budgetCategoryId) ?? 0) + x.spent);
  }

  // Personnel : temps × coût horaire du mois (coût mensuel chargé ÷ heures attendues du mois selon le rythme).
  const people = await prisma.person.findMany({ where: { id: { in: [...new Set(entries.map((e) => e.personId))] } }, select: { id: true, name: true, workRhythm: true, rhythmPeriods: { include: { rhythm: true } } } });
  const personOf = new Map(people.map((p) => [p.id, p]));
  const hourly = new Map<string, number | null>();
  const costOf = (personId: string, month: string) => {
    const key = `${personId}:${month}`;
    if (hourly.has(key)) return hourly.get(key)!;
    const monthly = monthlyCost(personId, month, rules);
    const p = personOf.get(personId);
    const hours = p ? expectedDaysOfMonth(p as PersonRhythms, month, rhythms, dayjs(`${month}-01`).endOf("month")).hours : 0;
    const v = monthly !== null && hours > 0 ? monthly / hours : null;
    hourly.set(key, v);
    return v;
  };
  const personnel = personnelActual(entries.map((e) => ({ personId: e.personId, month: dayjs(e.date).format("YYYY-MM"), hours: e.hours })), costOf);
  for (const c of categories) if (c.source === "time") computed.set(c.id, (computed.get(c.id) ?? 0) + personnel.amount);

  const engaged = new Map<string, number>();
  for (const x of expenses) if (x.budgetCategoryId && x.status === "open") engaged.set(x.budgetCategoryId, (engaged.get(x.budgetCategoryId) ?? 0) + Math.max(0, x.committed - x.spent));

  const table = budgetTable({ categories, lines, computed, overrides, engaged, unclassified });
  const detailed = canSeePersonnelDetail(me);
  const validator = ed?.budgetPlanValidatedById ? await prisma.person.findUnique({ where: { id: ed.budgetPlanValidatedById }, select: { name: true } }) : null;
  return {
    status: ed?.budgetPlanStatus ?? "draft",
    validatedAt: ed?.budgetPlanValidatedAt ?? null,
    validatedBy: validator?.name ?? null,
    categories,
    lines: lines.map((l) => ({ id: l.id, categoryId: l.categoryId, label: l.label, amount: l.amount, note: l.note })),
    table,
    personnel: {
      hours: personnel.hours,
      unvaluedHours: personnel.unvalued.reduce((s, u) => s + u.hours, 0),
      detail: detailed ? personnel.byPerson.map((p) => ({ name: personOf.get(p.personId)?.name ?? "—", hours: p.hours, amount: p.amount })) : null,
      unvaluedPeople: detailed ? personnel.unvalued.map((u) => personOf.get(u.personId)?.name ?? "—") : null,
    },
  };
}

export type BudgetPlanView = Awaited<ReturnType<typeof loadBudgetPlan>>;
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur. (Si `rhythmPeriods` n'a pas ce nom de relation sur `Person`, lire `prisma/schema.prisma` et utiliser le nom exact.)

- [ ] **Step 3: Commit**

```bash
git add lib/budget-plan-db.ts
git commit -m "Budget prévisionnel : chargement du tableau d'une édition, salaires filtrés avant envoi"
```

---

### Task 5: Commandes

**Files:**
- Create: `app/actions/budget-plan.ts`

**Interfaces:**
- Consumes: Task 2 (`canPlanBudget`, `canValidateBudget`, `nextStatusAfterEdit`).
- Produces (Server Actions, `Result = { ok: true; data?: T } | { ok: false; error: string }`):
  - `addBudgetLine(editionId: string, input: { categoryId: string; label?: string | null; amount: number; note?: string | null }): Promise<Result<{ id: string }>>`
  - `updateBudgetLine(id: string, input: { categoryId?: string; label?: string | null; amount?: number; note?: string | null }): Promise<Result>`
  - `deleteBudgetLine(id: string): Promise<Result>`
  - `submitBudgetPlan(editionId: string): Promise<Result>`
  - `validateBudgetPlan(editionId: string): Promise<Result>`
  - `setActualOverride(editionId: string, categoryId: string, amount: number, reason: string): Promise<Result>`
  - `clearActualOverride(editionId: string, categoryId: string): Promise<Result>`
  - `setExpenseCategory(expenseId: string, categoryId: string | null): Promise<Result>`
  - `saveBudgetCategory(input: { id?: string; label: string; accountPrefixes: string; source: string; order: number; active: boolean }): Promise<Result<{ id: string }>>`

- [ ] **Step 1: Implémenter**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin, canTrackExpenses, canWriteLayer } from "@/lib/rights";
import { projectPoleIds } from "@/lib/scope";
import { canPlanBudget, canValidateBudget, nextStatusAfterEdit } from "@/lib/budget-plan";
import { reportInternalError } from "@/lib/errors";
import { fmtEuro } from "@/lib/format";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
type Me = Awaited<ReturnType<typeof getCurrentPerson>>;

const DENIED = "Vous ne préparez pas le budget de ce projet.";
const validAmount = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

async function editionFor(editionId: string) {
  return prisma.edition.findUnique({ where: { id: editionId }, select: { id: true, budgetPlanStatus: true, project: { select: { pilotId: true, poleId: true, secondaryPoles: { select: { poleId: true } } } }, team: { select: { personId: true } } } });
}
type Ed = NonNullable<Awaited<ReturnType<typeof editionFor>>>;
const planAllowed = (me: Me, ed: Ed) => canPlanBudget(me, { pilotId: ed.project.pilotId, poleIds: projectPoleIds(ed.project), teamIds: ed.team.map((t) => t.personId) });

async function activeCategory(id: string) {
  const c = await prisma.budgetCategory.findUnique({ where: { id } });
  return c && c.active ? c : null;
}

// Trace d'une écriture du budget, dans la même transaction que l'écriture (historique de la fiche).
const trace = (editionId: string, field: string, before: string | null, after: string | null, authorId: string) =>
  prisma.changeLog.create({ data: { editionId, field, before, after, authorId } });

// Après une modification du prévu : un budget validé repasse « à valider », sauf pour qui valide.
function statusAfter(ed: Ed, me: Me) {
  const next = nextStatusAfterEdit(ed.budgetPlanStatus, me);
  return next === ed.budgetPlanStatus ? [] : [prisma.edition.update({ where: { id: ed.id }, data: { budgetPlanStatus: next } }), trace(ed.id, "budget:statut", ed.budgetPlanStatus, next, me.id)];
}

export async function addBudgetLine(editionId: string, input: { categoryId: string; label?: string | null; amount: number; note?: string | null }): Promise<Result<{ id: string }>> {
  try {
    const me = await getCurrentPerson();
    const ed = await editionFor(editionId);
    if (!ed) return { ok: false, error: "Projet introuvable." };
    if (!planAllowed(me, ed)) return { ok: false, error: DENIED };
    if (!validAmount(input.amount)) return { ok: false, error: "Le montant doit être un nombre positif ou nul." };
    const cat = await activeCategory(input.categoryId);
    if (!cat) return { ok: false, error: "Catégorie inconnue ou désactivée." };
    const [line] = await prisma.$transaction([
      prisma.budgetLine.create({ data: { editionId, categoryId: cat.id, label: input.label?.trim() || null, amount: input.amount, note: input.note?.trim() || null } }),
      trace(editionId, `budget:${cat.label}`, null, fmtEuro(input.amount), me.id),
      ...statusAfter(ed, me),
    ]);
    revalidatePath(`/edition/${editionId}`);
    return { ok: true, data: { id: line.id } };
  } catch (e) {
    return { ok: false, ...reportInternalError("addBudgetLine", e) };
  }
}

export async function updateBudgetLine(id: string, input: { categoryId?: string; label?: string | null; amount?: number; note?: string | null }): Promise<Result> {
  try {
    const me = await getCurrentPerson();
    const line = await prisma.budgetLine.findUnique({ where: { id }, include: { category: true } });
    if (!line) return { ok: false, error: "Ligne introuvable." };
    const ed = await editionFor(line.editionId);
    if (!ed || !planAllowed(me, ed)) return { ok: false, error: DENIED };
    if (input.amount !== undefined && !validAmount(input.amount)) return { ok: false, error: "Le montant doit être un nombre positif ou nul." };
    const cat = input.categoryId ? await activeCategory(input.categoryId) : line.category;
    if (!cat) return { ok: false, error: "Catégorie inconnue ou désactivée." };
    const amount = input.amount ?? line.amount;
    await prisma.$transaction([
      prisma.budgetLine.update({ where: { id }, data: { categoryId: cat.id, label: input.label === undefined ? line.label : input.label?.trim() || null, amount, note: input.note === undefined ? line.note : input.note?.trim() || null } }),
      trace(line.editionId, `budget:${cat.label}${line.label ? ` · ${line.label}` : ""}`, `${line.category.label} ${fmtEuro(line.amount)}`, `${cat.label} ${fmtEuro(amount)}`, me.id),
      ...statusAfter(ed, me),
    ]);
    revalidatePath(`/edition/${line.editionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, ...reportInternalError("updateBudgetLine", e) };
  }
}

export async function deleteBudgetLine(id: string): Promise<Result> {
  try {
    const me = await getCurrentPerson();
    const line = await prisma.budgetLine.findUnique({ where: { id }, include: { category: true } });
    if (!line) return { ok: false, error: "Ligne introuvable." };
    const ed = await editionFor(line.editionId);
    if (!ed || !planAllowed(me, ed)) return { ok: false, error: DENIED };
    await prisma.$transaction([
      prisma.budgetLine.delete({ where: { id } }),
      trace(line.editionId, `budget:${line.category.label}${line.label ? ` · ${line.label}` : ""}`, fmtEuro(line.amount), null, me.id),
      ...statusAfter(ed, me),
    ]);
    revalidatePath(`/edition/${line.editionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, ...reportInternalError("deleteBudgetLine", e) };
  }
}

export async function submitBudgetPlan(editionId: string): Promise<Result> {
  const me = await getCurrentPerson();
  const ed = await editionFor(editionId);
  if (!ed || !planAllowed(me, ed)) return { ok: false, error: DENIED };
  if (ed.budgetPlanStatus !== "draft") return { ok: false, error: "Le budget est déjà soumis ou validé." };
  if ((await prisma.budgetLine.count({ where: { editionId } })) === 0) return { ok: false, error: "Ajoutez au moins une ligne avant de soumettre." };
  await prisma.$transaction([prisma.edition.update({ where: { id: editionId }, data: { budgetPlanStatus: "submitted" } }), trace(editionId, "budget:statut", "draft", "submitted", me.id)]);
  revalidatePath(`/edition/${editionId}`);
  return { ok: true };
}

export async function validateBudgetPlan(editionId: string): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canValidateBudget(me)) return { ok: false, error: "Vous ne validez pas les budgets prévisionnels." };
  if ((await prisma.budgetLine.count({ where: { editionId } })) === 0) return { ok: false, error: "Le budget est vide." };
  // Claim atomique (SEC-29) : deux validations simultanées n'en font qu'une.
  const claimed = await prisma.$transaction(async (tx) => {
    const r = await tx.edition.updateMany({ where: { id: editionId, budgetPlanStatus: { not: "validated" } }, data: { budgetPlanStatus: "validated", budgetPlanValidatedAt: new Date(), budgetPlanValidatedById: me.id } });
    if (r.count === 1) await tx.changeLog.create({ data: { editionId, field: "budget:statut", before: null, after: "validated", authorId: me.id } });
    return r.count === 1;
  });
  if (!claimed) return { ok: false, error: "Ce budget est déjà validé." };
  revalidatePath(`/edition/${editionId}`);
  return { ok: true };
}

export async function setActualOverride(editionId: string, categoryId: string, amount: number, reason: string): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canValidateBudget(me)) return { ok: false, error: "Seul qui valide les budgets saisit un réalisé à la main." };
  if (!validAmount(amount)) return { ok: false, error: "Le montant doit être un nombre positif ou nul." };
  if (!reason.trim()) return { ok: false, error: "Indiquez le motif de la saisie manuelle." };
  const cat = await prisma.budgetCategory.findUnique({ where: { id: categoryId } });
  if (!cat || !(await prisma.edition.findUnique({ where: { id: editionId }, select: { id: true } }))) return { ok: false, error: "Projet ou catégorie introuvable." };
  const before = await prisma.budgetActualOverride.findUnique({ where: { editionId_categoryId: { editionId, categoryId } } });
  await prisma.$transaction([
    prisma.budgetActualOverride.upsert({ where: { editionId_categoryId: { editionId, categoryId } }, create: { editionId, categoryId, amount, reason: reason.trim(), authorId: me.id }, update: { amount, reason: reason.trim(), authorId: me.id } }),
    trace(editionId, `budget:surcharge:${cat.label}`, before ? fmtEuro(before.amount) : null, `${fmtEuro(amount)} — ${reason.trim()}`.slice(0, 500), me.id),
  ]);
  revalidatePath(`/edition/${editionId}`);
  return { ok: true };
}

export async function clearActualOverride(editionId: string, categoryId: string): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canValidateBudget(me)) return { ok: false, error: "Seul qui valide les budgets retire une saisie manuelle." };
  const o = await prisma.budgetActualOverride.findUnique({ where: { editionId_categoryId: { editionId, categoryId } }, include: { category: true } });
  if (!o) return { ok: true };
  await prisma.$transaction([prisma.budgetActualOverride.delete({ where: { id: o.id } }), trace(editionId, `budget:surcharge:${o.category.label}`, fmtEuro(o.amount), null, me.id)]);
  revalidatePath(`/edition/${editionId}`);
  return { ok: true };
}

export async function setExpenseCategory(expenseId: string, categoryId: string | null): Promise<Result> {
  const me = await getCurrentPerson();
  const x = await prisma.expense.findUnique({ where: { id: expenseId }, select: { id: true, editionId: true } });
  if (!x) return { ok: false, error: "Dépense introuvable." };
  if (!canTrackExpenses(me) && !canWriteLayer(me, "budget", false, false)) return { ok: false, error: "Vous ne suivez pas les dépenses." };
  if (categoryId && !(await activeCategory(categoryId))) return { ok: false, error: "Catégorie inconnue ou désactivée." };
  await prisma.expense.update({ where: { id: expenseId }, data: { budgetCategoryId: categoryId } });
  revalidatePath(`/edition/${x.editionId}`);
  return { ok: true };
}

export async function saveBudgetCategory(input: { id?: string; label: string; accountPrefixes: string; source: string; order: number; active: boolean }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration." };
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Le libellé est obligatoire." };
  if (!["time", "ledger", "none"].includes(input.source)) return { ok: false, error: "Source inconnue." };
  const accountPrefixes = input.accountPrefixes.split(",").map((p) => p.trim()).filter(Boolean);
  if (accountPrefixes.some((p) => !/^[0-9]{1,8}$/.test(p))) return { ok: false, error: "Les préfixes sont des numéros de compte (chiffres), séparés par des virgules." };
  const data = { label, accountPrefixes: accountPrefixes.join(","), source: input.source, order: Math.round(input.order) || 0, active: input.active };
  const c = input.id ? await prisma.budgetCategory.update({ where: { id: input.id }, data }) : await prisma.budgetCategory.create({ data });
  revalidatePath("/admin");
  return { ok: true, data: { id: c.id } };
}
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur. Le fichier appelle `getCurrentPerson` (sentinelle).

- [ ] **Step 3: Commit**

```bash
git add app/actions/budget-plan.ts
git commit -m "Budget prévisionnel : commandes dédiées (lignes, soumission, validation atomique, surcharge motivée, référentiel)"
```

---

### Task 6: Section de l'onglet Budget, alerte, export

**Files:**
- Create: `app/edition/[id]/budget-plan.tsx`, `app/edition/[id]/budget-plan-forms.tsx`, `app/edition/[id]/budget-plan/export/route.ts`
- Modify: `app/edition/[id]/page.tsx`, `lib/alerts.ts`

**Interfaces:**
- Consumes: Task 4 `loadBudgetPlan`, `BudgetPlanView` ; Task 5 commandes ; Task 2 `overBudget`, `canPlanBudget`, `canValidateBudget`.

- [ ] **Step 1: Type d'alerte**

`lib/alerts.ts` : ajouter `"budget_over"` à `AlertKind`.

- [ ] **Step 2: Formulaires client** — `app/edition/[id]/budget-plan-forms.tsx`

Composants : `BudgetLineForm` (catégorie en `<select>`, libellé, montant, bouton ; `data-testid="budget-line-*"`), `BudgetLineRow` (montant modifiable au clic, supprimer), `BudgetStatusButtons` (Soumettre / Valider), `OverrideForm` (montant + motif obligatoire + Retirer). Tous utilisent le motif `useTransition` + `toast.error` + `router.refresh()` comme `add-forms.tsx`.

- [ ] **Step 3: Section serveur** — `app/edition/[id]/budget-plan.tsx`

`export async function BudgetPlanSection({ e, me, isPilot, isTeam }: TabCtx)` : charge `loadBudgetPlan(e, me)`, calcule `canPlan` (`canPlanBudget`) et `canValidate`, rend dans une `<Section title="Budget prévisionnel">` : bandeau de statut (`data-testid="budget-plan-status"`), tableau (`data-testid="budget-plan-table"`, une ligne par catégorie `data-testid="budget-row-<id>"` avec Prévu · Réalisé · Engagé · Écart · %), lignes de détail, ligne « Non classé », ligne Personnel (heures valorisées, heures sans coût ; détail par personne **seulement si `personnel.detail` n'est pas null**, `data-testid="budget-personnel-detail"`), lien d'export CSV.

- [ ] **Step 4: Route d'export** — `app/edition/[id]/budget-plan/export/route.ts`

`GET` : `sessionExportAllowed(req)` sinon 401 ; `getCurrentPerson()` ; `loadBudgetPlan` ; CSV `csvRow` : Catégorie ; Prévu ; Réalisé ; Engagé restant ; Écart ; % consommé ; Saisie manuelle ; motif. Pas de détail par personne dans l'export.

- [ ] **Step 5: Brancher dans la page**

`app/edition/[id]/page.tsx` : si `instanceHas(settings, "budget")`, rendre `<div id="previsionnel"><BudgetPlanSection {...ctx} /></div>` en tête de l'onglet Budget (lien « Prévisionnel » dans la nav de l'onglet) ; charger `loadBudgetPlan` une fois pour l'alerte : si `status === "validated"`, pour chaque `overBudget(table.rows)` ajouter `{ kind: "budget_over", level: "danger", label: \`${row.label} : réalisé + engagé dépasse le prévu de ${fmtEuro(-row.gap)}\` }` aux `alerts`.

- [ ] **Step 6: Vérifier**

Run: `npm run check`
Expected: vert.

- [ ] **Step 7: Commit**

```bash
git add app/edition/[id] lib/alerts.ts
git commit -m "Budget prévisionnel : section de l'onglet Budget (prévu, réalisé, engagé, écart), alerte de dépassement, export CSV"
```

---

### Task 7: Catégorie des dépenses, référentiel admin, bloc dossier

**Files:**
- Modify: `app/edition/[id]/budget.tsx` (sélecteur de catégorie par dépense, si module actif)
- Create: `app/admin/budget-categories.tsx`
- Modify: `app/admin/page.tsx` (section dans « Référentiels », si module actif)
- Modify: `app/conventions/[id]/page.tsx` (bloc lecture)

- [ ] **Step 1:** Sélecteur `<select data-testid="expense-category-<id>">` qui appelle `setExpenseCategory`.
- [ ] **Step 2:** `BudgetCategoriesForm` : liste éditable (libellé, préfixes, source, ordre, actif) + ajout, via `saveBudgetCategory`.
- [ ] **Step 3:** Dossier : pour chaque édition rattachée aux lignes de la convention, `loadBudgetPlan` puis somme par catégorie ; tableau lecture « Budget des projets financés » (`data-testid="convention-budget"`), par année.
- [ ] **Step 4:** `npm run check` vert.
- [ ] **Step 5: Commit** — `Budget prévisionnel : catégorie des dépenses, référentiel dans l'admin, lecture sur le dossier de financement`.

---

### Task 8: Seeds, tests sécurité et recette

**Files:**
- Modify: `prisma/seeds/common.ts` (ou `cress.ts`/`tlst.ts`) : rien pour les catégories (migration) ; `prisma/seeds/cress.ts` : un budget prévisionnel validé sur une édition 2026 avec des temps saisis ; `prisma/seeds/tlst.ts` : idem.
- Modify: `tests/security/global-setup.ts` (identifiant d'édition avec budget)
- Create: `tests/security/sec-30-budget-salaires.spec.ts`, `tests/budget-previsionnel.spec.ts`

- [ ] **Step 1: Seed** : sur une édition 2026 dont des temps sont saisis, `BudgetLine` Personnel 20 000, Prestations 3 000, Déplacements 800 ; statut `validated`. Le module `budget` est ajouté à `Settings.modules` par le seed CRESS de recette (pour que la recette le voie).
- [ ] **Step 2: Sécurité** : le contributeur ouvre `/edition/<id>?onglet=budget` → la page ne contient pas `budget-personnel-detail` ni le nom d'une personne suivi d'un montant ; la direction le voit.
- [ ] **Step 3: Recette** : `iAm` pilote de l'édition → ajoute une ligne, soumet ; `iAm` RAF → valide ; pilote modifie → statut « à valider » ; RAF → saisie manuelle Personnel avec motif, le calcul reste affiché ; export CSV 200.
- [ ] **Step 4:** `npm run check` puis `npx playwright test tests/budget-previsionnel.spec.ts` et `npm run test:security` verts.
- [ ] **Step 5: Commit** — `Budget prévisionnel : démo, test des salaires masqués, recette`.

---

### Task 9: Clôture

- [ ] **Step 1:** `docs/evolutions.md` : une entrée datée du lot.
- [ ] **Step 2:** `npm run check:full` vert (recette + sécurité complètes).
- [ ] **Step 3: Commit** — `Budget prévisionnel : notes d'évolution`.
- [ ] **Step 4:** Déploiement **sur go de Gaël** (`./deploy/deploy.sh tlst` puis `cress`), puis activer le module dans Admin › Modules de l'instance TLST.
