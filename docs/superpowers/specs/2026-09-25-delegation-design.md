# Délégation : le cadre de travail d'une personne sur ses projets (design du 25/09/2026)

Décidé avec Gaël le 25/09/2026, à partir d'une feuille de délégation réelle de TLST (classeur daté, trois onglets par période : thème, grande mission, objectifs, attendus / limites, contrôle). But : que la coordination écrive **ce qu'elle délègue à une personne, sur quels projets, avec quelles limites et quels contrôles**, que la personne en prenne connaissance, et que le tout se relise au CA — **sans ressaisir** ce que l'outil sait déjà (actions, indicateurs, livrables).

## Décisions prises

| Question | Décision |
|---|---|
| À qui appartiennent attendus et limites | **à la personne sur un projet** (une délégation = une personne × une édition) |
| Les périodes (janvier-juin, juillet-août, septembre-décembre) | **une délégation par an** ; la période n'est qu'un **filtre** de la vue ; les objectifs sont des actions datées qui tombent d'eux-mêmes dans leur période ; attendus et limites s'éditent en cours d'année avec historique |
| Cycle de vie | **léger** : la coordination rédige, la personne **prend connaissance** en un clic (toute modification redemande cette prise de connaissance), la présentation au CA se consigne comme décision « CA », export .docx |
| Droits | **configurables** dans Admin › Rôles et droits |

## Correspondance avec la feuille de délégation

| Colonne du fichier | Dans l'outil | Nouveau ? |
|---|---|---|
| Thème (Agriculture et alimentation…) | pôle de l'édition (« équipe » chez TLST) | non |
| Grande mission (AGRINOV…) | édition | non |
| Objectifs / missions — résultat attendu, daté | **action** de l'édition, responsable = la personne | non |
| Objectifs / missions — chose à faire (« trouver le contact DREETS ») | **tâche** de la personne, rattachée à l'édition | non |
| Cible chiffrée (« 3 à 5 structures accompagnées ») | **indicateur** de l'édition (cible / réalisé) | non |
| Attendus // limites | **délégation** : attendus, limites | **oui** |
| Contrôle — modalités (« reporter mensuellement au CA ») | **délégation** : contrôles (texte) | **oui** |
| Contrôle — échéance (« bilan en mai et en août ») | action marquée **point de contrôle** | **oui** (un drapeau) |
| Bilans dus au financeur | livrables des lignes de financement de l'édition | non |

## 1. Données

Migration « expand » : deux tables, un drapeau, un réglage.

```prisma
// Une personne × une édition (le projet une année donnée).
model Delegation {
  id               String   @id @default(cuid())
  personId         String
  person           Person   @relation("DelegationPerson", fields: [personId], references: [id], onDelete: Restrict)
  editionId        String
  edition          Edition  @relation(fields: [editionId], references: [id], onDelete: Cascade)
  expectations     String?  // attendus
  limits           String?  // limites (« délégation totale avec les limites suivantes… »)
  controls         String?  // modalités de contrôle (« reporter mensuellement au CA »)
  acknowledgedAt   DateTime? // prise de connaissance par la personne ; remise à null à chaque modification des textes
  boardPresentedAt DateTime? // dernière présentation au CA
  createdById      String
  createdBy        Person   @relation("DelegationAuthor", fields: [createdById], references: [id])
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  revisions        DelegationRevision[]
  @@unique([personId, editionId])
}

// Historique : l'état des textes **avant** chaque modification.
model DelegationRevision {
  id           String     @id @default(cuid())
  delegationId String
  delegation   Delegation @relation(fields: [delegationId], references: [id], onDelete: Cascade)
  expectations String?
  limits       String?
  controls     String?
  authorId     String     // qui a fait la modification qui a remplacé ces textes
  createdAt    DateTime   @default(now())
}
```

- `Action.isCheckpoint Boolean @default(false)` : l'action est un point de contrôle (bilan intermédiaire, planning de dépense à rendre).
- `Settings.delegationPeriods String @default("01-06,07-12")` : les périodes proposées en filtre (mois de début-mois de fin, séparés par des virgules). Seed TLST : `01-06,07-08,09-12`.
- `onDelete: Restrict` vers la personne : une personne ne se supprime pas, elle part (`leftAt`) ; ses délégations restent lisibles.

## 2. Commandes et droits

Deux droits nouveaux dans `lib/permissions.ts`, dans un nouveau groupe `delegation` (« Délégations ») de l'écran Rôles et droits :
- `delegation.write` — « Rédige les délégations » : sur les éditions de son périmètre (son pôle ; tout avec `scope.all`).
- `delegation.view_all` — « Lit toutes les délégations ».

Par défaut : direction / coordination → les deux. **Chacun lit toujours les siennes** et est seul à pouvoir en prendre connaissance. Réglable ensuite dans Rôles et droits.

Commandes (`app/actions/delegation.ts`, aucune par `saveField`) :

| Commande | Qui | Effet |
|---|---|---|
| `createDelegations(personId, editionIds[])` | `delegation.write` sur chaque édition | crée les délégations manquantes (idempotent : une existante n'est pas doublée) ; notifie la personne |
| `updateDelegation(id, { expectations, limits, controls })` | `delegation.write` | en **une transaction** : copie de l'état précédent dans `DelegationRevision`, écriture, `acknowledgedAt = null` ; notifie la personne |
| `acknowledgeDelegations(ids[])` | **la personne concernée uniquement** | pose `acknowledgedAt` ; une délégation d'une autre personne est refusée même pour la coordination |
| `consignBoardPresentation(personId, year, date, note?)` | `delegation.write` | en une transaction : `boardPresentedAt` sur ses délégations de l'année, et une **décision** `instance = board` sur chaque édition concernée (« Délégation de … présentée au CA le … »), visible dans l'historique de la fiche |
| `deleteDelegation(id)` | `delegation.write` | supprime la délégation et son historique (confirmation) ; les actions, tâches et indicateurs ne sont pas touchés |
| `setActionCheckpoint(actionId, bool)` | droit d'édition des actions de l'édition (`canEditActions`) | pose le drapeau |

Les objectifs se créent depuis la vue avec la commande d'action **existante** (même droit, même invariants) : responsable pré-rempli avec la personne. Pas de second moteur de création.

Notifications (modèle `Notification` existant, nouvelle valeur `kind = delegation` à côté de `time_reminder | info | deadline`) : « nouvelle délégation », « délégation modifiée, à relire ». Elles s'éteignent à la prise de connaissance.

## 3. La vue « Délégation »

Adresse : `/delegation?personne=<id>&annee=2026&periode=09-12`.
- « Mon travail › Ma délégation » ouvre la sienne. Qui a `delegation.write` ou `delegation.view_all` voit en tête une liste des personnes (avec « à relire » / « lu le … » / « présentée au CA le … »).
- Filtre de période : les périodes du réglage, plus « toute l'année ».

Contenu, groupé par pôle (le « thème » du fichier), une carte par édition déléguée :
- **Attendus, limites, contrôles** (textes de la délégation) ; lien « historique » vers les versions précédentes (qui, quand, ancien texte).
- **Objectifs** : actions de l'édition dont la personne est responsable, dont l'échéance tombe dans la période, plus celles sans échéance ou en cours non terminées. État, échéance, retard en rouge.
- **Points de contrôle** : actions de l'édition marquées `isCheckpoint` dont l'échéance tombe dans la période, quel que soit leur responsable.
- **Indicateurs** de l'édition : cible, réalisé.
- **Bilans dus au financeur** : livrables des lignes de financement de l'édition dont l'échéance tombe dans la période.
- **Tâches** : visibles **seulement par la personne elle-même** (une tâche est personnelle ; la coordination ne les voit pas, sauf si elles sont dans une liste partagée, comme aujourd'hui).
- Périodes antérieures de l'année : repliées, consultables (c'est l'« historique en colonnes » du fichier).

En pied de page : état de prise de connaissance, bouton « J'ai pris connaissance » (pour la personne), « Consigner la présentation au CA » (pour qui rédige), **Exporter en .docx** (bibliothèque `docx` déjà utilisée par `lib/fiche-docx.ts`) — l'export contient les mêmes blocs, **sans les tâches**.

Vocabulaire via `lib/vocab.ts` (`npm run check:vocab`). Module activable par instance : `delegation` (actif pour TLST).

## 4. Sécurité

- Lecture : la personne elle-même, ou `delegation.view_all`, ou `delegation.write` sur le périmètre ; filtre **avant** sérialisation (SEC-04/17). Une délégation hors de ces cas n'est pas renvoyée, même par l'identifiant dans l'URL.
- Prise de connaissance : seule la personne concernée, vérifié côté serveur (pas un bouton masqué).
- Les tâches d'une personne ne sortent jamais dans la réponse de la vue lue par quelqu'un d'autre.
- L'export .docx passe par une route gardée `sessionExportAllowed` + les mêmes règles de lecture.

## 5. Tests

- **Unitaires** (`tests/unit/delegation.test.ts`) : filtre de période (échéance dedans, sans échéance, en cours à cheval, terminée hors période) ; lecture des périodes du réglage ; regroupement par pôle.
- **Sécurité** (`tests/security/`) : un contributeur ne lit pas la délégation d'un autre ; la coordination ne peut pas prendre connaissance à la place de la personne ; les tâches d'une personne sont absentes de la réponse lue par la coordination ; `delegation.write` limité à son pôle sans `scope.all`.
- **Recette** (`tests/delegation.spec.ts`) : la coordination crée la délégation de X sur deux éditions, écrit attendus et limites → X est notifié, lit, prend connaissance → la coordination modifie les limites → « à relire » et historique → présentation au CA consignée (décision visible sur la fiche) → export .docx ; filtre septembre-décembre qui montre les bons objectifs.
- `npm run check` vert à chaque commit, `check:full` avant déploiement.

## Hors V1 (consigné)

- Reconduire les délégations quand une édition est reconduite en N+1 (attendus et limites copiés, prise de connaissance remise à zéro).
- Signature formelle ou validation par vote du CA.
- Rappel automatique du « report mensuel » (aujourd'hui : texte de contrôle + points de contrôle datés).
