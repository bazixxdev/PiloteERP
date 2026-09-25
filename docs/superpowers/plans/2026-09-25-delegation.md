# Délégation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une délégation par personne × édition (attendus, limites, contrôles, historique), prise de connaissance par la personne, présentation au CA consignée en décision, et une vue « Délégation » filtrable par période qui reprend sans ressaisie les actions, points de contrôle, indicateurs et livrables — exportable en .docx.

**Architecture:** Fonctions pures dans `lib/delegation.ts` (périodes, filtres, droits), chargement filtré dans `lib/delegation-db.ts` (les tâches ne sortent que pour la personne elle-même), commandes dans `app/actions/delegation.ts`, page `app/delegation/`, export `app/delegation/export/route.ts`. Module d'instance `delegation`.

**Tech Stack:** Next.js 15, Prisma 6 / PostgreSQL 16, `docx` (déjà utilisé), node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-delegation-design.md`

## Global Constraints

- Règles `AGENTS.md` + `.agents/rules/*.md`. Migration « expand » seulement. Aucune commande par `saveField` (`lib/fields.ts` inchangé).
- Lecture : la personne elle-même, `delegation.view_all`, ou `delegation.write` sur le périmètre ; filtre **avant** sérialisation.
- Prise de connaissance : **seule la personne concernée**, vérifié côté serveur.
- Les tâches d'une personne ne sortent jamais dans une réponse lue par quelqu'un d'autre (ni page, ni export).
- Vocabulaire par `lib/vocab.ts` ; `npm run check` vert avant chaque commit ; commits en français avec `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File Structure

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20260925150000_delegation/migration.sql` | `Delegation`, `DelegationRevision`, `Action.isCheckpoint`, `Settings.delegationPeriods`, droits des rôles système |
| `lib/delegation.ts` | périodes, filtre de période, droits de lecture / écriture |
| `lib/delegation-db.ts` | chargement de la feuille d'une personne pour une année et une période |
| `app/actions/delegation.ts` | créer, modifier (avec révision), prendre connaissance, présentation au CA, supprimer, point de contrôle |
| `app/actions/edition.ts` | `addAction` accepte un responsable et une échéance facultatifs (objectif créé depuis la vue) |
| `lib/permissions.ts`, `lib/modules.ts`, `lib/navigation.ts`, `app/layout.tsx`, `config/clients/tlst.ts` | droits, module, entrée « Ma délégation » |
| `app/delegation/page.tsx`, `app/delegation/forms.tsx`, `app/delegation/export/route.ts` | vue, formulaires, export .docx |
| `prisma/seeds/cress.ts`, `prisma/seeds/tlst.ts` | démo |
| `tests/unit/delegation.test.ts`, `tests/security/sec-31-delegation.spec.ts`, `tests/delegation.spec.ts` | tests |

---

### Task 1: Schéma et migration

- [ ] **Step 1:** Ajouter au schéma :

```prisma
// Délégation (25/09) : une personne × une édition, pour l'année. Attendus, limites et contrôles ; prise de connaissance remise
// à zéro à chaque modification ; présentation au CA datée. L'historique des textes est dans DelegationRevision.
model Delegation {
  id               String               @id @default(cuid())
  personId         String
  person           Person               @relation("DelegationPerson", fields: [personId], references: [id], onDelete: Restrict)
  editionId        String
  edition          Edition              @relation(fields: [editionId], references: [id], onDelete: Cascade)
  expectations     String?
  limits           String?
  controls         String?
  acknowledgedAt   DateTime?
  boardPresentedAt DateTime?
  createdById      String
  createdBy        Person               @relation("DelegationAuthor", fields: [createdById], references: [id])
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt
  revisions        DelegationRevision[]

  @@unique([personId, editionId])
}

// État des textes **avant** une modification (qui l'a remplacé, quand).
model DelegationRevision {
  id           String     @id @default(cuid())
  delegationId String
  delegation   Delegation @relation(fields: [delegationId], references: [id], onDelete: Cascade)
  expectations String?
  limits       String?
  controls     String?
  authorId     String
  author       Person     @relation("DelegationRevisionAuthor", fields: [authorId], references: [id])
  createdAt    DateTime   @default(now())
}
```

`Action` : `isCheckpoint Boolean @default(false)`. `Settings` : `delegationPeriods String @default("01-06,07-12")`. Relations inverses sur `Person` (`delegations`, `delegationsWritten`, `delegationRevisions`) et `Edition` (`delegations`).

- [ ] **Step 2:** `npx prisma migrate diff --from-url <base de test migrée> --to-schema-datamodel prisma/schema.prisma --script` → `prisma/migrations/20260925150000_delegation/migration.sql`, puis ajouter :

```sql
UPDATE "Role" SET "permissions" = CASE WHEN "permissions" = '' THEN 'delegation.write,delegation.view_all' ELSE "permissions" || ',delegation.write,delegation.view_all' END
  WHERE "code" = 'director' AND "permissions" NOT LIKE '%delegation.write%';
```

- [ ] **Step 3:** appliquer sur la base de dev, `npx prisma generate`, `npx tsc --noEmit`, commit.

---

### Task 2: Fonctions pures et droits

**Produces** (`lib/delegation.ts`) :
- `type Period = { key: string; label: string; from: Date; to: Date }` ; `periodsOf(setting: string, year: number): Period[]` (toujours suivi de « toute l'année », `key = "annee"`) ; `periodFor(key: string | undefined, periods: Period[], today: Date): Period` (la période qui contient aujourd'hui par défaut).
- `objectiveInPeriod(a: { milestoneDate: Date | null; state: string }, p: Period): boolean` — échéance dans la période, ou sans échéance et non terminée, ou en cours (`doing`) avec échéance après le début.
- `dueInPeriod(d: Date, p: Period): boolean`.
- `canWriteDelegation(me: Viewer, poleIds: string[]): boolean` — `delegation.write` et (scope.all ou son pôle).
- `canReadDelegation(me: Viewer, d: { personId: string; poleIds: string[] }): boolean` — la personne elle-même, ou `delegation.view_all`, ou `canWriteDelegation`.

Tests `tests/unit/delegation.test.ts` : périodes du réglage (« 01-06,07-08,09-12 » → trois périodes + année, bornes au dernier jour du mois), période par défaut, filtre (dans la période, hors période, sans échéance non terminée, terminée sans échéance exclue, en cours à cheval), droits (soi-même, view_all, write de son pôle, write d'un autre pôle refusé, contributeur refusé).

- [ ] TDD : tests → échec → implémentation → vert → commit.

---

### Task 3: Droits, module, navigation

- `lib/permissions.ts` : `PermissionModule` gagne `"delegation"` (« Délégations ») ; clés `delegation.write` (« Rédige les délégations ») et `delegation.view_all` (« Lit toutes les délégations ») ; rôle `director` : les deux.
- `lib/modules.ts` : `{ key: "delegation", label: "Délégations", hint: … }` ; `config/clients/tlst.ts` : ajouter `delegation`.
- `lib/navigation.ts` : `NavContext.delegation: boolean` ; dans « Mon travail », `{ label: "Ma délégation", href: "/delegation", path: "/delegation" }` si actif ; `app/layout.tsx` passe `delegation: instanceHas(settings, "delegation")`.
- [ ] `npm run check`, commit.

---

### Task 4: Chargement et commandes

`lib/delegation-db.ts` — `loadSheet(me: CurrentPerson, personId: string, year: number, periodKey?: string)` renvoie `null` si `canReadDelegation` est faux pour **toutes** les délégations (la personne n'existe pas, ou rien n'est lisible) ; sinon `{ person, periods, period, groups: { pole: string; cards: Card[] }[], canWrite: boolean, isSelf: boolean }` avec `Card = { delegation: { id, expectations, limits, controls, acknowledgedAt, boardPresentedAt, revisions: { id, createdAt, author, expectations, limits, controls }[] }, edition: { id, name, year }, objectives: Action[], checkpoints: Action[], indicators: Indicator[], deliverables: { label, dueDate, done, funder }[], tasks: Task[] | null }` ; `tasks` vaut `null` si `me.id !== personId`. Chaque délégation illisible est **écartée** avant le retour.
`listPeople(me, year)` : pour qui a `delegation.view_all` / `delegation.write` — personnes ayant au moins une délégation lisible, avec leur état (à relire / lu le / présentée au CA le).

`app/actions/delegation.ts` :
- `createDelegations(personId, editionIds[])` : `canWriteDelegation` sur chaque édition ; `createMany({ skipDuplicates: true })` ; notification `kind = "delegation"` à la personne (lien `/delegation?personne=…`).
- `updateDelegation(id, { expectations, limits, controls })` : transaction = `DelegationRevision.create` (état précédent) + `update` (+ `acknowledgedAt: null`) ; notification « à relire ».
- `acknowledgeDelegations(ids[])` : **refuse** toute délégation dont `personId !== me.id` ; pose `acknowledgedAt` ; notifications `delegation` de la personne marquées lues.
- `consignBoardPresentation(personId, year, date, note?)` : droit d'écriture sur chaque délégation concernée ; transaction = `boardPresentedAt` + une `Decision` `instance = "board"` par édition (« Délégation de X présentée au CA le … »).
- `deleteDelegation(id)` : droit d'écriture ; supprime (révisions en cascade).
- `setActionCheckpoint(actionId, value)` : `canEditActions` sur l'édition de l'action.
- `app/actions/edition.ts` : `addAction(editionId, name, opts?: { ownerId?: string; milestoneDate?: string; isCheckpoint?: boolean })` — même garde `canEditActions` ; `ownerId` doit être une personne active ; sans `opts`, comportement inchangé.

- [ ] `npm run check`, commit.

---

### Task 5: Vue, formulaires, export

- `app/delegation/page.tsx` : module actif sinon 404 ; `?personne` (défaut : soi), `?annee` (défaut : année courante), `?periode` ; si `listPeople` non vide, colonne des personnes (état) ; filtre de période (liens) ; groupes par pôle ; une carte par édition : attendus / limites / contrôles (modifiables si `canWrite`, via `DelegationTextForm`), historique repliable, objectifs (état, échéance, retard en rouge), points de contrôle, indicateurs, livrables dus, tâches (si `isSelf`), bouton « Ajouter un objectif » (si `canEditActions`). Pied : « J'ai pris connaissance » (si `isSelf` et non lu), « Consigner la présentation au CA » (si `canWrite`), « Exporter en .docx ». Si `canWrite` : formulaire « Nouvelle délégation » (personne + éditions de l'année dans le périmètre).
- `app/delegation/forms.tsx` : `DelegationTextForm`, `AcknowledgeButton`, `BoardPresentationForm`, `NewDelegationForm`, `AddObjectiveForm`, `CheckpointToggle`, `DeleteDelegationButton` (motif `useTransition` + `toast` + `router.refresh()`).
- `app/delegation/export/route.ts` : `sessionExportAllowed` sinon 401 ; `loadSheet` (null → 404) ; document `docx` : titre, période, par carte les mêmes blocs **sans les tâches**.
- `data-testid` : `delegation-card-<editionId>`, `delegation-expectations-<id>`, `delegation-ack`, `delegation-ack-state`, `delegation-board`, `delegation-export`, `delegation-period-<key>`, `delegation-objectives-<editionId>`, `delegation-tasks-<editionId>`, `delegation-new`.
- [ ] `npm run check`, vérification dans le navigateur, commit.

---

### Task 6: Démo et tests

- Seeds : CRESS — délégation de Thomas Guérin sur deux éditions 2026 (attendus, limites, contrôles), une action marquée point de contrôle ; TLST — une délégation. `Settings.delegationPeriods` TLST = `01-06,07-08,09-12`. Module actif dans la démo CRESS (seed), pas dans la configuration par défaut du client.
- Sécurité (`sec-31`) : un contributeur n'obtient pas la délégation de Thomas (`/delegation?personne=<id>` ne contient pas les attendus ; export 404) ; la direction la lit ; les tâches de Thomas sont absentes pour la direction ; l'anonyme reçoit 401 à l'export.
- Recette (`tests/delegation.spec.ts`) : la direction crée la délégation de X, écrit les limites → X la lit, en prend connaissance → la direction modifie → « à relire » + historique → présentation au CA → décision visible sur la fiche de l'édition → filtre de période → export .docx 200.
- [ ] tests verts, `npm run check`, commit.

---

### Task 7: Clôture

- [ ] `docs/evolutions.md` ; `npm run check:full` ; commit ; déploiement **sur go de Gaël**, puis activer le module sur TLST.
