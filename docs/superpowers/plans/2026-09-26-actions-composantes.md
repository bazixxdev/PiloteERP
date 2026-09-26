# L'action composante, validation par niveaux, fin de la délégation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de l'action une composante du projet (période, jalons, personnes associées, financements avec montant, budget), valider les fiches par niveaux, supprimer la délégation comme objet à part, distinguer projets internes et personnes qui ne suivent pas leur temps — sans perdre une donnée.

**Architecture:** Migration « expand » : nouvelles tables et colonnes, copie des données dans la même migration, anciennes colonnes gardées jusqu'à une release suivante. Toute la logique de période vit dans des fonctions pures (`lib/actions.ts`, `lib/fiche-validation.ts`) ; un seul chargeur (`lib/actions-db.ts`, `attachYearActions`) remplace partout l'`include: { actions }` des années, sur le modèle d'`attachLedgerSpent`. Les écritures passent par des commandes serveur gardées (`app/actions/actions.ts`, `app/actions/fiche-validation.ts`), jamais par `saveField` pour ce qui a des invariants (période, liens, niveaux).

**Tech Stack:** Next.js 15 (App Router, Server Actions), Prisma 6 / PostgreSQL 16, TypeScript strict, `docx`, node:test (`tsx --test`), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-actions-composantes-design.md` et `docs/superpowers/specs/2026-09-26-vocabulaire-gouvernance-design.md` (lire les deux avant de commencer).

## Global Constraints

- Règles `AGENTS.md` + `.agents/rules/*.md` ; lire `donnees-migrations.md` avant la tâche 2, `securite-autorisation.md` avant toute commande serveur, `tests-recette.md` avant les recettes.
- Migration **expand uniquement** : aucune colonne supprimée ni passée `NOT NULL` ; `Action.editionId` reste rempli (année de création) et n'est plus lu pour décider où une action apparaît.
- Une action apparaît dans l'année Y si sa période chevauche Y : **une seule fonction**, `runsIn` (`lib/actions.ts`).
- Chaque commande serveur : `getCurrentPerson()`, garde sur la ressource **avant** lecture/écriture, transaction pour tout multi-étapes.
- Aucun mot du vocabulaire client en dur, ni dans l'interface ni dans les tests (après la tâche 1) : `V`, `cap`, `le`, `de`, `du`, `un`, `ce`, `pl`, `ppe`, `e`… de `lib/vocab.ts`.
- `npm run check` vert avant chaque commit ; commits en français, une phrase qui dit le pourquoi, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Recette complète (`npm test`) : elle remet `pilote_test` à zéro — **accord explicite de Gaël** avant de la lancer (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). Pendant les tâches, lancer seulement les specs concernées avec cet accord, sinon s'arrêter aux tests unitaires et le signaler.
- Rien sur le serveur sans Gaël (déploiement, reprise TLST).

---

## File Structure

| Fichier | Rôle |
|---|---|
| `tests/vocab.ts` | utilitaire de test : les mots de l'instance testée, composés avec les fonctions de `lib/vocab.ts` |
| `scripts/check-vocab.mjs` | étendu aux assertions de `tests/` |
| `config/clients/{types,cress,tlst}.ts` | mot `sponsor` ; TLST `codir` = « coordination » |
| `prisma/schema.prisma`, `prisma/migrations/20260927090000_actions_composantes/migration.sql` | tables et colonnes nouvelles, copie des données |
| `lib/actions.ts` | fonctions pures : période, années, reconduction, propagation des liens, équilibre, alertes d'action |
| `lib/actions-db.ts` | `attachYearActions` (chargeur unique), `projectActions` |
| `app/actions/actions.ts` | commandes : créer, période, jalons, personnes associées, financements, supprimer |
| `lib/rights.ts` | `canEditAction` (droits sur une action selon sa période) |
| `app/action/[id]/page.tsx`, `app/action/[id]/*.tsx` | page de l'action |
| `app/edition/[id]/actions-tab.tsx`, `timeline.tsx` | onglet Actions et frise refaits |
| `lib/alerts.ts`, `lib/agenda.ts`, `lib/ics.ts` | alertes, relances, agenda lus sur les jalons |
| `components/funding/funded-actions.tsx`, `app/financements/export/route.ts` | « Actions financées », export temps par action financée |
| `lib/fiche-validation.ts`, `app/actions/fiche-validation.ts` | circuit de validation par niveaux |
| `app/mes-actions/page.tsx`, `app/mes-actions/export/route.ts` | « Mes actions » et feuille de mission |
| `prisma/seeds/{cress,tlst}.ts` | démos réécrites |
| `lib/lexique.ts` | guide mis à jour |
| `tests/unit/{actions,fiche-validation,vocab-tests}.test.ts`, `tests/actions.spec.ts`, `tests/validation-fiche.spec.ts` | tests |

---

## Lot A — Fondations

### Task 1: Le vocabulaire dans les tests, et deux mots nouveaux

**Files:**
- Create: `tests/vocab.ts`, `tests/unit/vocab-tests.test.ts`
- Modify: `scripts/check-vocab.mjs`, `config/clients/types.ts`, `config/clients/cress.ts`, `config/clients/tlst.ts`, `tests/unit/clients.test.ts`, les specs de `tests/` qui écrivent un mot du vocabulaire (`codir`, `conventions`, `habillage`, `matrice`, `recette-3-validation-seminaire`, `taches` — `grep` ci-dessous)

**Interfaces:**
- Produces: `tests/vocab.ts` exporte `W` (les mots de l'instance, `V` recalculé pour `TEST_CLIENT`, défaut `cress`) et les helpers de `lib/vocab.ts` ; `V.sponsor: Word`.

- [ ] **Step 1: Ajouter le mot `sponsor`** dans `config/clients/types.ts` (`sponsor: Word; // la personne de la gouvernance qui soutient le projet en instance`), puis :
  - `cress.ts` : `sponsor: { one: "référent direction", many: "référents direction", gender: "m" },`
  - `tlst.ts` : `sponsor: { one: "référent CA", many: "référents CA", gender: "m" },` et `codir: { one: "coordination", many: "coordinations", gender: "f" },`

- [ ] **Step 2: Écrire l'utilitaire de test** `tests/vocab.ts` :

```ts
// Les mots de l'instance testée (26/09) : une recette ne doit jamais écrire « année » ou « action » en dur, sinon changer un
// mot du vocabulaire casse la recette. On compose les libellés attendus avec les mêmes fonctions que l'interface.
import { clientFor } from "../config/clients/index";
import type { Word } from "../config/clients/types";
export { cap, le, un, du, de, au, ce, pl, ppe, aucun, tous, nb } from "../lib/vocab";

export const client = clientFor(process.env.TEST_CLIENT ?? "cress");
export const W = { ...client.vocab, org: { one: client.shortName, many: client.shortName, gender: client.orgGender } as Word };
```

Vérifier que `lib/vocab.ts` n'importe que `@/config/clients` : si l'alias `@/` n'est pas résolu par Playwright, exporter les helpers depuis un fichier sans alias (`lib/vocab-core.ts` contenant `elide`, `cap`, `le`…, réexporté par `lib/vocab.ts`), et importer ce fichier ici.

- [ ] **Step 3: Test unitaire de l'utilitaire** `tests/unit/vocab-tests.test.ts` :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { W, cap, pl, aucun } from "../vocab";

test("les mots des tests viennent de la configuration de l'instance", () => {
  assert.equal(`Portefeuille des ${pl(W.projet)}`, "Portefeuille des projets");
  assert.match(cap(aucun(W.edition)), /^Aucun/);
  assert.ok(W.sponsor.one.length > 0);
});
```

Run: `npx tsx --test tests/unit/vocab-tests.test.ts` — Expected: PASS.

- [ ] **Step 4: `clients.test.ts` vérifie la forme, plus la valeur** : remplacer les assertions de valeur (`cress.vocab.edition.one === "année"`, `tlst.vocab.action.one === "action"`…) par : chaque mot a `one`, `many`, `gender`, et les neuf clés (ajouter `sponsor` à la liste) ; garder les assertions qui ne sont pas du vocabulaire (nom court, modules, chemins).

- [ ] **Step 5: Réécrire les assertions de recette** qui contiennent un mot du vocabulaire :

Run: `grep -rnE "[Ée]dition|[Aa]nnée|[Ée]tape|[Aa]ction|[Pp]ôle|CODIR|RAF|[Pp]ilote" tests/*.spec.ts | grep -E "toContainText|getByText|name: /|toHaveAttribute"`

Chaque libellé devient une composition : par ex. `toContainText("Portefeuille des projets")` → ``toContainText(`Portefeuille des ${pl(W.projet)}`)``, `/aucune année rattachée/i` → ``new RegExp(`${aucun(W.edition)} rattachée`, "i")``, `getByRole("tab", { name: /^Actions/ })` → ``{ name: new RegExp(`^${cap(pl(W.action))}`) }``. Dans `habillage.spec.ts` (instance TLST), importer depuis `tests/vocab.ts` avec `TEST_CLIENT=tlst` fixé en tête du fichier (`process.env.TEST_CLIENT = "tlst"` avant l'import) ou passer par une variante `WTlst` exportée par `tests/vocab.ts` (`clientFor("tlst")`) — préférer cette variante, plus explicite.

- [ ] **Step 6: Étendre `scripts/check-vocab.mjs`** aux fichiers `tests/**/*.ts` : n'y examiner que les chaînes passées à `toContainText`, `getByText`, `toHaveAttribute`, `toHaveText` et les `name:` de `getByRole` ; les mêmes mots interdits ; `// vocab-ok` reste l'échappatoire. Run: `npm run check:vocab` — Expected: `✔`.

- [ ] **Step 7: Vérifier et commiter**

Run: `npm run check` — Expected: vert.

```bash
git add tests/vocab.ts tests/unit/vocab-tests.test.ts tests/unit/clients.test.ts tests/*.spec.ts scripts/check-vocab.mjs config/clients lib/vocab*.ts
git commit -m "Tests : les recettes lisent le vocabulaire de l'instance ; mot « sponsor », TLST dit « coordination »

Changer un mot (« année » est à l'essai) doit tenir en une ligne par instance, tests compris.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schéma et migration « expand » avec copie des données

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260927090000_actions_composantes/migration.sql`
- Test: `tests/unit/actions-migration.test.ts`

**Interfaces:**
- Produces: modèles `Milestone`, `ActionPerson`, `ActionFunding`, `FicheValidationLevel`, `FicheValidation` ; colonnes `Action.projectId/startDate/endDate/recurrence/audience/entrusted/latitude`, `Expense.actionId`, `Indicator.actionId`, `Project.kind`, `Person.tracksTime`. Codes d'état d'action : `todo | doing | done | abandoned`.

- [ ] **Step 1: Schéma.** Ajouter exactement les modèles et colonnes de la spec « actions » § 1 et de la spec « vocabulaire » § 3 (`FicheValidationLevel`, `FicheValidation`). Relations inverses : `Project.actions Action[]`, `Person.actionRoles ActionPerson[]`, `Person.ficheDecisions FicheValidation[]`, `FundingLine.actionFundings ActionFunding[]`, `Edition.ficheValidations FicheValidation[]`, `Action.expenses Expense[]`, `Action.indicators Indicator[]`. Garder **tous** les anciens champs d'`Action`.

- [ ] **Step 2: Générer la migration** : `npx prisma migrate dev --create-only --name actions_composantes`, renommer le dossier en `20260927090000_actions_composantes`, relire le SQL généré.

- [ ] **Step 3: Ajouter la copie des données** à la fin du `migration.sql` (commentée) :

```sql
-- Copie (26/09, spec actions § 1) : chaque action existante garde tout ; rien n'est supprimé.
-- 1. Projet et période : l'année de l'action, prolongée jusqu'à son jalon s'il tombe après le 31/12.
UPDATE "Action" a SET
  "projectId" = e."projectId",
  "startDate" = make_date(e."year", 1, 1),
  "endDate"   = GREATEST(make_date(e."year", 12, 31), COALESCE(a."milestoneDate"::date, make_date(e."year", 12, 31)))
FROM "Edition" e WHERE e."id" = a."editionId";

-- 2. L'ancien jalon devient un jalon (avec lieu, participants, public, point de contrôle).
INSERT INTO "Milestone" ("id", "actionId", "date", "label", "done", "doneAt", "venue", "participants", "isPublic", "isCheckpoint", "order")
SELECT 'ms_' || a."id", a."id", a."milestoneDate", a."name", a."state" = 'done', NULL, a."venue", a."participants", a."isPublic", a."isCheckpoint", 0
FROM "Action" a WHERE a."milestoneDate" IS NOT NULL;

-- 3. L'ancien financeur devient un lien sans montant.
INSERT INTO "ActionFunding" ("actionId", "fundingLineId", "amount")
SELECT a."id", a."fundingLineId", NULL FROM "Action" a WHERE a."fundingLineId" IS NOT NULL;

-- 4. « late » (calculé, rarement stocké) redevient « doing ».
UPDATE "Action" SET "state" = 'doing' WHERE "state" = 'late';

-- 5. Dépenses : l'action de la demande de validation, quand il y en a une.
UPDATE "Expense" x SET "actionId" = v."actionId" FROM "ValidationRequest" v WHERE x."validationId" = v."id" AND v."actionId" IS NOT NULL;

-- 6. Libellés d'état par défaut (seulement s'ils valent encore l'ancien défaut).
UPDATE "RefValue" SET "label" = 'À développer' WHERE "family" = 'action_state' AND "code" = 'todo' AND "label" = 'À faire';
UPDATE "RefValue" SET "label" = 'Terminée'     WHERE "family" = 'action_state' AND "code" = 'done' AND "label" = 'Fait';
INSERT INTO "RefValue" ("id", "family", "code", "label", "color", "order")
SELECT 'ref_action_abandoned', 'action_state', 'abandoned', 'Abandonnée', 'muted', 3
WHERE NOT EXISTS (SELECT 1 FROM "RefValue" WHERE "family" = 'action_state' AND "code" = 'abandoned');

-- 7. Circuit de validation par défaut : deux niveaux ; libellés modifiables dans l'admin (TLST : « Coordination »).
INSERT INTO "FicheValidationLevel" ("id", "order", "label", "permission", "active") VALUES
  ('fvl_1', 1, 'Direction', 'fiche.validate.1', true),
  ('fvl_2', 2, 'CA', 'fiche.validate.2', true);

-- 8. Anciennes décisions → circuit. Auteur : la personne tracée dans l'historique, sinon une personne « direction ».
INSERT INTO "FicheValidation" ("id", "editionId", "levelId", "decision", "comment", "deciderId", "decidedAt")
SELECT 'fv1_' || e."id", e."id", 'fvl_1',
  CASE e."codirDecision" WHEN 'renew' THEN 'approved' WHEN 'adjust' THEN 'rework' ELSE 'refused' END,
  CASE e."codirDecision" WHEN 'stop' THEN 'arrêt décidé' ELSE NULL END,
  COALESCE(
    (SELECT c."authorId" FROM "ChangeLog" c WHERE c."editionId" = e."id" AND c."field" = 'codirDecision' ORDER BY c."createdAt" DESC LIMIT 1),
    (SELECT p."id" FROM "Person" p WHERE p."role" = 'director' ORDER BY p."order" LIMIT 1)),
  COALESCE(e."codirDate", e."updatedAt")
FROM "Edition" e WHERE e."codirDecision" IS NOT NULL;
INSERT INTO "FicheValidation" ("id", "editionId", "levelId", "decision", "comment", "deciderId", "decidedAt")
SELECT 'fv2_' || e."id", e."id", 'fvl_2', 'approved', NULL,
  (SELECT p."id" FROM "Person" p WHERE p."role" = 'director' ORDER BY p."order" LIMIT 1),
  COALESCE(e."boardDate", e."updatedAt")
FROM "Edition" e WHERE e."boardValidated" = true;

-- 9. Droits des nouveaux niveaux (Role.permissions = liste séparée par des virgules, même motif que 20260925120000_budget_plan) :
--    niveau 1 pour les rôles qui avaient « fiche.validation », niveau 2 pour la direction.
UPDATE "Role" SET "permissions" = CASE WHEN "permissions" = '' THEN 'fiche.validate.1' ELSE "permissions" || ',fiche.validate.1' END
  WHERE "permissions" LIKE '%fiche.validation%' AND "permissions" NOT LIKE '%fiche.validate.1%';
UPDATE "Role" SET "permissions" = CASE WHEN "permissions" = '' THEN 'fiche.validate.2' ELSE "permissions" || ',fiche.validate.2' END
  WHERE "code" = 'director' AND "permissions" NOT LIKE '%fiche.validate.2%';
```

`ChangeLog.createdAt` existe (vérifié) ; `Role.permissions` est une chaîne séparée par des virgules (vérifié).

- [ ] **Step 4: Appliquer et générer** : `npx prisma migrate dev` puis `npx prisma generate`. Expected : migration appliquée sur `pilote_dev`, client régénéré.

- [ ] **Step 5: Test de contrôle de la copie** `tests/unit/actions-migration.test.ts` — lit la base de dev **en lecture seule** (`DATABASE_URL` du `.env`) et vérifie les invariants ; il est ignoré si la base n'est pas joignable :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test("après migration : aucune action sans projet ni période, un jalon par ancienne date, un lien par ancien financeur", async (t) => {
  try { await prisma.$queryRaw`select 1`; } catch { t.skip("base de dev injoignable"); return; }
  const [noProject, noPeriod, dated, milestones, linked, links] = await Promise.all([
    prisma.action.count({ where: { projectId: null } }),
    prisma.action.count({ where: { OR: [{ startDate: null }, { endDate: null }] } }),
    prisma.action.count({ where: { milestoneDate: { not: null } } }),
    prisma.milestone.count({ where: { id: { startsWith: "ms_" } } }),
    prisma.action.count({ where: { fundingLineId: { not: null } } }),
    prisma.actionFunding.count(),
  ]);
  assert.equal(noProject, 0); assert.equal(noPeriod, 0);
  assert.ok(milestones >= dated); assert.ok(links >= linked);
  await prisma.$disconnect();
});
```

Ajouter ce test **hors** du motif `tests/unit/*.test.ts` lancé par `npm run check` s'il dépend d'une base (le placer dans `tests/migration/actions-migration.test.ts` et l'exécuter à la main : `npx tsx --test tests/migration/actions-migration.test.ts`). Expected : PASS sur `pilote_dev`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260927090000_actions_composantes tests/migration
git commit -m "Schéma : l'action devient une composante (période, jalons, financements), circuit de validation par niveaux

Migration expand : chaque action garde tout (jalon → jalon, financeur → lien, période = son année) ;
les anciennes décisions CODIR / CA deviennent des niveaux validés ; rien n'est supprimé.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Fonctions pures de l'action

**Files:**
- Create: `lib/actions.ts`, `tests/unit/actions.test.ts`

**Interfaces:**
- Produces (toutes exportées de `lib/actions.ts`) :
  - `type Period = { startDate: Date; endDate: Date }`
  - `runsIn(p: Period, year: number): boolean`
  - `defaultPeriod(year: number): Period`
  - `validPeriod(start: Date, end: Date): string | null` (message d'erreur ou null)
  - `spanLabel(p: Period, year: number): string | null` (« depuis 2025 · jusqu'en 2027 », null si dans l'année)
  - `yearsOf(p: Period): number[]`
  - `toRenew<A extends Period & { state: string }>(actions: A[], year: number): A[]`
  - `shiftYear(p: Period): Period`
  - `propagationTargets(action: Period & { projectId: string }, lines: { id: string; conventionId: string | null; editionYear: number; projectId: string }[], conventionId: string): string[]`
  - `fundingOverflow(line: { amountGranted: number | null; amountRequested: number | null }, amounts: (number | null)[]): number | null` (dépassement en €, null si aucun)
  - `actionAlerts(a: { name: string; state: string; endDate: Date; timeTarget: number | null; hours: number; milestones: { date: Date; done: boolean; label: string }[] }, today: Date): { kind: "milestone_overdue" | "action_overdue" | "time_over"; level: "danger" | "warning"; label: string; when?: Date }[]`
  - `balance(x: { fundings: (number | null)[]; expenses: { committed: number; spent: number }[]; hours: number; hourlyCost: number | null }): { income: number; spending: number; timeCost: number | null; gap: number }`

- [ ] **Step 1: Écrire les tests** `tests/unit/actions.test.ts` :

```ts
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

test("équilibre d'une action", () => {
  assert.deepEqual(balance({ fundings: [12_000, null, 3_000], expenses: [{ committed: 1_000, spent: 4_000 }], hours: 100, hourlyCost: 30 }), { income: 15_000, spending: 5_000, timeCost: 3_000, gap: 7_000 });
  assert.equal(balance({ fundings: [], expenses: [], hours: 10, hourlyCost: null }).timeCost, null);
});
```

- [ ] **Step 2: Lancer** `npx tsx --test tests/unit/actions.test.ts` — Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter** `lib/actions.ts` :

```ts
// L'action, composante du projet (spec 2026-09-26) : une période décide des années où elle apparaît. Fonctions pures, sans base.
export type Period = { startDate: Date; endDate: Date };

const yearOf = (d: Date) => d.getFullYear();

export function runsIn(p: Period, year: number): boolean {
  return yearOf(p.startDate) <= year && year <= yearOf(p.endDate);
}

export function defaultPeriod(year: number): Period {
  return { startDate: new Date(`${year}-01-01`), endDate: new Date(`${year}-12-31`) };
}

export function validPeriod(start: Date, end: Date): string | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Date invalide.";
  return end < start ? "La fin précède le début." : null;
}

export function yearsOf(p: Period): number[] {
  const out: number[] = [];
  for (let y = yearOf(p.startDate); y <= yearOf(p.endDate); y++) out.push(y);
  return out;
}

export function spanLabel(p: Period, year: number): string | null {
  const from = yearOf(p.startDate) < year ? `depuis ${yearOf(p.startDate)}` : null;
  const to = yearOf(p.endDate) > year ? `jusqu'en ${yearOf(p.endDate)}` : null;
  return [from, to].filter(Boolean).join(" · ") || null;
}

// Reconduire l'année `year` : les actions qui continuent l'année suivante sont déjà là ; on propose celles qui finissent.
export function toRenew<A extends Period & { state: string }>(actions: A[], year: number): A[] {
  return actions.filter((a) => a.state !== "abandoned" && runsIn(a, year) && yearOf(a.endDate) === year);
}

export function shiftYear(p: Period): Period {
  const s = new Date(p.startDate), e = new Date(p.endDate);
  s.setFullYear(s.getFullYear() + 1); e.setFullYear(e.getFullYear() + 1);
  return { startDate: s, endDate: e };
}

// Lier une action à une ligne d'un dossier : les lignes du même dossier, du même projet, sur les années que l'action couvre.
export function propagationTargets(action: Period & { projectId: string }, lines: { id: string; conventionId: string | null; editionYear: number; projectId: string }[], conventionId: string): string[] {
  return lines.filter((l) => l.conventionId === conventionId && l.projectId === action.projectId && runsIn(action, l.editionYear)).map((l) => l.id);
}

export function fundingOverflow(line: { amountGranted: number | null; amountRequested: number | null }, amounts: (number | null)[]): number | null {
  const ceiling = line.amountGranted ?? line.amountRequested;
  if (ceiling === null) return null;
  const sum = amounts.reduce<number>((s, a) => s + (a ?? 0), 0);
  return sum > ceiling + 0.001 ? sum - ceiling : null;
}

export function actionAlerts(a: { name: string; state: string; endDate: Date; timeTarget: number | null; hours: number; milestones: { date: Date; done: boolean; label: string }[] }, today: Date) {
  const out: { kind: "milestone_overdue" | "action_overdue" | "time_over"; level: "danger" | "warning"; label: string; when?: Date }[] = [];
  if (a.state === "done" || a.state === "abandoned") return out;
  for (const m of a.milestones) if (!m.done && m.date < today) out.push({ kind: "milestone_overdue", level: "danger", label: `Jalon dépassé : ${a.name} · ${m.label}`, when: m.date });
  if (a.endDate < today) out.push({ kind: "action_overdue", level: "danger", label: `Fin dépassée : ${a.name}`, when: a.endDate });
  if (a.timeTarget && a.hours > a.timeTarget) out.push({ kind: "time_over", level: "warning", label: `Temps dépassé : ${a.name} (${Math.round(a.hours)} h / ${a.timeTarget} h)` });
  return out;
}

export function balance(x: { fundings: (number | null)[]; expenses: { committed: number; spent: number }[]; hours: number; hourlyCost: number | null }) {
  const income = x.fundings.reduce<number>((s, a) => s + (a ?? 0), 0);
  const spending = x.expenses.reduce((s, e) => s + e.committed + e.spent, 0);
  const timeCost = x.hourlyCost === null ? null : Math.round(x.hours * x.hourlyCost);
  return { income, spending, timeCost, gap: income - spending - (timeCost ?? 0) };
}
```

Attention : `actionAlerts` ne doit pas écrire « Jalon », « Fin » avec un mot du vocabulaire ; « action » n'y apparaît pas (le nom de l'action est une donnée). Garder ces libellés tels quels.

Vérifier que l'engagé d'une dépense ne double pas son réalisé dans ce projet (`lib/budget.ts` : « réalisé + engagements restants, sans double comptage ») : si `committed` inclut déjà le facturé, utiliser le même calcul que `lib/budget.ts` (réalisé + engagements restants) au lieu de `committed + spent`, et adapter le test.

- [ ] **Step 4: Lancer** `npx tsx --test tests/unit/actions.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** (`lib/actions.ts`, `tests/unit/actions.test.ts`) : « Actions : période, années couvertes, reconduction, liens pluriannuels, alertes, équilibre (fonctions pures) ».

---

### Task 4: Le chargeur unique des actions d'une année

**Files:**
- Create: `lib/actions-db.ts`
- Modify: `lib/queries.ts` (lignes 9 et 58 : `actions: { include … }`), `app/edition/[id]/page.tsx`, `app/edition/[id]/types.ts`, `lib/alerts.ts` (type `EditionForAlerts`)

**Interfaces:**
- Consumes: `runsIn` (Task 3).
- Produces:
  - `type YearAction = Action & { owner: Person | null; people: (ActionPerson & { person: Person })[]; milestones: Milestone[]; fundings: (ActionFunding & { fundingLine: FundingLine & { funder: Organisation } })[]; hoursYear: number; hoursTotal: number; tasks: (Task & { person: Person })[] }`
  - `attachYearActions<E extends { id: string; projectId: string; year: number }>(editions: E[]): Promise<(E & { actions: YearAction[] })[]>` — une requête pour tous les projets, filtre `runsIn` en mémoire, heures de l'année par agrégation `TimeEntry` sur `[1/1/Y, 1/1/Y+1[`.
  - `projectActions(projectId: string): Promise<YearAction[]>` (toutes, heures totales).

- [ ] **Step 1: Écrire `lib/actions-db.ts`** :

```ts
import { prisma } from "./db";
import { runsIn } from "./actions";

const include = {
  owner: true,
  people: { include: { person: true } },
  milestones: { orderBy: { date: "asc" as const } },
  fundings: { include: { fundingLine: { include: { funder: true } } } },
  tasks: { where: { done: false }, include: { person: true }, orderBy: { dueDate: "asc" as const } },
};

// Les actions d'une année = celles du projet dont la période chevauche l'année (spec actions § 2). Seul chemin de lecture :
// ne plus lire `edition.actions` (relation d'origine, gardée jusqu'au contract).
export async function attachYearActions<E extends { id: string; projectId: string; year: number }>(editions: E[]) {
  if (editions.length === 0) return editions.map((e) => ({ ...e, actions: [] }));
  const projectIds = [...new Set(editions.map((e) => e.projectId))];
  const actions = await prisma.action.findMany({ where: { projectId: { in: projectIds } }, include, orderBy: [{ startDate: "asc" }, { order: "asc" }] });
  const years = [...new Set(editions.map((e) => e.year))];
  const minY = Math.min(...years), maxY = Math.max(...years);
  const hours = await prisma.timeEntry.groupBy({
    by: ["actionId"],
    where: { actionId: { in: actions.map((a) => a.id) }, date: { gte: new Date(`${minY}-01-01`), lt: new Date(`${maxY + 1}-01-01`) } },
    _sum: { hours: true },
  });
  // groupBy ne découpe pas par année : pour plusieurs années, relire par année (cas des pages multi-années).
  const byYear = new Map<string, number>();
  if (minY === maxY) for (const h of hours) byYear.set(`${h.actionId}|${minY}`, h._sum.hours ?? 0);
  else for (const y of years) {
    const hs = await prisma.timeEntry.groupBy({ by: ["actionId"], where: { actionId: { in: actions.map((a) => a.id) }, date: { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) } }, _sum: { hours: true } });
    for (const h of hs) byYear.set(`${h.actionId}|${y}`, h._sum.hours ?? 0);
  }
  const totals = await prisma.timeEntry.groupBy({ by: ["actionId"], where: { actionId: { in: actions.map((a) => a.id) } }, _sum: { hours: true } });
  const total = new Map(totals.map((t) => [t.actionId, t._sum.hours ?? 0]));
  return editions.map((e) => ({
    ...e,
    actions: actions
      .filter((a) => a.projectId === e.projectId && a.startDate && a.endDate && runsIn({ startDate: a.startDate, endDate: a.endDate }, e.year))
      .map((a) => ({ ...a, hoursYear: byYear.get(`${a.id}|${e.year}`) ?? 0, hoursTotal: total.get(a.id) ?? 0 })),
  }));
}

export async function projectActions(projectId: string) {
  const actions = await prisma.action.findMany({ where: { projectId }, include, orderBy: [{ startDate: "asc" }, { order: "asc" }] });
  const totals = await prisma.timeEntry.groupBy({ by: ["actionId"], where: { actionId: { in: actions.map((a) => a.id) } }, _sum: { hours: true } });
  const total = new Map(totals.map((t) => [t.actionId, t._sum.hours ?? 0]));
  return actions.map((a) => ({ ...a, hoursYear: 0, hoursTotal: total.get(a.id) ?? 0 }));
}

export type YearAction = Awaited<ReturnType<typeof attachYearActions>>[number]["actions"][number];
```

- [ ] **Step 2: Brancher `lib/queries.ts`** : retirer `actions: {…}` des deux `include` (lignes 9 et 58) ; après chargement, `const [withActions] = await attachYearActions([edition])` (et `attachYearActions(editions)` pour le portefeuille), en conservant l'ordre d'application existant avec `attachLedgerSpent`. Remplacer les lectures `a.timeEntries` par `a.hoursYear` (ligne 38 : `timeTarget` reste la somme des objectifs ; le consommé devient la somme des `hoursYear`).

- [ ] **Step 3: Adapter les types** : `app/edition/[id]/types.ts` (`TabCtx["e"]["actions"]` = `YearAction[]`) ; `lib/alerts.ts` `EditionForAlerts.actions` = `{ name; state; endDate: Date | null; timeTarget; hoursYear: number; milestones: { date; done; label }[] }[]`.

- [ ] **Step 4: `npx tsc --noEmit`** — Expected : erreurs seulement dans les fichiers traités aux tâches 5 à 8 (les lister dans le message de commit). Ne pas commiter un `tsc` rouge : si des erreurs restent hors de ce périmètre, les corriger ici par l'adaptation minimale (`a.hoursYear` au lieu de `a.timeEntries.reduce(...)`).

- [ ] **Step 5: `npm run check`** vert, commit : « Actions : un seul chargeur, les actions d'une année sont celles dont la période chevauche l'année ».

---

### Task 5: Tous les autres lecteurs d'actions passent par la période

**Files:** (liste exhaustive tirée de `grep -rln "prisma.action\.|actions: {|milestoneDate|isPublic|isCheckpoint" app lib components`)
- Modify: `lib/alerts.ts` (alertes et relances : `actionAlerts`, jalons), `lib/agenda.ts`, `lib/ics.ts`, `lib/people.ts`, `lib/traces.ts`, `lib/fiche-docx.ts`, `app/edition/[id]/export/route.ts`, `app/annuel/page.tsx`, `app/cafe/page.tsx`, `app/codir/page.tsx`, `app/ma-semaine/page.tsx`, `app/portefeuille/page.tsx`, `app/temps/page.tsx`, `app/admin/export/route.ts`, `app/admin/depart/[id]/page.tsx`, `app/demandes/page.tsx`, `app/demandes/request-row.tsx`, `app/materiel/pret/[id]/page.tsx`, `app/notes/share.tsx`, `app/edition/[id]/apercu.tsx`, `app/edition/[id]/achievements.tsx`, `app/edition/[id]/create-task-button.tsx`, `app/edition/[id]/request-validation-dialog.tsx`, `components/tasks/task-list.tsx`, `app/actions/tasks.ts`, `app/actions/proposals.ts`, `app/actions/requests.ts`, `app/actions/notes.ts`, `lib/ledger-db.ts`, `lib/ledger.ts`
- Test: `tests/unit/actions.test.ts` (ajouts pour les relances)

**Interfaces:**
- Consumes: `attachYearActions`, `projectActions`, `runsIn`, `actionAlerts` (Tasks 3-4).
- Produces: `computeAlerts` utilise `actionAlerts` ; `nextMilestone(e)` lit le prochain jalon non fait de toutes les actions de l'année ; relances (`kind: "milestone"`) = jalons.

- [ ] **Step 1: Alertes et relances.** Dans `lib/alerts.ts`, remplacer la boucle `for (const a of e.actions)` (l. 22-30) par `alerts.push(...actionAlerts({ ...a, endDate: a.endDate!, hours: a.hoursYear }, new Date()))` ; `nextMilestone` et les relances (l. 75, 124) itèrent sur `a.milestones.filter((m) => !m.done)` avec `m.date`, libellé `${a.name} · ${m.label}` ; la relance va au responsable de l'action (et aux personnes associées), plus au pilote. Ajouter au test unitaire un cas « jalon fait = pas de relance ».

- [ ] **Step 2: Agenda et ICS.** `lib/agenda.ts` (écran café, vue annuelle) : jalons non faits des actions des années en cours, avec le nom de l'action. `lib/ics.ts` : `publicEvents` = jalons `isPublic` (titre = nom de l'action · libellé du jalon, lieu = `venue`) ; `personEvents` = jalons des actions dont la personne est responsable ou associée + ses tâches datées ; `teamEvents` = jalons de toutes les actions en cours.

- [ ] **Step 3: Choix d'une action** (tâche, validation, réalisation, note, prêt, grand livre) : les listes d'actions proposées pour une année viennent d'`attachYearActions`, pas de `edition.actions`. Les commandes qui reçoivent un `actionId` avec un `editionId` (`app/actions/tasks.ts:50-55`, `proposals.ts`, `requests.ts`, `notes.ts`) vérifient `action.projectId === edition.projectId && runsIn(action, edition.year)` au lieu de `action.editionId === editionId` (même message d'erreur).

- [ ] **Step 4: Saisie du temps** (`app/temps/page.tsx:48-70`) : charger les années de la personne sans `actions` puis `attachYearActions` ; la ligne d'action affiche `objectif ${a.timeTarget} h · consommé ${a.hoursTotal} h` (objectif sur toute la période).

- [ ] **Step 5: Exports et Word.** `lib/fiche-docx.ts` et `app/edition/[id]/export/route.ts` : les actions de l'année avec leur période (`spanLabel`) et leurs jalons de l'année ; `app/admin/export/route.ts` : colonnes `projet, action, début, fin, état, responsable, jalons` (une ligne par action, jalons concaténés `date libellé`).

- [ ] **Step 6: Reste de la liste.** Pour chaque fichier restant, remplacer `a.milestoneDate` par le prochain jalon non fait (`a.milestones.find((m) => !m.done)?.date`) et `edition.actions` par le résultat du chargeur. `npx tsc --noEmit` doit être vert.

- [ ] **Step 7: Sentinelle.** Ajouter à `tests/unit/guardrails.test.ts` : aucun fichier de `app/`, `lib/`, `components/` ne contient `actions: {` dans un `include` d'édition ni ne lit `.milestoneDate`, `.isPublic` ou `.isCheckpoint` d'une action (exceptions : `prisma/`, `lib/actions-db.ts`, migration) :

```ts
test("les actions d'une année se lisent par attachYearActions, jamais par l'ancienne relation ni l'ancien jalon", () => {
  const offenders = sourceFiles(["app", "lib", "components"]).filter((f) => !f.endsWith("lib/actions-db.ts")).filter((f) => {
    const s = readFileSync(path.join(ROOT, f), "utf8");
    return /\bmilestoneDate\b|\.isCheckpoint\b|\bactions:\s*\{\s*(include|where|orderBy|select)/.test(s);
  });
  assert.deepEqual(offenders, []);
});
```

(`sourceFiles` : réutiliser l'utilitaire de parcours déjà présent dans `guardrails.test.ts`, ou l'écrire sur le modèle de `readdirSync` récursif de `scripts/check-vocab.mjs`.)

- [ ] **Step 8: `npm run check`** vert ; commit : « Actions : alertes, relances, agenda, exports et sélecteurs lisent la période et les jalons ».

---

## Lot B — La page de l'action et l'écriture

### Task 6: Commandes serveur de l'action et droits selon la période

**Files:**
- Create: `app/actions/actions.ts`, `tests/unit/action-rights.test.ts`
- Modify: `lib/rights.ts`, `lib/fields.ts` (`FIELDS.action`), `app/actions/fields.ts` (garde `model === "action"`), `app/actions/edition.ts` (`addAction` délègue à `createAction`, `duplicateAction` supprimé), `tests/unit/guardrails.test.ts` (liste figée des champs `saveField`)

**Interfaces:**
- Consumes: `defaultPeriod`, `validPeriod`, `runsIn` (Task 3).
- Produces:
  - `lib/rights.ts` : `canEditAction(me: Actor, ctx: { isPilot: boolean; isTeamOfCoveredYear: boolean; samePole: boolean; isOwnerOrAssociate: boolean }): boolean`
  - `app/actions/actions.ts` (toutes `Promise<Result>` où `type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }`) :
    - `createAction(editionId: string, input: { name: string; ownerId?: string | null; startDate?: string; endDate?: string }): Result<{ id: string }>`
    - `setActionPeriod(actionId: string, startDate: string, endDate: string)`
    - `addMilestone(actionId: string, input: { date: string; label: string; isPublic?: boolean; isCheckpoint?: boolean })` → `Result<{ id: string }>`
    - `updateMilestone(id: string, patch: { date?: string; label?: string; done?: boolean; venue?: string | null; participants?: string | null; isPublic?: boolean; isCheckpoint?: boolean })`
    - `deleteMilestone(id: string)`
    - `setActionPeople(actionId: string, personIds: string[])`
    - `deleteAction(actionId: string)` (refusée si heures saisies ou dépenses rattachées : proposer « abandonnée »)
  - `FIELDS.action` = `name ownerId timeTarget state description recurrence audience entrusted latitude` (plus `milestoneDate`, `venue`, `participants`, `isPublic`, `fundingLineId` : retirés).

- [ ] **Step 1: Test des droits** `tests/unit/action-rights.test.ts` :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { canEditAction } from "../../lib/rights";

const actor = (perms: string[]) => ({ id: "me", role: "pilot", permissions: new Set(perms) }) as never;

test("modifie une action : l'équipe d'une année couverte, le pilote, le responsable ou un associé ; pas un tiers", () => {
  const base = { isPilot: false, isTeamOfCoveredYear: false, samePole: false, isOwnerOrAssociate: false };
  assert.equal(canEditAction(actor(["edition.contribute"]), { ...base, isTeamOfCoveredYear: true }), true);
  assert.equal(canEditAction(actor([]), { ...base, isOwnerOrAssociate: true }), true);
  assert.equal(canEditAction(actor([]), { ...base, isPilot: true }), true);
  assert.equal(canEditAction(actor(["edition.contribute"]), base), false);
});
```

Adapter `actor(...)` à la forme réelle d'`Actor` (`lib/rights.ts`, fonction `has`) : lire comment les autres tests unitaires de droits (`tests/unit/proposals-permission.test.ts`) construisent un acteur et faire pareil.

- [ ] **Step 2: `npx tsx --test tests/unit/action-rights.test.ts`** — Expected: FAIL.

- [ ] **Step 3: Implémenter `canEditAction`** dans `lib/rights.ts` :

```ts
// Une action vit sur plusieurs années (spec actions § 2) : l'équipe de n'importe quelle année qu'elle couvre agit comme
// sur les actions d'une année ; son responsable et ses personnes associées aussi.
export function canEditAction(me: Actor, c: { isPilot: boolean; isTeamOfCoveredYear: boolean; samePole: boolean; isOwnerOrAssociate: boolean }): boolean {
  return c.isOwnerOrAssociate || canEditActions(me, c.isPilot, c.isTeamOfCoveredYear, c.samePole);
}
```

- [ ] **Step 4: Écrire `app/actions/actions.ts`** : un contexte commun, puis les commandes.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditAction } from "@/lib/rights";
import { inMyPole } from "@/lib/scope";
import { defaultPeriod, validPeriod, runsIn } from "@/lib/actions";
import { V, cap, ce, adj } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Droits sur une action : chargés une fois, avant toute lecture ou écriture (authentification ≠ autorisation).
async function actionCtx(actionId: string) {
  const me = await getCurrentPerson();
  const a = await prisma.action.findUnique({ where: { id: actionId }, include: { people: true, project: { include: { secondaryPoles: true, editions: { include: { team: true } } } } } });
  if (!a || !a.project || !a.startDate || !a.endDate) return { me, a: null, can: false };
  const period = { startDate: a.startDate, endDate: a.endDate };
  const isTeamOfCoveredYear = a.project.editions.some((e) => runsIn(period, e.year) && e.team.some((t) => t.personId === me.id));
  const can = canEditAction(me, { isPilot: a.project.pilotId === me.id, isTeamOfCoveredYear, samePole: inMyPole(me, a.project), isOwnerOrAssociate: a.ownerId === me.id || a.people.some((p) => p.personId === me.id) });
  return { me, a, can };
}

const refresh = (actionId: string) => { revalidatePath(`/action/${actionId}`); revalidatePath("/", "layout"); };

export async function createAction(editionId: string, input: { name: string; ownerId?: string | null; startDate?: string; endDate?: string }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: true } });
  if (!e) return { ok: false, error: `${cap(V.edition)} introuvable.` };
  const can = canEditAction(me, { isPilot: e.project.pilotId === me.id, isTeamOfCoveredYear: e.team.some((t) => t.personId === me.id), samePole: inMyPole(me, e.project), isOwnerOrAssociate: false });
  if (!can) return { ok: false, error: `Vous ne pouvez pas ajouter d'${V.action.one} ici.` };
  const def = defaultPeriod(e.year);
  const start = input.startDate ? new Date(input.startDate) : def.startDate;
  const end = input.endDate ? new Date(input.endDate) : def.endDate;
  const bad = validPeriod(start, end);
  if (bad) return { ok: false, error: bad };
  if (input.ownerId && !(await prisma.person.findFirst({ where: { id: input.ownerId, active: true }, select: { id: true } }))) return { ok: false, error: "Responsable introuvable." };
  const count = await prisma.action.count({ where: { projectId: e.projectId } });
  const a = await prisma.action.create({ data: {
    editionId, projectId: e.projectId, startDate: start, endDate: end, order: count, state: "todo",
    name: input.name.trim() || cap(adj(V.action, "nouveau", "nouvelle")),
    ownerId: input.ownerId ?? (e.project.pilotId === me.id ? me.id : e.project.pilotId),
  } });
  refresh(a.id);
  return { ok: true, data: { id: a.id } };
}

export async function setActionPeriod(actionId: string, startDate: string, endDate: string): Promise<Result> {
  const { a, can } = await actionCtx(actionId);
  if (!a) return { ok: false, error: `${cap(V.action)} introuvable.` };
  if (!can) return { ok: false, error: `Vous ne pouvez pas modifier ${ce(V.action)}.` };
  const s = new Date(startDate), e = new Date(endDate);
  const bad = validPeriod(s, e);
  if (bad) return { ok: false, error: bad };
  await prisma.action.update({ where: { id: actionId }, data: { startDate: s, endDate: e } });
  refresh(actionId);
  return { ok: true };
}

export async function addMilestone(actionId: string, input: { date: string; label: string; isPublic?: boolean; isCheckpoint?: boolean }): Promise<Result<{ id: string }>> {
  const { a, can } = await actionCtx(actionId);
  if (!a) return { ok: false, error: `${cap(V.action)} introuvable.` };
  if (!can) return { ok: false, error: `Vous ne pouvez pas modifier ${ce(V.action)}.` };
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Date invalide." };
  const count = await prisma.milestone.count({ where: { actionId } });
  const m = await prisma.milestone.create({ data: { actionId, date, label: input.label.trim() || "Jalon", isPublic: Boolean(input.isPublic), isCheckpoint: Boolean(input.isCheckpoint), order: count } });
  refresh(actionId);
  return { ok: true, data: { id: m.id } };
}

export async function updateMilestone(id: string, patch: { date?: string; label?: string; done?: boolean; venue?: string | null; participants?: string | null; isPublic?: boolean; isCheckpoint?: boolean }): Promise<Result> {
  const m = await prisma.milestone.findUnique({ where: { id } });
  if (!m) return { ok: false, error: "Jalon introuvable." };
  const { can } = await actionCtx(m.actionId);
  if (!can) return { ok: false, error: `Vous ne pouvez pas modifier ${ce(V.action)}.` };
  const date = patch.date ? new Date(patch.date) : undefined;
  if (date && Number.isNaN(date.getTime())) return { ok: false, error: "Date invalide." };
  await prisma.milestone.update({ where: { id }, data: {
    ...(date ? { date } : {}), ...(patch.label !== undefined ? { label: patch.label.trim() || m.label } : {}),
    ...(patch.done !== undefined ? { done: patch.done, doneAt: patch.done ? new Date() : null } : {}),
    ...(patch.venue !== undefined ? { venue: patch.venue } : {}), ...(patch.participants !== undefined ? { participants: patch.participants } : {}),
    ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}), ...(patch.isCheckpoint !== undefined ? { isCheckpoint: patch.isCheckpoint } : {}),
  } });
  refresh(m.actionId);
  return { ok: true };
}

export async function deleteMilestone(id: string): Promise<Result> {
  const m = await prisma.milestone.findUnique({ where: { id } });
  if (!m) return { ok: false, error: "Jalon introuvable." };
  const { can } = await actionCtx(m.actionId);
  if (!can) return { ok: false, error: `Vous ne pouvez pas modifier ${ce(V.action)}.` };
  await prisma.milestone.delete({ where: { id } });
  refresh(m.actionId);
  return { ok: true };
}

export async function setActionPeople(actionId: string, personIds: string[]): Promise<Result> {
  const { a, can } = await actionCtx(actionId);
  if (!a) return { ok: false, error: `${cap(V.action)} introuvable.` };
  if (!can) return { ok: false, error: `Vous ne pouvez pas modifier ${ce(V.action)}.` };
  const ids = [...new Set(personIds)];
  const found = await prisma.person.count({ where: { id: { in: ids }, active: true } });
  if (found !== ids.length) return { ok: false, error: "Personne introuvable." };
  // Frontière de transaction : remplacer la liste d'un coup, jamais à moitié.
  await prisma.$transaction([prisma.actionPerson.deleteMany({ where: { actionId } }), prisma.actionPerson.createMany({ data: ids.map((personId) => ({ actionId, personId })) })]);
  refresh(actionId);
  return { ok: true };
}

export async function deleteAction(actionId: string): Promise<Result> {
  const { a, can } = await actionCtx(actionId);
  if (!a) return { ok: false, error: `${cap(V.action)} introuvable.` };
  if (!can) return { ok: false, error: `Vous ne pouvez pas modifier ${ce(V.action)}.` };
  const [hours, expenses] = await Promise.all([prisma.timeEntry.count({ where: { actionId } }), prisma.expense.count({ where: { actionId } })]);
  if (hours || expenses) return { ok: false, error: `Des heures ou des dépenses y sont rattachées : passez ${ce(V.action)} en « abandonnée » plutôt.` };
  await prisma.action.delete({ where: { id: actionId } });
  revalidatePath("/", "layout");
  return { ok: true };
}
```

Vérifier les cascades avant `deleteAction` : `Task.actionId` et `Achievement.actionId` sont `SetNull`, `ActionFunding`, `Milestone`, `ActionPerson` sont `Cascade` ; `ValidationRequest.actionId` : lire la relation dans le schéma ; si elle n'est pas `SetNull`, compter les validations et refuser comme pour les heures.

- [ ] **Step 5: Brancher la garde `saveField`** (`app/actions/fields.ts`, branche `model === "action"`) : remplacer `editionContext(a.editionId…)` par le calcul de `actionCtx` (extraire `actionCtx` dans `lib/actions-rights-db.ts` si `fields.ts` ne peut pas importer depuis un fichier `"use server"` — une fonction serveur non exportée par `"use server"` est préférable : la placer dans `lib/actions-rights-db.ts` et l'importer depuis les deux fichiers). Mettre à jour `FIELDS.action` (`lib/fields.ts`) et la liste figée de `tests/unit/guardrails.test.ts` (ligne 26) : `"name ownerId timeTarget state description recurrence audience entrusted latitude"`. Relire la règle SEC-27 (`.agents/rules/securite-autorisation.md`) avant de modifier la liste.

- [ ] **Step 6: `addAction` et `duplicateAction`** (`app/actions/edition.ts:29-39`, `351-363`) : `addAction(editionId, name, opts)` appelle `createAction(editionId, { name, ownerId: opts?.ownerId })` (les options `milestoneDate`/`isCheckpoint` venaient de la délégation, supprimée au lot E : les retirer) ; supprimer `duplicateAction` et ses appels (`app/edition/[id]/action-extras.tsx`).

- [ ] **Step 7: Tests unitaires + `npm run check`** vert ; commit : « Actions : commandes gardées (période, jalons, personnes associées) et droits sur toute la période ».

---

### Task 7: La page de l'action, l'onglet Actions, la fiche du projet

**Files:**
- Create: `app/action/[id]/page.tsx`, `app/action/[id]/milestones.tsx`, `app/action/[id]/people-picker.tsx`, `app/action/[id]/period-form.tsx`
- Modify: `app/edition/[id]/actions-tab.tsx` (tableau), `app/edition/[id]/action-extras.tsx` (supprimé), `app/edition/[id]/add-forms.tsx` (`AddActionForm` → `createAction`), `app/projets/[id]/page.tsx` (section « Actions »), `components/shell/section-icons.tsx` (`/^\/action\//` → `FileSignature`), `components/shell/breadcrumb.tsx`

**Interfaces:**
- Consumes: commandes de la Task 6, `attachYearActions`/`projectActions` (Task 4), `spanLabel`, `yearsOf` (Task 3).
- Produces: route `/action/[id]?annee=2026|tout` ; `data-testid` : `action-page`, `action-period`, `milestone-row-{i}`, `milestone-add`, `action-people`, `actions-table`, `project-actions`.

- [ ] **Step 1: Page `app/action/[id]/page.tsx`** (composant serveur) :
  1. `getCurrentPerson()` ; charger l'action (`prisma.action.findUnique` avec `project`, `owner`, `people.person`, `milestones`, `fundings.fundingLine.funder`, `tasks.person`, `achievements`, `indicators`, `expenses`) ; `notFound()` si absente ; vérifier la lecture comme pour une année du projet (`inMyScope` / `isTransversal`, `lib/scope.ts`) — sinon afficher la bande « hors de votre périmètre : vous consultez » comme `app/edition/[id]/page.tsx:137`.
  2. `annee` : `searchParams.annee` = `"tout"` ou un nombre parmi `yearsOf(period)` ; défaut = l'année courante si couverte, sinon la première.
  3. En-tête : `<h1>` nom (AutoField `model="action" field="name"`), badge d'état, ligne `période` (`fmtDate` début → fin) + `spanLabel` + récurrence ; lien retour « ← {projet} · {année} » vers `/edition/{editionId de l'année affichée}?onglet=actions`.
  4. Sections (`<Section>` de `components/common/section.tsx`) : « Contenu et public » (AutoField `description`, `audience`, `recurrence`) ; « Ce qui est confié » (AutoField `entrusted`, `latitude`, libellés « Ce qui est confié », « Marge de décision ») ; « Jalons » (`<Milestones>`) ; « Tâches » (liste des tâches ouvertes : libellé, personne, échéance ; bouton `CreateTaskButton` existant avec l'action présélectionnée) ; « Heures » (par personne, filtrées par l'année choisie ou toute la période, face à `timeTarget`) ; « Réalisations » (filtrées par année) ; « Indicateurs » (ceux dont `actionId` = l'action). La section « Financements et équilibre » est ajoutée à la Task 9.
  5. Sélecteur d'année : des liens `?annee=2025`, `?annee=2026`, `?annee=tout` (même style que `EditionPicker`).

- [ ] **Step 2: `milestones.tsx`** (client) : une ligne par jalon — case « fait » (`updateMilestone(id, { done })`), date, libellé, lieu, participants, cases « public » et « point de contrôle » ; bouton supprimer ; formulaire d'ajout (date + libellé, `addMilestone`) ; `useRun` et `toast` comme dans `app/conventions/[id]/allocations.tsx`. Libellés : « Jalons », « Ajouter un jalon », « Fait », « Public (agenda du site) », « Point de contrôle ».

- [ ] **Step 3: `period-form.tsx`** : deux champs date + « Enregistrer » (`setActionPeriod`), erreur affichée telle que renvoyée. **`people-picker.tsx`** : sur le modèle de `app/edition/[id]/team-picker.tsx`, liste des personnes actives (y compris `tracksTime = false`), `setActionPeople`.

- [ ] **Step 4: Onglet Actions** (`actions-tab.tsx`) : tableau `actions-table` — colonnes Nom (lien `/action/{id}?annee={e.year}`), Responsable, Période (`fmtDate` début–fin, + `spanLabel` en petit), Prochain jalon (date + libellé, rouge si dépassé), État, Heures {année} / objectif (`TimeCell` existant avec `consumed = a.hoursYear`). Supprimer `ActionPanel` et le contenu du panneau (déplacé sur la page). Le formulaire « Ajouter » crée l'action et **ouvre sa page** (`router.push`).

- [ ] **Step 5: Fiche du projet** (`app/projets/[id]/page.tsx`) : sous « Années », une `<Section title={cap(pl(V.action))} testId="project-actions">` qui liste `projectActions(p.id)` : nom (lien), période, état, heures totales.

- [ ] **Step 6: Vérification visuelle.** `preview_start` (config `pilote`), se connecter avec un compte de la base de dev, ouvrir une année → onglet Actions → une action → page ; vérifier l'absence d'erreur console (`read_console_messages`). Capture d'écran pour le compte rendu.

- [ ] **Step 7: `npm run check`** ; commit : « Actions : une page par action (période, jalons, confié, tâches, heures), onglet et fiche projet refaits ».

---

### Task 8: La frise

**Files:**
- Create: `app/edition/[id]/timeline.tsx`
- Modify: `app/edition/[id]/actions-tab.tsx` (retirer l'ancienne `Timeline`)

**Interfaces:**
- Consumes: `YearAction` (Task 4) ; livrables de l'année (`e.fundingLines[].deliverables`).
- Produces: `<Timeline year actions deliverables refs />`, `data-testid="timeline"`, une barre `timeline-bar-{i}` par action.

- [ ] **Step 1: Écrire `timeline.tsx`** : même grille de 12 mois et trait « aujourd'hui » que l'ancienne fonction (`actions-tab.tsx`, fonction `Timeline`) ; pour chaque action : une barre de `max(start, 1/1)` à `min(end, 31/12)` (en % de l'année, via `dayjs(...).diff(start, "day") / total`), couleur selon l'état (`done` : `bg-mint/50`, `doing` : `bg-primary/60`, `todo` : `bg-muted-foreground/30`, `abandoned` : hachuré `bg-muted`), flèche « ◂ » / « ▸ » si la période déborde ; ses jalons de l'année en points (rouge si dépassé et non fait) avec `title` = libellé et date ; les livrables de l'année en losanges sur une dernière ligne « Livrables ». Hauteur de ligne 28 px, noms tronqués comme l'ancienne frise.

- [ ] **Step 2: Brancher** dans `actions-tab.tsx` à la place de l'ancienne ; « Aucun jalon daté pour l'instant » devient « Aucune {action} cette année » (`aucun(V.action)`).

- [ ] **Step 3: Vérification visuelle** (preview, une année avec une action qui déborde) ; `npm run check` ; commit : « Frise : une barre par action, ses jalons et les livrables de l'année ».

---

## Lot C — Financements des actions

### Task 9: Liens action ↔ lignes, propagation, équilibre

**Files:**
- Modify: `app/actions/actions.ts` (commandes de financement), `app/actions/edition.ts` (`addFundingLineFromConvention`, `renewEdition` : liens des nouvelles lignes ; suppression d'une ligne : garde), `lib/alerts.ts` (alerte de dépassement), `app/action/[id]/page.tsx` (section)
- Create: `app/action/[id]/fundings.tsx`
- Test: `tests/unit/actions.test.ts` (déjà couvert par `propagationTargets`, `fundingOverflow`, `balance`)

**Interfaces:**
- Consumes: `propagationTargets`, `fundingOverflow`, `balance` (Task 3), `actionCtx` (Task 6).
- Produces:
  - `linkFunding(actionId: string, fundingLineId: string, amount: number | null): Result<{ linked: number }>` (nombre de lignes liées, propagation comprise)
  - `setFundingAmount(actionId: string, fundingLineId: string, amount: number | null): Result`
  - `unlinkFunding(actionId: string, fundingLineId: string): Result`
  - `linkNewLineToRunningActions(tx, line: { id: string; conventionId: string | null; editionId: string }): Promise<void>` (interne, `lib/actions-funding-db.ts`)

- [ ] **Step 1: Commandes** dans `app/actions/actions.ts` :

```ts
export async function linkFunding(actionId: string, fundingLineId: string, amount: number | null): Promise<Result<{ linked: number }>> {
  const { a, can } = await actionCtx(actionId);
  if (!a) return { ok: false, error: `${cap(V.action)} introuvable.` };
  if (!can) return { ok: false, error: `Vous ne pouvez pas modifier ${ce(V.action)}.` };
  const line = await prisma.fundingLine.findUnique({ where: { id: fundingLineId }, include: { edition: true } });
  if (!line || line.edition.projectId !== a.projectId) return { ok: false, error: "Ligne de financement introuvable sur ce projet." };
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return { ok: false, error: "Montant invalide." };
  let targets = [line.id];
  if (line.conventionId) {
    const sameDossier = await prisma.fundingLine.findMany({ where: { conventionId: line.conventionId }, include: { edition: { select: { year: true, projectId: true } } } });
    targets = propagationTargets({ projectId: a.projectId!, startDate: a.startDate!, endDate: a.endDate! }, sameDossier.map((l) => ({ id: l.id, conventionId: l.conventionId, editionYear: l.edition.year, projectId: l.edition.projectId })), line.conventionId);
    if (!targets.includes(line.id)) targets.push(line.id);
  }
  // Frontière de transaction : la ligne choisie (avec son montant) et ses sœurs du même dossier, ensemble.
  await prisma.$transaction(targets.map((id) => prisma.actionFunding.upsert({
    where: { actionId_fundingLineId: { actionId, fundingLineId: id } },
    create: { actionId, fundingLineId: id, amount: id === line.id ? amount : null },
    update: id === line.id ? { amount } : {},
  })));
  refresh(actionId);
  return { ok: true, data: { linked: targets.length } };
}
```

`setFundingAmount` (garde identique, `update` du lien, montant ≥ 0 ou null) et `unlinkFunding` (supprime **seulement** ce lien) sur le même modèle.

- [ ] **Step 2: Lignes créées ensuite.** Écrire `lib/actions-funding-db.ts` :

```ts
import type { Prisma } from "@prisma/client";
import { runsIn } from "./actions";

// Une nouvelle ligne d'un dossier (rattachement d'une année, reconduction) rejoint les actions du projet déjà financées
// par ce dossier et qui courent cette année-là (spec actions § 2).
export async function linkNewLineToRunningActions(tx: Prisma.TransactionClient, line: { id: string; conventionId: string | null; editionId: string }) {
  if (!line.conventionId) return;
  const edition = await tx.edition.findUnique({ where: { id: line.editionId }, select: { year: true, projectId: true } });
  if (!edition) return;
  const actions = await tx.action.findMany({ where: { projectId: edition.projectId, fundings: { some: { fundingLine: { conventionId: line.conventionId } } } } });
  const running = actions.filter((a) => a.startDate && a.endDate && runsIn({ startDate: a.startDate, endDate: a.endDate }, edition.year));
  for (const a of running) await tx.actionFunding.upsert({ where: { actionId_fundingLineId: { actionId: a.id, fundingLineId: line.id } }, create: { actionId: a.id, fundingLineId: line.id }, update: {} });
}
```

Appeler depuis `addFundingLineFromConvention` (après création ou reprise de la ligne, dans une transaction) et depuis `renewEdition` (Task 12) pour chaque ligne gardée sur un dossier.

- [ ] **Step 3: Garde de suppression des lignes.** Partout où une ligne est supprimée (`detachFundingLineFromConvention` l. 313-325, suppression directe de ligne s'il en existe une : `grep -n "fundingLine.delete" app/actions`), remplacer `line.actions.length === 0` par `line.actionFundings.length === 0` (inclure `actionFundings` dans la lecture).

- [ ] **Step 4: Alerte de dépassement** dans `computeAlerts` (`lib/alerts.ts`) : pour chaque ligne de l'année, `fundingOverflow(line, line.actionFundings.map((x) => x.amount))` ; si non nul : `{ kind: "funding_over", level: "warning", label: \`Montants des ${pl(V.action)} au-delà de l'obtenu : ${f.funder.name} (+${fmtEuro(over)})\` }`. Charger `actionFundings: { select: { amount: true } }` dans les lignes de `loadEdition`. Ajouter `"funding_over"` au type `AlertKind`.

- [ ] **Step 5: Section de la page de l'action** `fundings.tsx` : liste des liens (financeur · dispositif · année de la ligne · montant éditable `setFundingAmount` · retirer `unlinkFunding`) ; ajout : sélecteur des lignes du projet (toutes années couvertes par l'action), montant facultatif, `linkFunding` ; toast « Rattachée à {n} ligne(s) du dossier » si `linked > 1`. En dessous, l'équilibre (`balance`) pour l'année affichée ou toute la période : Recettes · Dépenses · Temps valorisé (si module `budget`, coût horaire de `lib/budget-plan.ts` — lire la fonction qui calcule le personnel et réutiliser son coût horaire) · Écart.

- [ ] **Step 6: `npm run check`** ; commit : « Financements : une action se rattache à plusieurs lignes, avec montant ; les dossiers pluriannuels suivent ».

---

### Task 10: « Actions financées » sur les lignes et les dossiers, export du temps

**Files:**
- Create: `components/funding/funded-actions.tsx`, `app/financements/export/route.ts`
- Modify: `components/funding/line-panel.tsx`, `app/conventions/[id]/page.tsx`

**Interfaces:**
- Produces: `<FundedActions lines={…} year />` ; route `GET /financements/export?ligne=<id>` ou `?dossier=<id>&annee=2026` → CSV `projet;action;personne;heures;montant`.

- [ ] **Step 1: `funded-actions.tsx`** (serveur) : pour une ou plusieurs lignes, les actions liées (`actionFundings.action`), et pour chacune, sur l'année de la ligne : heures par personne (`timeEntry.groupBy` par `personId` sur l'année), jalons faits dans l'année, réalisations de l'année (compte), montant du lien. `data-testid="funded-actions"`.

- [ ] **Step 2: Brancher** dans `line-panel.tsx` (panneau de ligne) et `app/conventions/[id]/page.tsx` (toutes les lignes du dossier, regroupées par année).

- [ ] **Step 3: Export** `app/financements/export/route.ts` : garde **avant** toute lecture avec `exportDenial(req, "<droit financements>")` de `lib/export-auth.ts` (même droit que les autres exports financiers : lire `app/matrice/export` et reprendre exactement sa garde) ; CSV via `lib/csv.ts` (neutralisation des formules : SEC déjà en place) ; une ligne par action × personne × année.

- [ ] **Step 4: Test de sécurité** : ajouter à `tests/security/` (sur le modèle d'un test d'export existant, `grep -ln "export" tests/security`) : sans session ni jeton → 401 ; contributeur sans le droit → 403.

- [ ] **Step 5: `npm run check`** ; commit : « Financements : les actions financées et leurs heures, sur la ligne et le dossier, exportables ».

---

### Task 11: Dépenses et indicateurs rattachés à une action

**Files:**
- Modify: `app/actions/edition.ts` (`addExpense`, et la création de dépense à l'approbation d'un devis dans `decideValidation` : `actionId` = celui de la validation), `lib/fields.ts` (`expense.actionId`, `indicator.actionId`), `app/actions/fields.ts` (garde : l'action choisie appartient au projet de l'année et court cette année — sinon refus), `tests/unit/guardrails.test.ts` (liste figée), `app/edition/[id]/budget.tsx` (colonne Action), onglet Actions (indicateurs : sélecteur d'action)

- [ ] **Step 1: Test unitaire de la garde** (dans `tests/unit/savefield-invariants.test.ts`, sur le modèle des cas existants) : rattacher une dépense à une action d'un autre projet → refus.
- [ ] **Step 2: Implémenter** la garde dans `app/actions/fields.ts` (champ `actionId` des modèles `expense` et `indicator`) avec `runsIn`.
- [ ] **Step 3: Interfaces** : colonne « Action » (sélecteur des actions de l'année) dans la liste des dépenses ; sélecteur d'action sur chaque indicateur ; la page de l'action liste ses dépenses (équilibre) et ses indicateurs.
- [ ] **Step 4: `npm run check`** ; commit : « Budget : dépenses et indicateurs rattachables à une action ».

---

## Lot D — Reconduction, préparer l'année suivante, validation par niveaux, noms

### Task 12: Reconduction sans doublons, « Préparer 2027 »

**Files:**
- Modify: `app/actions/edition.ts` (`renewEdition` l. 195-239, `batchCreateEditions` l. 252-271), `app/edition/[id]/renew-dialog.tsx`, `app/seminaire/page.tsx`, `app/seminaire/batch-form.tsx`, `lib/navigation.ts` (libellé), `components/shell/breadcrumb.tsx`
- Test: `tests/unit/actions.test.ts` (déjà : `toRenew`, `shiftYear`)

**Interfaces:**
- Consumes: `toRenew`, `shiftYear` (Task 3), `linkNewLineToRunningActions` (Task 9).
- Produces: `renewEdition(editionId: string, opts?: { actionIds?: string[] }): Result<{ id: string }>` — `actionIds` = actions à recopier (défaut : `toRenew(...)`).

- [ ] **Step 1: `renewEdition`** : retirer `actions: { create … }` de la création ; dans **une transaction** : créer l'année (champs actuels), puis pour chaque action retenue, créer la copie (`projectId`, `editionId` = nouvelle année, période `shiftYear`, `state: "todo"`, mêmes `name`, `ownerId`, `description`, `audience`, `recurrence`, `entrusted`, `latitude`, `timeTarget`) avec ses jalons décalés d'un an (`done: false`) et ses personnes associées ; lier chaque copie aux lignes recréées **du même financeur** que ses liens d'origine ; appeler `linkNewLineToRunningActions(tx, line)` pour chaque ligne gardée sur un dossier. La changeLog existante reste.
- [ ] **Step 2: Dialogue de reconduction** (`renew-dialog.tsx`) : liste « {Actions} qui finissent en {année} » cochées par défaut (`toRenew`), et une phrase « Les {actions} qui continuent en {année+1} sont déjà là : {noms} ».
- [ ] **Step 3: « Préparer {année} »** : dans `batchCreateEditions`, ne plus écrire `codirDecision` / `codirDate` ; créer une `Decision` sur l'année source (`instance` : première valeur de la liste `decision_instance`, ou celle choisie dans le formulaire ; `body` : `Reconduit pour ${year}` / `Ajusté pour ${year}` / `Arrêté pour ${year}`, `authorId` : moi) ; « arrêté » : après confirmation dans le formulaire (case « ranger le projet »), `project.archived = true`. Le droit reste `isCodir(me)`. Titre de page et entrée de menu : `Préparer ${target}` ; l'adresse `/seminaire` ne change pas.
- [ ] **Step 4: Recette** : `tests/recette-3-validation-seminaire.spec.ts` — adapter (décisions consignées, pas de doublon d'action continue). Lancer cette spec **seulement avec l'accord de Gaël** (reset de la base de test).
- [ ] **Step 5: `npm run check`** ; commit : « Reconduction : les actions qui continuent ne sont pas recopiées ; « Préparer 2027 » consigne ses décisions ».

---

### Task 13: Circuit de validation de la fiche par niveaux

**Files:**
- Create: `lib/fiche-validation.ts`, `app/actions/fiche-validation.ts`, `tests/unit/fiche-validation.test.ts`, `app/edition/[id]/fiche-validation.tsx`, `app/admin/fiche-levels.tsx`
- Modify: `lib/lock.ts`, `app/edition/[id]/fiche.tsx` (couche 4), `app/edition/[id]/fiche-layer.tsx`, `lib/permissions.ts` (`fiche.validate.1`, `fiche.validate.2` ; `fiche.validation` gardé jusqu'au contract), `app/admin/page.tsx` (section « Circuit de validation des fiches » dans Paramètres), `lib/queries.ts` (charger `ficheValidations` avec `level` et `decider`)

**Interfaces:**
- Produces:
  - `lib/fiche-validation.ts` :
    - `type Level = { id: string; order: number; label: string; permission: string; active: boolean }`
    - `type Decision = { levelId: string; decision: "approved" | "rework" | "refused"; decidedAt: Date }`
    - `currentRound(decisions: Decision[]): Decision[]` (décisions depuis le dernier « rework »)
    - `nextLevel(levels: Level[], decisions: Decision[]): Level | null`
    - `statusAfter(levels: Level[], decisions: Decision[], current: string): string` (`validated` si tous les niveaux actifs approuvés dans le tour courant, `rechallenged` si le dernier est `rework`, sinon `current`)
    - `isCircuitComplete(levels, decisions): boolean`
  - `app/actions/fiche-validation.ts` : `decideFiche(editionId: string, decision: "approved" | "rework" | "refused", comment: string): Result` ; `saveLevels(levels: { id?: string; label: string; permission: string; active: boolean }[]): Result` (admin).

- [ ] **Step 1: Tests** `tests/unit/fiche-validation.test.ts` :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextLevel, statusAfter, isCircuitComplete, currentRound } from "../../lib/fiche-validation";

const L = [{ id: "l1", order: 1, label: "Direction", permission: "fiche.validate.1", active: true }, { id: "l2", order: 2, label: "CA", permission: "fiche.validate.2", active: true }];
const d = (levelId: string, decision: "approved" | "rework" | "refused", day: number) => ({ levelId, decision, decidedAt: new Date(2026, 0, day) });

test("les niveaux se décident dans l'ordre", () => {
  assert.equal(nextLevel(L, [])?.id, "l1");
  assert.equal(nextLevel(L, [d("l1", "approved", 1)])?.id, "l2");
  assert.equal(nextLevel(L, [d("l1", "approved", 1), d("l2", "approved", 2)]), null);
});

test("validée au dernier niveau ; « à retravailler » re-challenge et fait repartir du premier niveau", () => {
  assert.equal(statusAfter(L, [d("l1", "approved", 1), d("l2", "approved", 2)], "proposed"), "validated");
  const rework = [d("l1", "approved", 1), d("l2", "rework", 2)];
  assert.equal(statusAfter(L, rework, "proposed"), "rechallenged");
  assert.deepEqual(currentRound(rework), []);
  assert.equal(nextLevel(L, rework)?.id, "l1");
  assert.equal(isCircuitComplete(L, [...rework, d("l1", "approved", 3), d("l2", "approved", 4)]), true);
});

test("un refus laisse le statut ; un niveau inactif est sauté", () => {
  assert.equal(statusAfter(L, [d("l1", "refused", 1)], "proposed"), "proposed");
  const L2 = [L[0], { ...L[1], active: false }];
  assert.equal(statusAfter(L2, [d("l1", "approved", 1)], "proposed"), "validated");
});
```

- [ ] **Step 2: `npx tsx --test tests/unit/fiche-validation.test.ts`** — Expected: FAIL.

- [ ] **Step 3: Implémenter `lib/fiche-validation.ts`** :

```ts
// Circuit de validation de la fiche (spec vocabulaire § 3) : des niveaux réglés par instance, décidés dans l'ordre.
export type Level = { id: string; order: number; label: string; permission: string; active: boolean };
export type Decision = { levelId: string; decision: "approved" | "rework" | "refused"; decidedAt: Date };

const active = (levels: Level[]) => levels.filter((l) => l.active).sort((a, b) => a.order - b.order);
const byDate = (ds: Decision[]) => [...ds].sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime());

// Un « à retravailler » remet le circuit à zéro : seules comptent les décisions prises après le dernier.
export function currentRound(decisions: Decision[]): Decision[] {
  const sorted = byDate(decisions);
  const last = sorted.map((d) => d.decision).lastIndexOf("rework");
  return sorted.slice(last + 1);
}

export function nextLevel(levels: Level[], decisions: Decision[]): Level | null {
  const approved = new Set(currentRound(decisions).filter((d) => d.decision === "approved").map((d) => d.levelId));
  return active(levels).find((l) => !approved.has(l.id)) ?? null;
}

export function isCircuitComplete(levels: Level[], decisions: Decision[]): boolean {
  return active(levels).length > 0 && nextLevel(levels, decisions) === null;
}

export function statusAfter(levels: Level[], decisions: Decision[], current: string): string {
  const last = byDate(decisions).at(-1);
  if (last?.decision === "rework") return "rechallenged";
  return isCircuitComplete(levels, decisions) ? "validated" : current;
}
```

- [ ] **Step 4: `npx tsx --test tests/unit/fiche-validation.test.ts`** — Expected: PASS.

- [ ] **Step 5: Commande `decideFiche`** (`app/actions/fiche-validation.ts`) : `getCurrentPerson()` ; charger l'année (projet, niveaux actifs, décisions) ; `nextLevel` ; refuser si aucun niveau à décider ; refuser si `!has(me, level.permission)` ; refuser si `me.id === e.project.pilotId` (on ne décide pas sa propre fiche) ; refuser `rework`/`refused` sans commentaire ; dans **une transaction** : créer la `FicheValidation`, calculer `statusAfter` et mettre à jour `edition.status` s'il change, écrire une `ChangeLog` (`field: "validation"`, `after: "${level.label} : validé|à retravailler|refusé"`). `saveLevels` : `canAdmin(me)` ; ordre = position dans la liste ; ne jamais supprimer un niveau qui a des décisions (le passer inactif).

- [ ] **Step 6: Verrou** `lib/lock.ts` : `isLocked(e)` = statut verrouillé **ou** circuit complet dans le tour courant (lire `e.ficheValidations` et les niveaux ; ajouter ces champs aux lectures qui appellent `isLocked` — `grep -rn "isLocked(" app lib`).

- [ ] **Step 7: Interfaces** : couche 4 de la fiche (`fiche-validation.tsx`) = la liste des niveaux avec, pour chacun, décision / qui / date / commentaire, et pour le niveau à décider, si j'en ai le droit : trois boutons « Valider », « À retravailler », « Refuser » + commentaire ; retirer `codirDecision`, `codirDate`, `boardValidated`, `boardDate` de l'affichage et de `FIELDS.edition` (liste figée de `guardrails.test.ts` mise à jour ; relire SEC-27). Admin › Paramètres : `fiche-levels.tsx` (libellé, droit parmi `fiche.validate.1…3`, actif, ordre par flèches).

- [ ] **Step 8: Recette** `tests/validation-fiche.spec.ts` : la direction valide le niveau 1, un administrateur du CA le niveau 2, la fiche est verrouillée ; « à retravailler » la re-challenge ; le pilote ne peut pas décider sa propre fiche (bouton absent, commande refusée). Accord de Gaël avant de lancer.

- [ ] **Step 9: `npm run check`** ; commit : « Fiche : validation par niveaux réglés par instance, à la place de la décision du CODIR et du CA ».

---

### Task 14: Arbitrages, sponsor, millésime, relecture de `V.codir`

**Files:**
- Modify: `lib/navigation.ts`, `app/codir/page.tsx`, `components/shell/breadcrumb.tsx`, `components/shell/shortcuts.tsx`, `lib/fields.ts` (`sponsorId` : libellé `cap(V.sponsor)`), `app/edition/[id]/fiche.tsx` (options du sponsor : toutes les personnes actives), `lib/permissions.ts`, et les ≈ 47 usages de `V.codir` (`grep -rn "V\.codir" app lib components`) ; les titres de section d'une année (Équipe, Fil, Bilan, Budget, Temps)

- [ ] **Step 1: « Arbitrages »** : entrée de menu et titre de `/codir` = « Arbitrages » ; le raccourci et le fil d'Ariane suivent.
- [ ] **Step 2: Sponsor** : `FIELDS.edition.sponsorId.label` = `cap(V.sponsor)` ; aide : « la personne de la gouvernance (direction, CA) qui soutient le projet en instance » ; options = `people` (toutes les personnes actives), plus le filtre `p.codir`.
- [ ] **Step 3: Relire chaque usage de `V.codir`** : là où il nomme l'écran → « Arbitrages » ; l'événement → « Préparer {année} » ou le circuit ; le groupe de personnes (droit `codir.access`) → garder `V.codir` (TLST : « coordination »). Relire en particulier `lib/permissions.ts` (libellés `fiche.validation` → retiré au profit de `fiche.validate.1/2` : « Valide les fiches au niveau 1 », « … au niveau 2 »).
- [ ] **Step 4: Millésime** : dans une année, les titres « Équipe », « Fil », « Bilan », « Budget », « Temps » deviennent « Équipe {année} », « Fil {année} »… (`app/edition/[id]/team-section.tsx`, `fil-sheet.tsx`, `fiche.tsx` chapitre Bilan, `budget.tsx`, `temps.tsx`) ; dans le guide, « Équipe {année} » au lieu d'« Équipe de l'année ».
- [ ] **Step 5: `npm run check`** (dont `check:vocab`) ; vérification visuelle rapide (preview : fiche, menu) ; commit : « Noms : écran Arbitrages, sponsor par instance, millésime affiché ; « bureau » disparaît chez TLST ».

---

## Lot E — Projets internes, personnes sans suivi du temps, Mes actions

### Task 15: Projets internes

**Files:**
- Modify: `lib/fields.ts` (`project.kind`, select `funded | internal`), `app/projets/[id]/page.tsx` (Identité : « Type »), `lib/matrix.ts` (orphelins et lignes), `app/seminaire/page.tsx` (proposition), `app/plan-operationnel/export/route.ts` (chapitre), `app/portefeuille/filters.tsx` + `app/portefeuille/page.tsx` (filtre), `tests/unit/guardrails.test.ts` (liste figée)
- Test: `tests/unit/matrix-internal.test.ts` (si `lib/matrix.ts` expose une fonction pure de calcul ; sinon cas ajouté à la recette `tests/matrice.spec.ts`)

- [ ] **Step 1: Test** : un projet interne sans ligne n'est ni une ligne de la matrice ni un orphelin ; un projet interne avec une ligne est une ligne.
- [ ] **Step 2: Implémenter** : `lib/matrix.ts` filtre `p.kind === "internal" && lines.length === 0` ; séminaire : un projet interne n'est proposé que s'il est `recurring` ; export du plan opérationnel : les projets internes après les autres, sous le titre « Structuration interne » ; portefeuille : filtre `type=finances|internes` (libellés « Financés », « Internes »).
- [ ] **Step 3: `npm run check`** ; commit : « Projets internes : pas d'alerte de financement, chapitre à part, filtre ».

### Task 16: « Suit son temps »

**Files:**
- Modify: `lib/fields.ts` (`person.tracksTime`), `app/admin/person-panel.tsx` (case), `lib/navigation.ts` (section Temps masquée si `!tracksTime`), `app/temps/page.tsx` (redirection vers `/ma-semaine` pour soi ; exclue de « Temps de l'équipe »), `app/cloture/page.tsx:36`, `lib/load.ts:49`, `lib/deadline-notifications.ts` (relances de saisie), `tests/unit/guardrails.test.ts` (liste figée)
- Test: recette `tests/personnes.spec.ts` (cas ajouté)

- [ ] **Step 1: Filtre** `tracksTime: true` dans les requêtes de personnes de la clôture, du plan de charge, de « Temps de l'équipe » et des relances de saisie ; `NavContext` reçoit `tracksTime` et la section `temps` n'est ajoutée que si vrai.
- [ ] **Step 2: Case** « Suit son temps » dans la fiche personne (Admin › Personnes), aide : « Décochez pour un membre du CA ou un bénévole : ni saisie, ni relance, ni plan de charge ; il peut porter des actions et recevoir des tâches. »
- [ ] **Step 3: Recette** : une personne décochée n'apparaît plus dans le plan de charge ni dans la clôture, et reste choisissable comme responsable d'action. Accord de Gaël avant de lancer.
- [ ] **Step 4: `npm run check`** ; commit : « Personnes : « suit son temps » — les membres du CA et les bénévoles sortent du suivi du temps ».

### Task 17: « Mes actions » remplace « Ma délégation »

**Files:**
- Create: `app/mes-actions/page.tsx`, `app/mes-actions/export/route.ts`
- Modify: `lib/navigation.ts` (entrée « Mes actions » dans Mon travail, pour tous ; « Ma délégation » retirée), `lib/modules.ts` (module `delegation` retiré d'`INSTANCE_MODULES`), `app/delegation/page.tsx` (redirection 308 vers `/mes-actions`), `app/layout.tsx` (contexte de navigation), `config/clients/tlst.ts` (retirer `delegation` de `modules`)

**Interfaces:**
- Consumes: `periodsOf`, `periodFor` (`lib/delegation.ts`, gardées : elles seront déplacées dans `lib/periods.ts` au contract), `Settings.delegationPeriods`.
- Produces: `/mes-actions?personne=<id>&periode=<clé>&annee=<année>`.

- [ ] **Step 1: Page** : personne = moi par défaut ; `personne=` autorisé seulement avec le droit de voir le temps de l'équipe sur son périmètre (`time.view_all` ou responsable du pôle de la personne — même garde que `/temps?personne=`) ; sinon 404. Contenu : pour chaque projet (année choisie), les actions dont la personne est responsable ou associée, qui courent dans la période : nom (lien), période, « Ce qui est confié », « Marge de décision », jalons de la période (les points de contrôle mis en avant), puis **ses** tâches de la période (seulement quand la personne regarde sa propre page : les tâches ne sortent jamais pour un tiers, règle de la délégation conservée).
- [ ] **Step 2: Export Word** « feuille de mission » (`docx`, sur le modèle de `app/delegation/export/route.ts`) : mêmes données sans les tâches ; garde identique à la page, **avant** lecture.
- [ ] **Step 3: Test de sécurité** : un contributeur ne lit pas `/mes-actions?personne=<autre>` (404) ni son export (403) ; adapter ou remplacer `tests/security/sec-31-delegation.spec.ts`.
- [ ] **Step 4: `npm run check`** ; commit : « Mes actions : ce qui est confié à chacun, ses contrôles et ses tâches ; la délégation disparaît du menu ».

---

## Lot F — Démos, guide, recette, reprise

### Task 18: Démos réécrites

**Files:**
- Modify: `prisma/seeds/cress.ts` (l. 510, 775, 850, 1152 et toutes les créations d'actions), `prisma/seeds/tlst.ts`, `prisma/seeds/common.ts` (niveaux de validation par instance : CRESS « Direction », « CA » ; TLST « Coordination », « CA »)

- [ ] **Step 1: CRESS** : chaque action a `projectId`, `startDate`, `endDate` ; les occurrences dupliquées (petits-déj de l'Observatoire, forums SPRO…) deviennent **une** action avec des jalons ; ASER : une action « Séquences acheteurs » avec six jalons ; le projet « Refonte du site internet » passe `kind: "internal"` avec ses phases en jalons ; une action sur deux ans (« Orientation : stands et forums », novembre → mars n+1) ; une action financée par deux lignes avec montants ; un membre du CA `tracksTime: false`, sponsor d'un projet. Garder **stables** les noms et dates que visent les recettes (`tests-recette.md`) : relire `grep -rn "openEditionByName\|getByText" tests/*.spec.ts` avant de renommer.
- [ ] **Step 2: TLST** : même principe sur les trois projets de démo (« Jardin partagé » : ateliers mensuels = une action, jalons ; une délégation de démo devient « confié / marge » sur deux actions).
- [ ] **Step 3: `npm run seed`** puis `npm run seed:tlst` sur les bases de dev ; ouvrir la démo (preview) : années, actions, frise, page d'action, Préparer 2027, Arbitrages.
- [ ] **Step 4: Commit** : « Démos : actions composantes avec jalons, un projet interne, un membre du CA ».

### Task 19: Guide de l'outil

**Files:** Modify: `lib/lexique.ts`, `app/aide/page.tsx`

- [ ] **Step 1: Réécrire** les entrées : Action (composante, période, récurrence, confié / marge), Jalon (point de passage d'une action, au pluriel, public, point de contrôle), Tâche (un geste ; règle « une date qui compte pour le pilotage = un jalon ; un geste = une tâche »), Sponsor (`cap(V.sponsor)`), Équipe {année}, Arbitrages, Préparer l'année suivante, Circuit de validation, Mes actions, Projet interne, Suit son temps, Financement d'une action (montant, dossiers pluriannuels) ; supprimer Délégation, Point de contrôle (fondu dans Jalon), Séminaire. Schéma de la page d'aide : « Actions : période, jalons → tâches ».
- [ ] **Step 2: `npm run check`** (le test d'habillage refuse « dition » : pas de « conditionné ») ; commit : « Guide : l'action composante, les jalons, la validation par niveaux, Mes actions ».

### Task 20: Recette complète

**Files:** `tests/actions.spec.ts` (nouveau) ; specs existantes touchées par les tâches 5 à 19 (`recette-1-edition`, `agenda-ics`, `delegation` → supprimée ou réécrite sur `/mes-actions`, `taches`, `plan-de-charge`, `realise`, `versements`, `conventions`, `scenario-collectif`, `revue-ux`, `fiche-clic-modifier`, `habillage`)

- [ ] **Step 1: `tests/actions.spec.ts`** : une action 2025–2027 apparaît dans 2025 et 2026, avec les heures de chaque année ; un jalon « public » sort dans le flux public (`/api/agenda`) ; lier une ligne d'un dossier pluriannuel lie aussi l'autre année ; reconduire ne recopie pas l'action qui continue ; un membre d'une année couverte modifie l'action, un tiers non (commande refusée).
- [ ] **Step 2: Mettre à jour** les specs existantes (sélecteurs de l'ancien panneau d'action, `action-row-*`, « Dupliquer », frise, délégation).
- [ ] **Step 3: Avec l'accord explicite de Gaël** : `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<texte de Gaël>" npm test` puis `npm run test:security`. Expected : tout vert ; sinon corriger et relancer.
- [ ] **Step 4: Commit** : « Recette : actions composantes, financements pluriannuels, validation par niveaux, Mes actions ».

### Task 21: Répétition de la migration sur la production, reprise TLST, déploiement

**Files:** `docs/decisions.md` (entrée), `docs/remediation/` (procédure suivie), script de reprise sur le serveur (hors dépôt)

- [ ] **Step 1: Répétition** (avec Gaël : le dump se récupère sur le serveur) : restaurer les derniers dumps CRESS et TLST (`/var/backups/…`) dans deux bases locales jetables (`createdb pilote_rehearsal_cress` …, `pg_restore`), `DATABASE_URL=… npx prisma migrate deploy`, puis `DATABASE_URL=… npx tsx --test tests/migration/actions-migration.test.ts` et les requêtes de contrôle de la spec (§ 1) : même nombre d'actions, un jalon par ancienne date, un lien par ancien financeur, totaux d'heures par action identiques (requête avant / après sur `TimeEntry` groupé par `actionId`). Consigner les chiffres dans `docs/decisions.md`.
- [ ] **Step 2: Contrôle TLST** : `ChangeLog`, `updatedAt` des actions, `TimeEntry` créés depuis le 26/09 12:00 — s'il n'y a rien, la reprise est refaite ; sinon, migration seule et regroupement à la main (le dire à Gaël avant).
- [ ] **Step 3: Adapter le script de reprise** (copie locale transmise par Gaël, jamais dans le dépôt, données réelles) aux règles de la spec « actions » § 4 ; relecture avec Gaël.
- [ ] **Step 4: Déploiement** (Gaël donne le go et le consentement de recette) : `./deploy/deploy.sh cress --seed` (démo rechargée, accord explicite), `./deploy/deploy.sh tlst` (sans `--seed`), puis Gaël lance la reprise TLST après la sauvegarde ; renommer le niveau 1 en « Coordination » dans Admin › Paramètres de TLST si la reprise ne l'a pas fait ; vérifier en ligne (connexion, une année, une action, Arbitrages, Préparer 2027).
- [ ] **Step 5: Mémoire et feuille de route** : noter dans `docs/LOTS-TLST.md` le contract à venir (suppression des anciennes colonnes d'`Action`, de `Edition.codirDecision/codirDate/boardValidated/boardDate`, des tables et droits de délégation, du test SEC-31) ; commit.

---

## Self-review (faite à l'écriture)

- Couverture des specs : période et années (T3-T5), jalons (T6-T8), personnes associées (T6-T7), confié / marge (T6-T7, T17), financements, montants, propagation, dépassement (T9), actions financées + export (T10), dépenses et indicateurs (T11), équilibre (T9), reconduction et « Préparer » (T12), circuit par niveaux + migration des anciennes décisions (T2, T13), Arbitrages, sponsor, millésime, `V.codir` (T1, T14), projets internes (T15), suit son temps (T16), Mes actions et fin de la délégation (T17), démos (T18), guide (T19), tests et vocabulaire des tests (T1, T20), répétition sur dumps, reprise TLST, déploiement, contract consigné (T21).
- Noms constants : `runsIn`, `attachYearActions`, `YearAction.hoursYear/hoursTotal`, `canEditAction`, `linkFunding`, `linkNewLineToRunningActions`, `decideFiche`, `nextLevel`, `statusAfter` — employés à l'identique d'une tâche à l'autre.
- Points à vérifier en exécutant (signalés dans les tâches, pas des trous) : forme réelle d'`Actor` pour les tests de droits (T6), calcul « sans double comptage » de `lib/budget.ts` (T3), coût horaire du module budget (T9), garde exacte des exports financiers (T10).
