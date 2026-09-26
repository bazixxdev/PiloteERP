# Vocabulaire, validation par niveaux, fin de la délégation (design du 26/09/2026)

Complément de `2026-09-26-actions-composantes-design.md`, décidé avec Gaël le même jour après relecture du guide de
l'outil. Quatre points : le mot « sponsor », le mot « année », les notions propres à la CRESS (CODIR, bureau, séminaire)
et la délégation. Les deux specs forment un seul plan de réalisation.

## Décisions prises

| Point | Décision |
|---|---|
| « Sponsor » | un **mot du vocabulaire** de chaque instance (`V.sponsor`) : CRESS « référent direction », TLST « référent CA » (modifiables d'une ligne) ; choix parmi **toutes** les personnes actives, y compris celles qui ne suivent pas leur temps |
| « Année » | gardé **à l'essai** (« en sursis ») ; le **millésime** s'affiche partout où c'est possible ; changer le mot demain = une ligne par instance, **tests compris** |
| Écran CODIR | renommé **« Arbitrages »** |
| Séminaire | renommé **« Préparer 2027 »** (le millésime suivant) ; la décision reconduire / ajuster / arrêter est consignée comme une décision datée, plus dans la fiche |
| Couche 4 de la fiche | un **circuit de validation par niveaux**, réglé par instance dans l'admin, à la place de « décision du CODIR / date du séminaire / validé par le CA » |
| « Bureau » (TLST) | disparaît ; là où il faut nommer le groupe qui arbitre, TLST dit « coordination » |
| Délégation | **supprimée comme objet à part** ; « ce qui est confié » et « marge de décision » passent sur l'action ; « Ma délégation » devient **« Mes actions »** |

## 1. Le mot « sponsor »

- Nouveau mot `sponsor` dans `config/clients/*.ts` (`Word`) : CRESS `{ one: "référent direction", many: "référents direction", gender: "m" }`,
  TLST `{ one: "référent CA", many: "référents CA", gender: "m" }`. Le champ garde sa colonne (`Edition.sponsorId`).
- Définition (guide et info-bulle) : « la personne de la gouvernance (direction, CA) qui soutient le projet en instance ;
  à ne pas confondre avec le garant, qui répond du projet au quotidien ».
- La liste de choix n'est plus filtrée sur l'accès direction : toute personne active.

## 2. « Année », à l'essai

- Règle d'affichage : partout où l'objet est un projet précis, on écrit **le millésime** plutôt que le mot : « Équipe 2026 »,
  « Fil 2026 », « Bilan 2026 », « Budget 2026 », « Temps 2026 ». Le mot seul ne reste que dans les phrases générales
  (« chaque année du projet », « l'année du projet »). Relecture des usages de `V.edition` à faire dans le plan (≈ 220).
- **Ne pas être piégé** : changer un mot du vocabulaire doit se faire en une ligne par instance.
  - Interface : déjà vrai (`lib/vocab.ts`, `npm run check:vocab`).
  - Tests : les recettes (`tests/*.spec.ts`) et `tests/unit/clients.test.ts` n'écrivent plus les mots du vocabulaire en dur ;
    elles les lisent dans `config/clients/<client>.ts` (un petit utilitaire de test qui compose « Portefeuille des projets »,
    « aucune année rattachée »… avec les mêmes fonctions que l'interface). `clients.test.ts` vérifie la forme des mots,
    plus leur valeur. Une sentinelle (`check:vocab` étendu aux tests) refuse un mot du vocabulaire en dur dans une assertion.
- Surcharge du vocabulaire depuis l'admin, sans déploiement : **feuille de route**, avec l'écran Admin › Apparence
  (`docs/LOTS-TLST.md`).

## 3. Arbitrages, préparer l'année suivante, validation par niveaux

**Écran « Arbitrages »** (ex-« Écran CODIR », même adresse `/codir`) : alertes, validations en attente, décisions à
consigner. Seul le nom change.

**« Préparer 2027 »** (ex-« Séminaire », même adresse `/seminaire`) : pour chaque projet, reconduire, ajuster ou arrêter ;
création en lot des années suivantes (règles de reconduction de la spec « actions ») ; contrôle de la charge. La décision
n'est plus écrite dans `codirDecision` de l'année source : elle devient une **décision** (`Decision`, instance choisie
dans la liste de l'admin, texte « Reconduit / Ajusté / Arrêté pour 2027 »), datée, sur l'année source. « Arrêté » range
le projet (archivé) après confirmation.

**Circuit de validation de la fiche** (couche 4) :

```prisma
// Réglé par instance dans Admin › Paramètres : la liste ordonnée des niveaux qui valident une fiche.
model FicheValidationLevel {
  id         String  @id @default(cuid())
  order      Int
  label      String  // « Direction », « CA », « Coordination »…
  permission String  // droit exigé pour décider à ce niveau (Admin › Rôles et droits), ex. « fiche.validate.1 »
  active     Boolean @default(true)
}

// Une décision à un niveau, sur la fiche d'une année.
model FicheValidation {
  id         String   @id @default(cuid())
  editionId  String
  edition    Edition  @relation(fields: [editionId], references: [id], onDelete: Cascade)
  levelId    String
  level      FicheValidationLevel @relation(fields: [levelId], references: [id], onDelete: Restrict)
  decision   String   // approved | rework | refused
  comment    String?
  deciderId  String
  decider    Person   @relation(fields: [deciderId], references: [id])
  decidedAt  DateTime @default(now())
  @@index([editionId])
}
```

Règles :
- Les niveaux se décident dans l'ordre ; un niveau n'est proposé qu'une fois le précédent « validé ».
- « Validé » au dernier niveau : l'année passe « validée » et la fiche se verrouille (règle actuelle de `lib/lock.ts`,
  qui lira ce circuit au lieu de `codirDecision`). « À retravailler » à un niveau : l'année passe « re-challengée », le
  circuit repart du premier niveau à la prochaine demande. « Refusé » : l'année reste « proposée », avec le commentaire.
- On ne décide jamais à un niveau pour sa propre fiche (même garde que les validations de dépenses).
- Niveaux par défaut posés par le seed et par la migration : CRESS « 1. Direction » puis « 2. CA » ; TLST « 1. Coordination »
  puis « 2. CA ».
- Migration (expand) : `codirDecision` renew → un `FicheValidation` « validé » au niveau 1, adjust → « à retravailler »,
  stop → « refusé » avec le commentaire « arrêt décidé » ; `boardValidated` → « validé » au niveau 2 à `boardDate`.
  Auteur : la personne tracée dans l'historique quand elle existe, sinon la direction. Les anciennes colonnes restent
  jusqu'au contract.

**Le mot `V.codir`** ne sert plus qu'à nommer le groupe qui arbitre (le droit « accès direction ») : TLST passe de
« bureau » à « coordination ». Les ≈ 47 usages sont relus : ceux qui nommaient l'écran ou l'événement disparaissent
(« Arbitrages », « Préparer 2027 », niveaux du circuit).

## 4. Fin de la délégation comme objet à part

- **Sur l'action** (spec « actions », § 1) : deux champs texte facultatifs, `entrusted` « Ce qui est confié » et
  `latitude` « Marge de décision » (« jusqu'à 500 € par achat »), visibles sur la page de l'action, modifiables par qui
  modifie l'action.
- **« Mes actions »** (`/mes-actions`, rubrique Mon travail, remplace « Ma délégation ») : les actions dont je suis
  responsable ou personne associée, avec ce qui est confié, la marge de décision, les jalons (dont les points de
  contrôle) et mes tâches, filtrables par période (les périodes de l'admin actuelles sont gardées). Export Word
  « feuille de mission » par personne et par période, pour le CA. La coordination voit « Mes actions » de chacun
  (droit existant sur le temps de l'équipe).
- **Tombe** : la prise de connaissance, l'historique des textes, la présentation au CA (si le CA valide, c'est une
  décision datée, comme les autres).
- **Données** : TLST — les 10 délégations sont reconstruites par la reprise refaite (spec « actions », § 4) : attendus
  et limites de chaque objectif sur l'action correspondante, objectifs datés en tâches, contrôles en jalons. CRESS —
  module non activé, rien à reprendre.
- **Code** : le module `delegation` est éteint et retiré de la navigation dans cette release ; les tables `Delegation`,
  `DelegationRevision`, les droits `delegation.*`, `lib/delegation*.ts` et le test SEC-31 partent au contract (release
  suivante), après vérification que rien ne les lit.

## 5. Guide de l'outil

Réécrire : sponsor (mot de l'instance), année (règle du millésime), Arbitrages, Préparer l'année suivante, circuit de
validation, Mes actions, ce qui est confié / marge de décision ; retirer Délégation, Séminaire, « bureau ».

## 6. Tests

- Unitaires : ordre des niveaux, garde « pas sa propre fiche », passage validée / re-challengée ; copie de migration
  (`codirDecision`, `boardValidated`) ; utilitaire de vocabulaire des tests.
- Recette : une fiche passe les deux niveaux et se verrouille ; « à retravailler » la re-challenge ; « Préparer 2027 »
  consigne des décisions et crée les années ; « Mes actions » montre confié / marge / contrôles ; le sponsor se choisit
  parmi toutes les personnes ; les recettes passent avec un vocabulaire modifié (un test lance l'instance TLST).
