# Lots « ce qui manque au Pilote et existe dans erp-tlst » — plan du 15/09/2026 (corrigé le soir même)

Contexte : le Pilote devient le produit (`docs/produit.md`, mis de côté). En attendant, on complète le prototype CRESS avec les fonctions qu'`erp-tlst` a et que le Pilote n'a pas, **quand elles servent la CRESS**. Analyse complète : `CRESS/point-fusion-erp-tlst-pilote.md`.

Règle de reprise : on reprend de TLST les **règles et les idées** (idempotence, statuts calculés jamais stockés, snapshot sans clé étrangère, promotion veille → dossier), et les **fichiers sans interface** quand ils sont propres (client API Pennylane, moteur de synchro). Jamais les écrans (kit Base UI incompatible). Chaque lot = modèle + migration + seed + écran + tests Playwright + ligne dans `evolutions.md` ; démo redéployée par Gaël (`./deploy/deploy.sh --seed`).

Corrections de Gaël du 15/09 intégrées : les versements se règlent par la RAF **et la direction** ; la veille est un **module activable** ; la matrice qui-finance-quoi manque vraiment (les données existent, pas la vue) ; le vocabulaire édition / action / financement doit être fixé ; la compta réelle vient de **plusieurs sources** (fichier importé = la base, API Pennylane en premier, Excel « en direct » à préciser) et porte surtout sur les **dépenses tagguées par code analytique** ; la CRESS n'est **pas** sur Dolibarr pour la compta.

## 0. Le vocabulaire, une fois pour toutes

Ce que l'outil appelle chaque chose aujourd'hui, et à quoi ça correspond chez TLST. À reprendre dans l'aide « ? » de l'outil (lot C) et à faire valider le 28/09 (question 1 du cahier des charges).

| Mot du Pilote | Définition | Exemple CRESS | Équivalent TLST |
|---|---|---|---|
| **Projet** | ce qui se répète d'une année sur l'autre : un code analytique, un pilote, un pôle, une mission | « Mois de l'ESS » (MOI-01) | — (« un objet Projet regroupant des actions » était à décider) |
| **Édition** | le projet **une année donnée** : la fiche en quatre couches, le budget, l'équipe, le temps, les financements, la décision du CODIR | « Mois de l'ESS 2026 » | `Action` TLST (rattachée à n AAP) |
| **Action** | une étape ou une occurrence **dans** l'édition : un jalon daté, un responsable, un état, éventuellement publique | « Soirée de lancement 14/11 », « Publication du baromètre » | — (pas de niveau en dessous) |
| **Financeur** | l'organisation qui paie | Région, FSE, État/DREETS | `Partenaire.estFinanceur` |
| **Ligne de financement** | **le cas courant** : un financement d'un financeur pour une édition — demandé, accordé, code analytique, livrables. Sans convention rattachée = financement annuel propre à l'édition (1 financeur = 1 projet = 1 an) | Région → Mois de l'ESS 2026 : 20 000 € | `ActionAap` (le lien, en %) |
| **Convention** | **l'exception** : un accord qui couvre **plusieurs années ou plusieurs projets** (montant notifié, statut à déposer → justifié) ; ses lignes sont ses affectations, plafonnées au notifié. Peu nombreuses, mais les plus grosses et les plus risquées en justification | FSE 2026-2028, CPO État du DLA | ≈ `FicheAap` |
| **Livrable** | ce qu'on doit au financeur, daté | bilan intermédiaire FSE au 30/06 | — (« hors V1 » chez TLST) |
| **Versement** *(lot A)* | l'argent attendu puis reçu, sur une convention ou une ligne | acompte 50 % Région | `Versement` |
| **Appel à projets** *(lot B)* | une opportunité de financement à étudier, avant qu'elle devienne une convention | AAP ADEME 2027 | `AppelProjet` (veille) |
| **Dépense** | engagée (devis approuvé) puis réalisée (facture), saisie côté RAF | prestation graphiste 1 800 € | — |
| **Code analytique** | la clé qui relie la compta à l'outil ; aujourd'hui sur le projet et sur la ligne de financement | MOIS, FSE-26 | `codeAnalytique` sur la fiche |

Une édition a **0, 1 ou n lignes de financement**, donc 0, 1 ou n financeurs. C'est bien en base ; ce qui manque est la vue croisée (lot C).

**Convention ≠ règle** (Gaël, 15/09) : dans la vraie vie, une convention = un projet dans la plupart des cas. Le corpus le confirme et le nuance : la directrice dit « pas de financement pluriannuel » (S3.35), la RAF cite FSE 2026-2028 (S7.37) ; le DLA cumule « CPO triennale + conventions annuelles État et BDT + FSE 2026-2028 » (D9.1.4). Conséquences : les versements (A) et la matrice (C) se lisent **par ligne d'abord**, la convention n'apparaît que si elle existe ; **à vérifier avec la RAF** (mémo rouge) : la liste des conventions en cours et combien de projets chacune couvre — si tout est 1:1 sauf FSE et CPO, la page Conventions devient un repli de la ligne plutôt qu'une entrée de menu.

## Ce qu'on ne reprend pas, et pourquoi

| Fonction TLST | Pourquoi non |
|---|---|
| Adhérents + HelloAsso | la CRESS gère ses adhérents dans Dolibarr (D8.1) ; à évoquer le 28/09 seulement |
| Trésorerie | hors cahier des charges |
| Brevo | la CRESS est Microsoft |
| RH contrats, ETP, masse salariale | GRH hors outil ; sensibilité S4.97 ; le Pilote a déjà rythmes et jours disponibles |
| Matériel & prêts | spécifique tiers-lieu |
| ~~Postgres~~ | **fait le 17/09** (lot P, RETOURS-A-CHAUD §R) |

## Lot 0 — Modules activables par instance (prérequis, petit) — **FAIT le 15/09** (RETOURS-A-CHAUD §M)

Aujourd'hui les modules sont **par personne** (`Person.modules` : tâches, notes, répartition). Il faut le même mécanisme **par installation** : `Settings.modules` (liste), lu par la navigation, les routes et les onglets ; un module éteint disparaît, ses données restent. Premier module concerné : la veille (lot B). Réglable dans admin › Paramètres. C'est aussi la première brique de `produit.md`.
**Taille** : ½ session, à faire au début du lot B.

## Lot A — Versements : l'argent attendu et reçu — **FAIT le 15/09** (RETOURS-A-CHAUD §L, `tests/versements.spec.ts`)

**Besoin CRESS** : suivre ce qui est notifié, ce qui est versé (acomptes, soldes FSE à N+1), ce qui reste à percevoir. Le Pilote s'arrête à `amountGranted` ; rien n'existe entre « notifié » et « justifié ».
**Repris de TLST** : `Versement` (libellé, montant, date prévue, date reçue), `totalRecu`, `resteAPercevoir`, bandeau demandé / obtenu / versé / reste. Statut attendu / reçu **calculé** de `receivedAt`, jamais stocké.
**À construire**
- Modèle `Payment` rattaché à une `FundingLine` (cas courant) **ou** à une `Convention` (accord pluriannuel / multi-projets) ; `label`, `amount`, `expectedAt`, `receivedAt?`, `reference?`, `note?`.
- Écrans : `/conventions/[id]` bloc « Versements » ; onglet Budget › Recettes de l'édition : versements de la ligne ; `/conventions` colonne « Versé / reste » ; `/financeurs` : versé sur l'année.
- Radar `/echeances` + passerelle : versement attendu dépassé de 30 j = notification à la RAF **et à la direction**.
- Droits : `canEditFunding` = **RAF et direction** (déjà le cas dans `lib/rights.ts`) ; lecture pour le pilote sur ses éditions. Plus tard, un rapprochement compta (lot D) pourra proposer « reçu », mais la pose reste humaine.
- Seed : versements réalistes sur FSE, Région, État (un en retard). Tests : créer, marquer reçu, reste à percevoir, alerte.
**Taille** : 1 session.

## Lot B — Appels à projets : la veille (module activable) — **FAIT le 15/09** (RETOURS-A-CHAUD §M, `tests/appels.spec.ts`)

**Besoin CRESS** : le calendrier des AAP par financeur vit dans `Funder.notes` en texte libre ; « on dépose ou pas ? » n'est tracé nulle part.
**Repris de TLST** : statut **d'équipe** distinct du contenu (à étudier / on dépose / écarté, qui, quand), badge « nouveau », un appel retiré n'est jamais supprimé, **promotion** en dossier pré-rempli sans doublon, contrat zod du flux pour un import plus tard.
**À construire**
- Lot 0 d'abord ; `veille` dans `Settings.modules`.
- Modèle `Call` : `funderId`, `label`, `scheme?`, `deadline?` ou `rolling`, `recurring`, `link?`, `note?`, `teamStatus?` + `statusById/At`, `conventionId?`, `active`.
- Écran : onglet « Appels à projets » dans Projets et financements (tri par échéance, filtres, « Étudier » → `Convention` `to_submit` pré-remplie et reliée ; badge « Convention créée ») ; bloc sur `/financeurs/[id]` ; radar `/echeances` pour les appels « on dépose ».
- Saisie manuelle dans ce lot ; import JSON/CSV plus tard.
- Seed : 6-8 appels réels (FSE, Région, ADEME, Banque des Territoires, Cap'Asso). Tests : statut d'équipe, promotion, refus de doublon, module éteint = onglet absent.
**Taille** : 1 session (+ ½ pour le lot 0).

## Lot C — « Qui finance quoi » : la matrice éditions × financeurs — **FAIT le 15/09** (RETOURS-A-CHAUD §N, `tests/matrice.spec.ts`)

**Constat** : les données existent (une édition → n lignes de financement → n financeurs) mais aucune page ne les croise ; on les voit édition par édition (onglet Budget › Recettes) ou financeur par financeur (`/financeurs`). Le portefeuille ne cite le financeur que sur un livrable.
**Repris de TLST** : `/pilotage` — matrice en lecture pure (fonctions pures testables), couverture par colonne, argent non fléché, éditions orphelines, montants remplacés par des pastilles sans le droit, première colonne figée.
**À construire**
- `lib/matrix.ts` (pur) : lignes = éditions de l'année (périmètre Mon pôle / Toute la CRESS via `lib/scope.ts`), colonnes = financeurs ; cellule = accordé (sinon demandé, en italique, sinon « à déposer ») ; pied de colonne = total et, par convention, notifié − affecté ; pied de ligne = financé / enveloppe.
- Zones d'attention : éditions sans ligne de financement ; conventions sous-affectées ; lignes « à déposer » d'une édition déjà en cours ; livrables en retard par financeur.
- Page `/financements/matrice` (onglet de Projets et financements + raccourci depuis `/annuel`), export CSV par le jeton d'API.
- **Lexique** : le tableau du § 0 devient une page d'aide « ? » accessible depuis la matrice, la fiche et le portefeuille.
- Droits : montants pour RAF, direction, responsables de pôle ; pastilles pour les autres.
- Tests : matrice cohérente avec le seed, masquage des montants pour un contributeur.
**Taille** : 1 session.

## Lot D — Réalisé comptable : les dépenses tagguées par code analytique, plusieurs sources — **FAIT le 15/09** (RETOURS-A-CHAUD §O, `tests/realise.spec.ts`) ; « Excel en direct » et le logiciel réel restent à préciser

**Besoin CRESS (reformulé par Gaël)** : ce n'est pas d'abord rapprocher les montants perçus (lot A), c'est voir **les dépenses réelles de la compta, tagguées par code analytique, en face d'une édition, d'une action ou d'un financement**. Et ça doit marcher avec **plusieurs sources** : un fichier importé (la base), l'API Pennylane en premier connecteur, et peut-être un Excel « en direct ». La CRESS n'est pas sur Dolibarr pour la compta ; le logiciel réel reste à confirmer (Sandrine, partie technique non faite).
**Repris de TLST** : le **patron** `LigneRealise` — snapshot agrégé `(source, code analytique, compte, exercice)` avec `@@unique`, **sans clé étrangère**, upsert + purge par exercice et par source, 6x charges / 7x produits, détail par pièce ; et le **client Pennylane** + moteur de synchro (`src/lib/pennylane/client.ts`, `sync.ts` — TypeScript pur, réutilisables quasi tels quels, lecteurs injectables pour les tests). Le choix des axes analytiques Pennylane est un réglage, pas du code.
**À construire**
- **Sources** : (1) import de fichier xlsx/csv du grand livre analytique — format documenté, colonnes mappables à l'import (la base, marche avec n'importe quel logiciel) ; (2) connecteur Pennylane (`PENNYLANE_API_TOKEN`, axes à choisir dans l'admin) ; (3) « Excel en direct » : **à préciser avec Gaël** — un classeur à un chemin fixe (NAS / OneDrive) relu à la demande ? une feuille publiée en ligne ? Prévu par la structure (une source = un lecteur), pas codé tant que ce n'est pas clair.
- **Table de correspondance des codes** `AnalyticTag` : un code analytique → une cible **projet, édition, action ou ligne de financement** (aujourd'hui seuls projet et ligne portent un code). Suggestions de codes à la saisie (codes vus dans le réalisé), comme chez TLST.
- **Lectures** : onglet Budget de l'édition, bloc « Réalisé comptable » (charges par poste et par exercice, détail par pièce déplié) à côté de l'engagé / réalisé saisi ; par action quand le code le permet ; **par ligne de financement** = dépenses justifiables au financeur, face au montant accordé ; portefeuille : colonne réalisé compta.
- **Notes de frais** (lot G) : quand elles viennent d'un autre outil (Dolibarr aujourd'hui), elles arrivent par ce même canal — une source de plus, nature « frais », tagguée par code analytique ; rien de spécifique à coder ici.
- **Anti-double comptage** : `Settings.realizedSource = raf | ledger` décide qui alimente `spent` dans les alertes d'enveloppe ; l'autre s'affiche en regard sans compter.
- **Rapprochement des recettes** (lot A) : les 7x d'une ligne proposent « versement reçu ? » à la RAF / direction ; jamais posé automatiquement.
- Tests : import idempotent (rejouer = même résultat), purge d'un exercice, deux sources sur un même code, édition sans code.
**Taille** : 2 sessions (1 = snapshot + import fichier + lectures ; 2 = Pennylane + correspondances + rapprochement). Anticipe la V2 du cahier des charges (EF-E1b) : à lancer sur ton accord.

## Lot E1 — Fiche personne et « Préparer un départ » — **FAIT (17/09)**

`Person` gagne prénom / nom (le `name` reste et suit dans les deux sens), fonction, téléphone, arrivée / départ, note ; fiche en **panneau** sur Admin › Personnes (`?personne=`) avec ce que la personne porte ; chacun tient sa fonction et son téléphone dans Mon compte ; **« Préparer un départ »** (`/admin/depart/<id>`, EF-K3) : projets pilotés, garanties, responsabilité de pôle, sponsor, actions à faire, demandes ouvertes → un repreneur par bloc (même pôle proposé d'abord, repreneurs prévenus), retrait des équipes en cours, date de départ, désactivation ; rien n'est effacé. Les contacts externes ne sont **pas** des `Person` (parti pris validé le 17/09) : ils viendront avec les organisations (E2).

## Lot E2 — Organisations unifiées — **FAIT (18/09)**

`Funder` + `Supplier` → **`Organisation`** (`kinds` cumulables : funder / supplier / partner / network / authority ; SIRET, site, adresse, e-mail, téléphone, notes, actif), `FunderContact` → `OrganisationContact` (contact détaché par `leftAt`, jamais supprimé tant qu'un dossier le cite), `EditionPartner` (organisation × édition, rôle) en plus du texte `Edition.partners`. Migration de données : financeurs et fournisseurs repris avec leurs identifiants, même nom = une organisation à deux genres, validations remappées. **Les relations gardent leur nom de rôle** (`funder` d'une ligne / convention / appel, `supplierRef` d'une validation) : le code métier n'a pas bougé, seuls les accès à la table (`lib/organisations.ts` : `listFunders`, `listSuppliers`, `findOrCreateOrganisation`, `kindFilter`). Écrans : annuaire `/organisations` (filtre par genre, recherche, création, fiche en panneau avec genres, contacts, ce qui la cite), « Financeurs » inchangé (genre financeur), fournisseurs de l'admin = organisations de genre fournisseur, section « Partenaires » de la fiche d'édition (lier depuis l'annuaire ou par un nouveau nom, rôle, retirer). Repris de TLST : `Partenaire` unique + `estFinanceur` → ici des genres cumulables.

## Lot F — Comptes et connexion — **FAIT (17/09, e-mail / mot de passe)**

better-auth (hachage scrypt, sessions 7 jours, anti-force brute, désactivation = sessions fermées, mot de passe oublié par boîte d'envoi tant que les mails ne sont pas branchés), `User` ↔ `Person.userId`, admin › Comptes, Mon compte ; `getCurrentPerson` lit la session ; « Je suis… » derrière le drapeau `PILOTE_DEMO` ; Entra ID = second fournisseur sur le même `User`, plus tard. Pas de permissions par module en base dans ce lot → **lot F2** (droits par module en base, rôles éditables), puis **lot E** (personnes et organisations).

## Lot F2 — Rôles et droits — **FAIT (17/09)**

**Design (validé par Gaël le 17/09)** : (1) un **catalogue de permissions en code** (`lib/permissions.ts`, 22 clés groupées par module, chacune avec libellé et explication) ; (2) des **rôles en base** (`Role` : code, libellé, description, `system`, niveau de validation 0-3, permissions) — les six rôles d'origine sont système (code fixe, droits modifiables, non supprimables), on en crée d'autres par copie, `Person.role` est une clé étrangère ; (3) `getCurrentPerson` charge les permissions du rôle une fois par requête, `lib/rights.ts` garde ses fonctions mais lit `me.permissions` ; les 57 tests `role === "…"` en dur sont passés par elles, le contextuel (je pilote, j'en suis l'équipe, c'est mon pôle, jamais ma propre demande) reste en code ; (4) seed = droits d'avant, les 49 tests existants prouvent la non-régression. Trois partis pris : le niveau de validation est un **attribut du rôle** (hiérarchie, pas un oui/non) ; la visibilité du temps reste le réglage global ; **pas de droits par personne** (un cas particulier = un rôle). Écran : Admin › Rôles et droits (cartes + matrice). Garde-fous : Direction garde toujours `admin.manage` et `roles.manage` ; il reste toujours une direction active ; un rôle porté ne se supprime pas. Les recherches « qui est la directrice / le responsable du pôle » (destinataires, notifications, mot du bon pour accord) restent des identités par code système, pas des droits.

## Lot G — Notes de frais (module activable) — **mode import FAIT avec D** (comptes 625 dans le bloc Réalisé) ; module natif à faire

**Besoin (Gaël, 15/09)** : les notes de frais sont très souvent rattachées à un projet, une édition ou une action, et pèsent lourd sur une asso et sur certaines actions. Deux façons de faire, et il faut pouvoir choisir l'une ou l'autre par installation.
**Corpus CRESS** : la moitié de l'équipe est « souvent en déplacement ou chez des partenaires » (Q26) ; les notes de frais se font **dans Dolibarr** et la directrice les a remises à plus tard : « s'il faut continuer à faire les notes de frais et les demandes de congés sur notre vieux Dolibarr… tant pis, on verra dans un an » (S5.29). Donc pour la CRESS en V1 : **mode import** ; le module natif est une option pour « dans un an » et pour le produit.
**Repris de TLST** : rien (TLST n'en a pas) ; la matérialisation « prévu → réalisé » et la validation par niveaux existent déjà dans le Pilote (`ValidationRequest`, `Expense`).
**À construire**
- **Mode import** (CRESS V1) : les notes de frais validées dans l'outil externe arrivent par le canal du lot D (fichier ou API), nature « frais », code analytique → édition / action. Elles comptent dans le réalisé de l'édition comme les autres dépenses. Zéro écran en plus.
- **Mode natif** (module `frais` dans `Settings.modules`) : `ExpenseClaim` (personne, date, nature : déplacement km / transport / repas / hébergement / achat, montant, TVA facultative, justificatif photo via `Attachment`, édition et action facultatives, commentaire) ; saisie depuis Ma semaine et depuis l'action (mobile d'abord : c'est en déplacement qu'on la fait) ; **circuit** = la validation existante (niveau 1 pilote de l'édition, seuils `Settings`), puis « remboursée le » posé par la RAF ; barème kilométrique en référentiel ; état par personne (à valider / validée / remboursée) et par édition (dans Budget › Dépenses, ligne « frais ») ; export CSV / xlsx pour la paie ou la compta avec le code analytique. Une note sans édition va sur un code de fonctionnement.
- Règles : une note se rattache à **une** édition (sinon on la coupe en deux) ; pas de double comptage avec une dépense fournisseur ; les justificatifs restent dans l'outil (c'est le seul cas où la pièce naît ici, cf. règle documents).
- Tests : saisie mobile, validation, remboursement, total par édition, module éteint = rien de visible.
**Taille** : mode import = inclus dans D ; mode natif = 1,5 session.

## Ordre proposé

1. **A Versements**
2. **0 + B Appels à projets** (module activable)
3. **C Matrice + lexique**
4. **D Réalisé compta** (sur accord ; préciser « Excel en direct » et le logiciel de compta réel avant la session 2)
5. **G Notes de frais** en mode import avec D ; module natif si la CRESS le demande « dans un an » ou pour le produit.
6. E puis F selon le 28/09.

A + B + C tiennent en trois sessions et ne touchent pas aux écrans en recette : on ajoute des onglets et des blocs, on ne refait rien.

## Reste à faire — consigné le 18/09 (échange avec Gaël)

Tout le plan côté Pilote est livré (A, 0, B, C, D, P, F, F2, E1, E2, G-import). Ce qui vient d'erp-tlst et n'est **pas** dans le Pilote :

| Quoi | Décision | Comment le faire proprement, le jour venu |
|---|---|---|
| **Brevo** (import des contacts) | à faire, module activable | **Pas seulement des contacts d'organisation** : l'import ramène tous les contacts avec leurs attributs (listes → tags, `brevoContactId`, statut RGPD désinscrit / supprimé), rattachés ou non à une structure. Modèle cible : table `Contact` avec organisation *facultative*, tags, identifiant et statut Brevo, rapprochement par e-mail, sens unique Brevo → outil ; `OrganisationContact` en devient le cas rattaché (`organisationId` nullable, une migration). Écran : annuaire des contacts à côté des organisations, filtre par tag. Reprendre le client Brevo d'erp-tlst (`src/lib/brevo`). |
| **Adhérents + HelloAsso** | à faire, module activable | Adhésion portée par une organisation ou une personne de l'annuaire (E2) ; synchronisation HelloAsso à sens unique ; reprendre `src/lib/helloasso` et `members` d'erp-tlst. |
| **Trésorerie** | à faire, module activable | Reprendre le module d'erp-tlst (commité, jamais déployé) sur le grand livre du lot D. |
| **Matériel & prêts** | à faire, module activable | Brief décidé côté TLST, jamais codé. |
| **Notes de frais natives (G)** | **à décider plus tard** | Le mode import (compte 625 dans le réalisé) couvre la CRESS en V1. Le module natif (saisie, circuit de validation existant, barème km, export paie) n'a de sens que si un client sort de son outil de paie / compta pour ça. |
| **Entra ID** | plus tard | Second fournisseur better-auth sur le même `User` (1-2 j). |
| **Multi-instance (lot I)** | **attendre la revue du projet** lancée par Gaël | `config/clients/<client>.ts` (nom, logo, palette, vocabulaire — 31 fichiers citent encore « CRESS »), `deploy.sh` paramétré par instance (serveur, base, sous-chemin), un seed par client, modules TLST derrière `instanceHas`. Règle inchangée : un code, une branche `main`, jamais de `if (client === …)` ni de branche par client. |

**Mises à jour à plusieurs instances** : oui, chaque évolution du code se déploie sur **chaque** serveur (même commit, `deploy.sh` par instance ou une boucle), et les migrations tournent sur chaque base. C'est le prix d'« une instance par client » — et la raison pour laquelle rien ne doit dépendre du client dans le code : sinon les deux déploiements divergent.
