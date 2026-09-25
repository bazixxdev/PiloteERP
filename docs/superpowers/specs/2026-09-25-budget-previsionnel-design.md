# Budget prévisionnel par catégorie et écart au réalisé (design du 25/09/2026)

Décidé avec Gaël le 25/09/2026, à partir des fichiers de travail réels de TLST (« SUIVI VERSEMENT PREVI AAPs », onglets par dossier : dépenses par catégorie, part du financeur, par année). But : **suivre le budget prévisionnel de chaque projet et voir les divergences avec le réalisé**, catégorie par catégorie. Instance TLST d'abord ; le code est commun, la CRESS en profite si elle active le module.

## Décisions prises

| Question | Décision |
|---|---|
| Grille de catégories | **une grille commune** à l'instance (V1) ; la présentation dans les rubriques de chaque financeur vient en V2, par correspondance |
| Où vit le prévu | **sur l'édition** (le projet une année donnée), tous financeurs confondus ; un dossier pluriannuel additionne ses éditions |
| Réalisé « Personnel » | **temps passé × coût horaire**, calculé ; **surcharge manuelle** possible, par catégorie et par édition, avec motif obligatoire, le calcul restant affiché à côté |
| Réalisé des autres catégories | le **grand livre** de l'édition (lot D), classé par préfixe de compte |
| Qui écrit, qui valide | **deux droits configurables** dans Admin › Rôles et droits : « prépare » et « valide » |

## Ce qu'on livre (V1)

1. Un référentiel **catégories de budget**, modifiable dans l'admin, avec la source de son réalisé.
2. Le **budget prévisionnel** d'une édition, en lignes par catégorie, avec un statut brouillon → à valider → validé.
3. Le **tableau d'écart** Prévu · Réalisé · Engagé restant · Écart · % consommé, dans l'onglet Budget de l'édition, avec export CSV.
4. La **surcharge manuelle** du réalisé.
5. La **somme par dossier** (lecture) sur la fiche du dossier de financement.
6. Une **alerte** de dépassement par catégorie dans la bande d'état de l'édition.

Hors V1 : voir « V2 » en fin de document.

## 1. Données

Migration « expand » uniquement : nouvelles tables, colonnes facultatives. Rien d'existant n'est renommé ni supprimé.

```prisma
// Grille commune (référentiel d'instance). La liste par défaut est posée par le seed du client.
model BudgetCategory {
  id             String  @id @default(cuid())
  label          String
  // Préfixes de comptes du grand livre classés ici, séparés par des virgules : « 64 », « 604,611,622 », « 2 ».
  accountPrefixes String @default("")
  source         String  @default("ledger") // time (Personnel) | ledger (compta) | none (forfait, saisi à la main)
  order          Int     @default(0)
  active         Boolean @default(true)
  lines          BudgetLine[]
  overrides      BudgetActualOverride[]
  expenses       Expense[]
}

// Le prévu : plusieurs lignes possibles par catégorie (« Agence de communication », « Imprimeur »).
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
}

// Réalisé saisi à la main : remplace le calcul de la catégorie pour cette édition.
model BudgetActualOverride {
  id         String         @id @default(cuid())
  editionId  String
  edition    Edition        @relation(fields: [editionId], references: [id], onDelete: Cascade)
  categoryId String
  category   BudgetCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  amount     Float
  reason     String
  authorId   String
  author     Person         @relation(fields: [authorId], references: [id])
  createdAt  DateTime       @default(now())
  @@unique([editionId, categoryId])
}
```

Sur `Edition` : `budgetPlanStatus String @default("draft")` (draft | submitted | validated), `budgetPlanValidatedAt DateTime?`, `budgetPlanValidatedById String?`.
Sur `Expense` : `budgetCategoryId String?` (catégorie de l'engagement ; facultative).

Choix et raisons :
- `onDelete: Restrict` vers la catégorie : une catégorie utilisée ne se supprime pas, elle se **désactive** (règle données-migrations : pas de cascade vers du financier).
- `onDelete: Cascade` depuis l'édition : cohérent avec les autres enfants de l'édition (actions, indicateurs) ; une édition ne se supprime pas dans l'usage courant.
- Les changements de montant, de statut et de surcharge sont écrits dans `ChangeLog` (édition, champ, avant, après, auteur), déjà affiché sur la fiche. Champ : `budget:<categorie>:<ligne>`, `budget:statut`, `budget:surcharge:<categorie>`.

**Catégories par défaut** (seed commun, modifiables) :

| Catégorie | Source | Préfixes |
|---|---|---|
| Personnel | time | 64 |
| Coûts indirects | none | — |
| Prestations | ledger | 604,611,622,628 |
| Achats et fournitures | ledger | 601,602,606 |
| Déplacements | ledger | 625 |
| Communication | ledger | 623 |
| Locaux et fonctionnement | ledger | 613,614,615,616,618,626,627 |
| Investissement | ledger | 2 |
| Autre | ledger | 6 |

Le classement prend le **préfixe le plus long** qui correspond (606 → Achats avant 6 → Autre). « Autre » à `6` attrape le reste des charges ; une charge qu'aucune catégorie ne reconnaît va en **Non classé**.

## 2. Calcul (fonctions pures, `lib/budget-plan.ts`)

- `classifyAccount(account, categories)` → catégorie au préfixe le plus long, ou `null` (Non classé). Les produits (7x) sont ignorés.
- `ledgerActualByCategory(lines, categories)` → montants par catégorie à partir des lignes du grand livre **déjà rapprochées à l'édition** (lot D, `ledger-db.ts`) ; seules les catégories `source = ledger` reçoivent.
- `hourlyCost(personId, month, hrRules, rhythms)` → coût mensuel chargé (règle `CashRule` `kind = hr`, active ce mois, de la personne) ÷ heures attendues du mois (`expectedDaysOfMonth`). `null` si pas de règle ou pas d'heures attendues.
- `personnelActual(entries, costs)` → Σ heures du projet dans l'année × coût horaire du mois de la saisie ; renvoie aussi `unvalued: { personId, hours }[]` pour les heures sans coût connu. **Aucune heure n'est valorisée à un coût deviné.**
- `budgetTable(plan, actual, overrides, engaged)` → par catégorie : prévu (Σ lignes), réalisé calculé, surcharge, **réalisé retenu** (surcharge si présente, sinon calcul), engagé restant (Σ `committed − spent` des dépenses ouvertes de la catégorie, jamais négatif), écart = prévu − réalisé retenu − engagé restant, % consommé = (réalisé retenu + engagé restant) ÷ prévu ; plus une ligne Non classé et les totaux.

Rattachement du temps à l'édition : `TimeEntry` du **projet** de l'édition dont la date tombe dans **l'année** de l'édition (même règle que le temps consommé existant).

Source du réalisé hors Personnel : si `Settings.realizedSource = raf` (pas de grand livre), le réalisé d'une catégorie `ledger` vient des dépenses (`Expense.spent`) portant cette catégorie. Jamais les deux à la fois (même anti-double comptage que `lib/budget.ts`).

## 3. Commandes et droits

Deux droits nouveaux dans `lib/permissions.ts`, module « editions » :
- `budget.plan` — « Prépare le budget prévisionnel » : sur les éditions dont on est responsable (pilote) ou membre de l'équipe, et sur celles de son pôle pour qui a `pole.manage` ; sur toutes avec `scope.all`.
- `budget.validate` — « Valide le budget prévisionnel ».

Par défaut : pilote et responsable de pôle → `budget.plan` ; RAF / trésorier et direction / coordination → les deux. Réglable ensuite dans Rôles et droits.

Commandes (Server Actions dans `app/actions/budget-plan.ts`, **pas de `saveField`** : montants, statut et surcharge sont financiers — règle SEC-27 ; la sentinelle `guardrails.test.ts` ne change pas) :

| Commande | Droit | Effet |
|---|---|---|
| `addBudgetLine`, `updateBudgetLine`, `deleteBudgetLine` | `budget.plan` sur l'édition | modifie le prévu ; si le budget était *validé* et que l'acteur n'a pas `budget.validate`, il repasse *à valider* ; trace `ChangeLog` |
| `submitBudgetPlan` | `budget.plan` | draft → submitted |
| `validateBudgetPlan` | `budget.validate` | submitted (ou draft) → validated, date et auteur ; claim atomique `updateMany({ where: { id, budgetPlanStatus: { not: "validated" } } })` (SEC-29) |
| `setActualOverride`, `clearActualOverride` | `budget.validate` | pose ou retire la surcharge ; motif obligatoire (non vide) ; trace |
| `setExpenseCategory` | `expenses.track` ou `fiche.budget` | range un engagement dans une catégorie |
| catégories (créer, renommer, préfixes, source, ordre, désactiver) | `admin.manage` | référentiel |

Chaque commande : `getCurrentPerson()`, droit **sur l'édition visée** (périmètre), validation des entrées (montant fini, ≥ 0 ; catégorie active ; motif non vide), transaction quand elle écrit la ligne et sa trace.

## 4. Écrans

- **Édition › onglet Budget** : nouvelle section « Budget prévisionnel » au-dessus de l'existant.
  - Bandeau : statut (brouillon / à valider / validé le … par …), boutons « Soumettre » et « Valider » selon les droits.
  - Tableau catégories (lignes dépliables pour le détail) : Prévu · Réalisé · Engagé restant · Écart · % consommé. Écart négatif en rouge. Quand une surcharge existe : réalisé retenu en gras, « calculé : 27 340 € » en dessous, motif au survol.
  - Personnel : « 1 240 h valorisées · 12 h sans coût horaire (voir) » ; le lien liste les personnes concernées **seulement** pour qui a `treasury.view` ou `budget.validate`.
  - Ligne « Non classé » si des charges y tombent, avec le lien vers les comptes concernés.
  - Export CSV (`csvCell`, SEC-13).
  - L'enveloppe existante (`budgetEnvelope`, dépenses directes) reste affichée à part, inchangée.
- **Dépense** (circuit existant) : un sélecteur de catégorie facultatif.
- **Dossier de financement** : bloc « Budget des projets financés », lecture seule, somme par catégorie des éditions rattachées à ses lignes, par année.
- **Admin › Référentiels** : « Catégories de budget » (libellé, préfixes, source, ordre, actif).
- **Bande d'état de l'édition** : alerte `budget_over` quand, pour une catégorie, réalisé retenu + engagé restant > prévu (budget validé seulement). Elle s'éteint comme les autres alertes, par une décision qui la règle (`Decision.alertKind`).

Vocabulaire : tous les libellés via `lib/vocab.ts` (`npm run check:vocab`).

## 5. Sécurité

- **Salaires** : le détail du Personnel par personne (heures × coût) révèle une rémunération. Il n'est **sérialisé** que pour `treasury.view` ou `budget.validate` ; les autres reçoivent le total de la catégorie et le nombre d'heures non valorisées, sans nom ni coût. Filtre dans le loader, avant l'envoi.
- Lecture du budget : mêmes règles que la lecture de l'édition (périmètre).
- Pas de nouvelle route HTTP ; l'export CSV passe par une route gardée `sessionExportAllowed` + contrôle de l'édition.

## 6. Tests

- **Unitaires** (`tests/unit/budget-plan.test.ts`) : préfixe le plus long, Non classé, produits ignorés ; coût horaire (règle absente → null, mois sans heures → null, changement de coût en cours d'année) ; valorisation du temps et heures non valorisées ; surcharge prioritaire sur le calcul ; engagé restant jamais négatif ; écart et % ; source `raf` contre `ledger` sans double comptage.
- **Sécurité** (`tests/security/`) : un pilote ne prépare pas le budget d'une édition d'un autre pôle ; un rôle sans `budget.validate` ne valide pas et ne pose pas de surcharge ; le détail Personnel n'est pas dans la réponse d'un contributeur ; surcharge sans motif refusée.
- **Recette** (`tests/budget-previsionnel.spec.ts`) : préparer → soumettre → valider → modifier une ligne (repasse « à valider ») → surcharge du Personnel avec motif → l'écart et l'alerte s'affichent ; export CSV.
- `npm run check` vert à chaque commit, `check:full` avant déploiement.

## 7. Déploiement

Module activable par instance (`INSTANCE_MODULES` : `budget`), actif par défaut dans le fichier client TLST ; CRESS au choix. Migration rejouée sur un dump restauré de chaque instance avant déploiement (règle production-déploiement).

## V2 — présentation au financeur (hors V1, consignée)

- **Modèle de financeur** : `FunderTemplate` (financeur facultatif, nom, version) et ses **rubriques** (`FunderRubric` : libellé, ordre, type montant | quantité).
- **Correspondance** notre catégorie → rubrique, par modèle (plusieurs de nos catégories vers une rubrique) ; **forçage par ligne** de budget quand une catégorie se répartit entre deux rubriques.
- **Suggestions** de rapprochement, sans IA : dictionnaire de synonymes tenu dans l'outil (« salaires, masse salariale, RH » → Personnel ; « presta, services extérieurs, honoraires » → Prestations ; « invest, immobilisations » → Investissement), termes normalisés, et d'abord les correspondances déjà validées ailleurs. Une rubrique ambiguë (« Fonctionnement ») propose plusieurs candidats ; la personne valide.
- **Règles de forfait** attachées au modèle (coûts indirects 15 % / 40 % des frais de personnel, FSE).
- **ETP** : quantité issue du temps passé et des jours vendus (`EditionPersonDays`), pas un reclassement d'euros.
- **Budget présenté par dossier** : vue du budget des éditions financées, dans les rubriques du modèle ; coût total et part éligible ; taux du financeur.
- **Export du bilan** dans les rubriques du financeur (CSV, puis .xlsx).
- Dossier pilote pour la V2 : FSE+ (cofinancement, forfait, bilans semestriels).
