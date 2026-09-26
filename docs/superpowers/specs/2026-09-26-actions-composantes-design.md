# L'action, composante du projet (design du 26/09/2026)

Décidé avec Gaël le 26/09/2026. Point de départ : Gaël ne comprenait plus l'articulation projet / année / action, et
pour lui « une action, c'est un truc ou une série de trucs, composante importante du projet » : une formation métiers,
une série d'ateliers cuisine sur un an, un forum, des cours du soir. Vérification faite dans tout le corpus (CRESS et
fichiers réels de TLST, voir « Sources ») : **c'est bien ça**. L'unité actuelle de l'outil (une date, un responsable,
un état) est en réalité la **tâche** du rétroplanning type de la CRESS ; elle vient d'une proposition Bazixx (workflow v0,
« à trancher à l'atelier »), pas du corpus.

Ce document couvre le **chantier 1** : l'action refondue, les projets internes, les personnes qui ne suivent pas leur temps.
Deux chantiers voisins, décidés le même jour, auront leur propre conception : le **temps passé sur les dossiers de
financement** (chantier 2) et **confier une tâche à un collègue**, sous un droit configurable (chantier 3).

## Décisions prises

| Question | Décision |
|---|---|
| Qu'est-ce qu'une action | une **composante du projet** qui peut durer et se répéter : période, récurrence, public, jalons, tâches, financements, budget |
| Où vit une action qui dure plus d'un an | **sur le projet**, avec une **période** ; elle apparaît dans chaque année qu'elle couvre. La vue annuelle (bilan, heures, jalons, réalisations) est un filtre par dates. Écartés : la recopie à chaque reconduction (doublons, historique coupé, liens de financement à refaire) et l'action « qui déborde » de son année de départ (droits ambigus) |
| Les dates d'une action | **zéro, un ou plusieurs jalons** (le mot de la CRESS : « dates jalons ») ; jamais obligatoires. Pas de « séance » : trop précis, beaucoup d'actions n'en ont pas |
| Action et financement | liens **action ↔ lignes de financement**, autant qu'il faut, avec un **montant facultatif** en euros ; un lien à une ligne d'un dossier pluriannuel s'étend aux autres années du dossier couvertes par l'action |
| États | à développer · en cours · terminée · abandonnée (légende de TLST, plus « abandonnée ») |
| Projets internes | un **type** de projet « financé » (défaut) ou « interne » ; code analytique toujours obligatoire |
| Membres du CA, bénévoles | une case **« suit son temps »** sur la personne ; décochée, elle sort de tout ce qui concerne le temps mais peut porter des actions et des tâches |
| Valorisation du bénévolat | **feuille de route** (`docs/LOTS-TLST.md`), pas dans ce chantier |

## Sources (corpus vérifié le 26/09)

- CRESS : fiche action ASER (« Action qui s'inscrit dans quel projet », décrite par ses séquences, public, ETP, budget,
  indicateurs par séquence) ; Plan opérationnel 2026 (AIO mensuel, visites apprenantes 1re/2e/3e, formations de
  septembre et mars, stands de novembre à mars n+1) ; onglet « plan d'action » (petits-déj ORESS : une ligne, trois dates) ;
  fiche projet type (« Dates jalons ») ; entretiens (temps et budget suivis « action par action », cofinancement d'une
  même action) ; rétroplanning type (« Tâche à accomplir | par qui ? | État » = l'action actuelle de l'outil).
- TLST : récap AAP, tableau d'actions (NOM, RÉCURRENCE, DÉBUT et FIN en mois, MONTANT UNITAIRE et TOTAL, AAP ASSOCIÉS ;
  même nom répété sur plusieurs lignes de sous-activités ; couleur = état) ; livrables, obligations de convention et
  versements dans des tableaux à part ; feuille de délégation (objectifs datés = tâches, contrôles datés) ; erp-tlst
  (action = activité avec période, statut, plusieurs AAP).

## 1. Données

Migration « expand » (`.agents/rules/donnees-migrations.md`) : on ajoute, on copie, on ne supprime rien. Les anciennes
colonnes restent jusqu'à une release suivante (§ 7).

```prisma
model Action {
  // … champs existants conservés (name, ownerId, timeTarget, state, order, description…)
  projectId   String?   // NOUVEAU, rempli par la migration ; obligatoire dans le code
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: Restrict)
  startDate   DateTime? // NOUVEAU : début de la période (rempli par la migration)
  endDate     DateTime? // NOUVEAU : fin de la période ; ≥ startDate
  recurrence  String?   // NOUVEAU : texte libre, « 12 ateliers de 3,5 h/an »
  audience    String?   // NOUVEAU : public, bénéficiaires
  people      ActionPerson[]
  milestones  Milestone[]
  fundings    ActionFunding[]
  expenses    Expense[]
  indicators  Indicator[]
  // Anciens champs gardés en lecture seule jusqu'au contract : editionId, milestoneDate, venue, participants,
  // isPublic, isCheckpoint, fundingLineId.
}

// Personnes associées à une action (en plus du responsable).
model ActionPerson {
  actionId String
  personId String
  action   Action @relation(fields: [actionId], references: [id], onDelete: Cascade)
  person   Person @relation(fields: [personId], references: [id], onDelete: Cascade)
  @@id([actionId, personId])
}

// Jalon : une date qui compte dans une action (séquence, séance, fin de phase, remise, contrôle).
model Milestone {
  id           String    @id @default(cuid())
  actionId     String
  action       Action    @relation(fields: [actionId], references: [id], onDelete: Cascade)
  date         DateTime
  label        String
  done         Boolean   @default(false)
  doneAt       DateTime?
  venue        String?
  participants String?
  isPublic     Boolean   @default(false) // part dans le flux agenda du site
  isCheckpoint Boolean   @default(false) // contrôle d'une délégation
  order        Int       @default(0)
  @@index([actionId, date])
}

// Qui finance l'action : une ligne de financement (donc un financeur, une année), montant facultatif.
model ActionFunding {
  actionId      String
  fundingLineId String
  amount        Float?
  action        Action      @relation(fields: [actionId], references: [id], onDelete: Cascade)
  fundingLine   FundingLine @relation(fields: [fundingLineId], references: [id], onDelete: Restrict)
  @@id([actionId, fundingLineId])
}

model Expense   { actionId String? /* NOUVEAU, pré-rempli depuis la validation */ }
model Indicator { actionId String? /* NOUVEAU, facultatif */ }
model Project   { kind String @default("funded") /* NOUVEAU : funded | internal */ }
model Person    { tracksTime Boolean @default(true) /* NOUVEAU */ }
```

États : les codes restent `todo | doing | done`, on ajoute `abandoned`. Les libellés par défaut deviennent « À développer »,
« En cours », « Terminée », « Abandonnée » ; la migration ne réécrit un libellé en base que s'il vaut encore l'ancien
libellé par défaut (une instance qui l'a personnalisé le garde). L'ancien code `late` (calculé, rarement stocké) devient `doing` : le retard se lit sur les jalons et la période.

### Copie des données existantes (dans la même migration)

Pour chaque action existante, sans rien perdre :
- `projectId` = le projet de son année ;
- période : du 1er janvier au 31 décembre de son année ; si son jalon tombe après le 31 décembre, la fin est le jalon ;
- son `milestoneDate` devient un **jalon** (libellé = nom de l'action, `done` = état « fait »), qui reprend `venue`,
  `participants`, `isPublic` et `isCheckpoint` ; une action sans date n'a pas de jalon ;
- son `fundingLineId` devient un `ActionFunding` sans montant ;
- ses tâches, heures, réalisations et validations gardent leur `actionId`.

Requêtes de contrôle après migration, rejouées sur une copie restaurée des deux bases de production avant tout
déploiement : même nombre d'actions ; un jalon par ancienne action datée ; un lien par ancien `fundingLineId` ; aucune
action sans projet ni période ; totaux d'heures par action inchangés.

## 2. Règles

**Années d'une action.** Une action apparaît dans l'année Y de son projet si sa période chevauche Y. Une seule fonction
pure (`lib/actions.ts`, `runsIn(action, year)`) sert partout : onglet Actions, frise, alertes, délégation, fiche Word et
plan opérationnel, séminaire, saisie du temps, choix d'une action (validation, tâche, dépense, réalisation).

**Création.** Depuis l'année Y, une nouvelle action prend la période 1er janvier – 31 décembre de Y. Fin avant début :
refusé. Une réalisation, une tâche ou une dépense liées à une action se rattachent à l'année de leur date ; si cette année
n'existe pas encore pour le projet, l'outil le dit (« Créez d'abord l'année 2027 »).

**Droits.** Modifie une action : qui peut aujourd'hui modifier les actions d'une année (pilote, pôle, rôles) sur **l'une
des années que l'action couvre**, plus son responsable et ses personnes associées. Mêmes gardes serveur que l'existant
(`canEditActions`), étendues à la période.

**Financements.**
- Lier une action à une ligne qui appartient à un dossier : l'outil lie aussi, dans la même transaction, les lignes du
  même dossier sur les autres années du même projet que la période couvre (sans montant).
- Quand une ligne d'un dossier est créée sur une nouvelle année (rattachement, reconduction), elle est liée aux actions
  du projet déjà liées à ce dossier et qui courent cette année-là.
- Une ligne de financement liée à une action ne se supprime pas (comme aujourd'hui avec l'ancien lien) ; détacher une ligne d'un dossier garde ses liens.
- Somme des montants des liens d'une ligne > montant obtenu de la ligne (ou demandé s'il n'y a pas d'obtenu) : alerte
  douce sur l'année, jamais bloquante.

**Équilibre d'une action** (pour l'année affichée ou toute la période) : recettes = somme des montants de ses liens ;
dépenses = engagé + réalisé des dépenses rattachées ; temps valorisé = heures × coût horaire si le module budget est actif.
Affiché, jamais bloquant.

**Reconduction et séminaire.** Les actions qui courent l'année suivante sont déjà là : rien à copier. Le dialogue de
reconduction propose de recopier les actions **terminées ou dont la période finit dans l'année source** (hors
abandonnées), cochées par défaut ; la copie décale période et jalons d'un an, remet l'état à « à développer » et les
jalons à « non fait », ne copie ni tâches, ni heures, ni réalisations ; ses liens de financement suivent les lignes
recréées du même financeur. Le séminaire applique la même règle en lot. Une transaction par reconduction.

**Alertes** (remplacent « jalon dépassé » d'une action) : jalon passé non fait ; action dont la fin est passée sans être
terminée ni abandonnée ; objectif d'heures dépassé (sur toute la période) ; montants de financement supérieurs à l'obtenu.

**Projets internes.** Jamais dans « sans financement » ni dans « Qui finance quoi » sauf s'ils ont une ligne ; au
séminaire, proposés à la reconduction seulement s'ils sont récurrents ; chapitre à part « Structuration interne » dans le
plan opérationnel Word ; filtre financés / internes au portefeuille. Le reste est identique aux projets financés.

**Personnes qui ne suivent pas leur temps.** Absentes de la saisie et des relances, de la clôture mensuelle, du plan de
charge et de « Temps de l'équipe » ; la rubrique Temps disparaît de leur menu. Elles restent choisissables comme pilote,
responsable ou personne associée d'une action, membre de l'équipe d'une année, destinataire de tâche.

## 3. Écrans

- **Page de l'action** `/action/[id]` (nouvelle ; le panneau latéral disparaît), avec un sélecteur « année 2026 · toute la
  période » : en-tête (nom, état, période, récurrence, responsable et associés, « depuis 2025 · jusqu'en 2027 ») ;
  contenu et public ; jalons (ajout, fait, lieu, participants, public, point de contrôle) ; tâches (rétroplanning) ;
  financements (liens, montants) et équilibre ; heures par personne face à l'objectif ; réalisations ; indicateurs liés.
- **Onglet Actions de l'année** : le tableau des actions qui courent dans l'année (nom, responsable, période, prochain
  jalon, état, heures de l'année), puis la frise, les réalisations, les indicateurs.
- **Frise** : une barre par action (sa période, bornée à l'année), des points pour les jalons, des losanges pour les
  livrables de l'année.
- **Fiche du projet** : une section « Actions » (toutes, avec période et état), sous « Années ».
- **Ligne de financement et dossier** : section « Actions financées » (heures de l'année par personne, jalons tenus,
  réalisations, montant) ; export CSV « temps par action financée », par financeur et par année.
- **Agenda** : le flux public du site diffuse les jalons publics ; le flux personnel, les jalons des actions dont on est
  responsable ou associé, et ses tâches datées. Ma semaine, l'écran café et la vue annuelle lisent les jalons.
- **Délégation** : les objectifs de la personne = ses actions (responsable ou associée) et ses tâches sur l'année ; les
  contrôles = les jalons « point de contrôle » de ces actions.
- **Admin › Personnes** : case « suit son temps ». **Fiche du projet › Identité** : type financé / interne.
- **Guide de l'outil** (`lib/lexique.ts`) : Action, Jalon, Tâche, Point de contrôle, projet interne, « suit son temps »
  réécrits ; la règle « une date qui compte pour le pilotage = un jalon ; un geste = une tâche ».

## 4. Reprise des données

- **CRESS** (démo, pas de données réelles en production) : la démo est réécrite avec le nouveau modèle (petits-déj ORESS
  = une action à trois jalons ; ASER = une action à séquences ; un projet interne « Refonte du site » avec ses phases).
  En production, rechargement avec `--seed`, **sur accord de Gaël au moment du déploiement**.
- **TLST** (données réelles, reprise du 26/09) : **refaire la reprise depuis les fichiers d'origine** avec le nouveau
  modèle, à condition que rien n'ait été saisi dans la base depuis le 26/09 (contrôle par `ChangeLog`, `updatedAt` et
  saisies de temps, fait avant). Règles : lignes du récap au même nom d'action dans un même dossier = une action (les
  descriptions réunies dans le contenu) ; DÉBUT / FIN = période ; RÉCURRENCE = récurrence ; AAP ASSOCIÉS = liens de
  financement, montant total quand il existe ; couleur = état ; délégation : objectifs datés = tâches de la personne,
  contrôles datés = jalons « point de contrôle ». Le script (`/root/reprise-tlst/` sur le serveur) est adapté ici,
  **lancé par Gaël** après une sauvegarde, comme le 26/09. Si la base a reçu des saisies : migration seule, regroupement
  à la main.

## 5. Tests

- Unitaires (fonctions pures) : `runsIn` (chevauchement, bornes, période sur trois ans) ; copie de migration (action
  datée, non datée, jalon après le 31/12, lien de financement) ; propagation des liens à un dossier pluriannuel ; choix
  des actions à reconduire ; alerte de somme des montants ; équilibre.
- Recette : une action 2025–2027 visible dans 2025 et 2026 avec les heures de chaque année ; jalons (fait, public dans
  le flux) ; lien à un dossier pluriannuel propagé aux deux années ; reconduction sans doublon ; projet interne absent de
  « sans financement » ; personne « ne suit pas son temps » absente du plan de charge et de la saisie ; droits (un membre
  d'une année couverte modifie, un tiers non) ; délégation lit les jalons de contrôle.
- Migration rejouée sur une copie restaurée des deux bases de production, requêtes de contrôle du § 1.

## 6. Découpage en lots (un plan, plusieurs livraisons)

1. Schéma, copie des données, `runsIn`, lectures (onglet Actions, page de l'action, frise, alertes, agenda, délégation,
   Ma semaine, café, vue annuelle, fiche Word, saisie du temps).
2. Financements des actions : liens, montants, propagation, « Actions financées », export, équilibre, alerte.
3. Reconduction et séminaire.
4. Projets internes et « suit son temps ».
5. Démo CRESS réécrite, guide, reprise TLST adaptée.

## 7. Plus tard (release suivante, « contract »)

Quand plus rien ne lit les anciens champs : suppression de `Action.editionId`, `milestoneDate`, `venue`, `participants`,
`isPublic`, `isCheckpoint`, `fundingLineId` ; `projectId`, `startDate`, `endDate` passent `NOT NULL`. Consigné dans
`docs/decisions.md` au moment de le faire, rejoué sur copie de production.

Hors chantier : temps sur les dossiers de financement (chantier 2), tâches confiées à un collègue (chantier 3),
valorisation du bénévolat (feuille de route).
