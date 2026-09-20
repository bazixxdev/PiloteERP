# Audit tests, robustesse et gestion des erreurs — PiloteERP

**Référence :** `bazixxdev/PiloteERP`, `main`, commit `3a0a6144474edb1aa1c7554ac68ea545251e74c4`. Aucun test ni code n’a été créé ou modifié pendant cet audit.

## État actuel

Le dépôt contient 38 fichiers Playwright (`tests/*.spec.ts`), 2 fichiers unitaires Node (`tests/unit/*.test.ts`), un `global-setup`, deux faux serveurs externes et des helpers de parcours. Les suites comptent environ 994 appels à `expect` et 86 déclarations `test`/`describe` selon un comptage statique.

La pyramide actuelle est très orientée navigateur : presque tous les comportements sont vérifiés à travers une page complète, tandis que les règles de domaine, les droits, les transitions, les erreurs Prisma et les transactions disposent de peu de tests unitaires ou d’intégration directs. Les 7 tests unitaires existants couvrent surtout vocabulaire et configuration des clients ; ils ne couvrent pas les agrégats métier.

Le build production isolé et les tests unitaires existants ont passé dans l’environnement d’audit. Cela ne constitue pas une mesure de couverture fonctionnelle ni une preuve que toute la suite Playwright passe dans cet environnement.

## Points forts

- Parcours métier nombreux : éditions, temps, trésorerie, contacts, adhésions, matériel, notes, demandes, connecteurs.
- Scénarios dédiés aux comptes, rôles et droits (`comptes.spec.ts`, `droits.spec.ts`, `perimetre.spec.ts`).
- `global-setup.ts` reconstruit une base de recette et utilise une instance TLST séparée.
- Faux Brevo et HelloAsso pour éviter les appels externes réels.
- Utilitaires de parcours centralisés dans `tests/helpers.ts`.
- Les tests possèdent beaucoup d’assertions UI et plusieurs tests anonymes via `storageState: FRESH`.

## Manques et fragilités

### TST-01 — CRITIQUE — Aucun test de non-régression sur les exports et actions sans autorisation

**Fonctionnalité :** middleware, exports, Server Actions.

**Preuve :** `tests/matrice.spec.ts` et `tests/pieces-jointes.spec.ts` vérifient certains accès anonymes, mais la matrice complète des exports, jetons API, actions directes et cookies falsifiés n’est pas systématiquement testée. L’audit sécurité a reproduit des exports et données accessibles dans des combinaisons absentes de la suite.

**Risque :** une régression rend de nouveau accessibles des données financières, des liens d’invitation ou des actions sensibles sans alerte CI.

**Test recommandé :** tests HTTP/API sans navigateur, avec matrice acteur × route × ressource × méthode.

**Scénarios :** anonyme, cookie invalide, contributeur, RAF, direction ; chaque export sans jeton, avec jeton invalide et avec jeton valide ; chaque Server Action sensible avec objet étranger.

### TST-02 — CRITIQUE — Réinitialisation, invitation et séparation des sessions insuffisamment testées contre un lecteur non administrateur

**Fonctionnalité :** reset mot de passe, boîte d’envoi, comptes.

**Preuve :** `tests/comptes.spec.ts` utilise le mode démo et ouvre l’administration comme Claire ; il vérifie le parcours nominal, mais pas qu’un compte ordinaire ne puisse pas lire les liens d’autres personnes ni réinitialiser un administrateur.

**Risque :** compromission complète d’un compte privilégié sans échec de test.

**Test recommandé :** intégration HTTP avec comptes distincts et session opaque réelle.

**Scénarios :** lecteur ouvre `/admin?section=comptes`, ne voit aucun lien d’un tiers ; demande de reset admin ; ancienne session après reset ; révocation de toutes les sessions ; compte désactivé avec session déjà ouverte.

### TST-03 — ÉLEVÉ — Les règles financières critiques ne sont pas testées par commande directe et concurrence

**Fonctionnalité :** validations, propositions, budget, paiements.

**Preuve :** les tests UI couvrent le chemin attendu, mais pas les paramètres falsifiés (`requiredLevel`), les propositions sur champs budgétaires, deux décisions concurrentes ou les effets `Expense`/`ChangeLog`.

**Risque :** approbation d’un montant au mauvais niveau, budget modifié par une voie indirecte, double engagement ou statut incohérent.

**Test recommandé :** tests d’intégration Server Actions + base PostgreSQL, puis tests de concurrence avec deux clients.

**Scénarios :** niveaux 0/1/3, auteur distinct, montant au-dessus des seuils ; acceptation/refus simultanés ; budget direct refusé mais proposition contrôlée ; engagement créé une seule fois.

### TST-04 — ÉLEVÉ — Les propriétés d’intégrité et de cascade de la base ne sont pas testées

**Fonctionnalité :** migrations, FK, suppressions et cascade.

**Preuve :** aucune suite dédiée ne vérifie le graphe de suppression ou les contraintes après migration. L’audit BDD a démontré la suppression en cascade d’un paiement reçu lors du détachement d’une ligne.

**Risque :** perte de données silencieuse lors d’une action administrative ou d’une migration.

**Test recommandé :** tests d’intégration Prisma sur une base neuve et une base avec données représentatives.

**Scénarios :** supprimer/détacher édition, convention, ligne, organisation, équipement, personne ; vérifier paiements, pièces, prêts, journaux et références historiques.

### TST-05 — ÉLEVÉ — Les migrations ne sont pas testées comme une chaîne de mise à niveau

**Fonctionnalité :** Prisma migrations.

**Preuve :** `global-setup.ts` exécute `prisma db seed` sur la base de recette et la configuration démarre avec une base de test ; aucun test ne documente une base issue de chaque état historique SQLite/PostgreSQL, ni un rollback/backup vérifié. Les migrations contiennent des suppressions de tables historiques et de contraintes.

**Risque :** déploiement bloqué, perte de données lors d’une base réelle plus ancienne, schéma divergent entre recettes.

**Test recommandé :** pipeline migration upgrade avec dumps anonymisés, vérification du nombre de lignes et contraintes avant/après.

**Scénarios :** dernière base avant migration PostgreSQL, chaque migration intermédiaire, données avec anciennes relations Funder/Supplier, interruption après migration.

### TST-06 — ÉLEVÉ — Les erreurs et limites d’entrée ont peu de tests négatifs

**Fonctionnalité :** erreurs actions, imports, fichiers, intégrations.

**Preuve :** les assertions UI privilégient souvent un toast ou un texte ; les erreurs Prisma, timeouts, fichiers mal formés, IDs inexistants, valeurs NaN/négatives et réponses externes inattendues sont peu représentés. Les erreurs techniques sont renvoyées par certaines actions.

**Risque :** messages instables, erreurs bavardes, état partiellement écrit, absence de retry ou de signalement.

**Test recommandé :** tests d’intégration avec erreurs injectées et assertions sur code d’erreur, absence de mutation et état DB.

**Scénarios :** Prisma P2025/P2002, upload refusé puis échec stockage, XLSX illisible, CSV vide, API 429/500/timeout, réseau coupé après une première écriture.

### TST-07 — ÉLEVÉ — Le mode démo masque la séparation réelle des rôles dans la majorité des tests

**Fonctionnalité :** authentification et autorisation.

**Preuve :** `playwright.config.ts` démarre les recettes avec `PILOTE_DEMO=1`, `AUTH_RATE_LIMIT=0` et un `storageState` partagé ; `helpers.ts:iAm` change de personne via le sélecteur. Cela teste l’affichage des droits, mais pas toujours une session utilisateur distincte.

**Risque :** le sélecteur de démo peut masquer un défaut de session, de cookie, de révocation ou d’isolation entre comptes.

**Test recommandé :** seconde suite “production-like” avec `PILOTE_DEMO=0`, connexions séparées et aucun mot de passe commun.

**Scénarios :** deux navigateurs avec utilisateurs différents, déconnexion, reset, désactivation, cookie `pilote_person` injecté, accès croisé à une ressource.

### TST-08 — MOYEN — Pas de tests de concurrence sur les temps, équipes, imports et synchronisations

**Fonctionnalité :** écritures multi-étapes.

**Preuve :** `fullyParallel: false`, `workers: 1`, `retries: 0` dans `playwright.config.ts` ; aucun test lance deux actions simultanément. Les actions contiennent pourtant des boucles de création et des `updateMany` conditionnels.

**Risque :** race condition non détectée, doublons, données partielles ou décisions contradictoires.

**Test recommandé :** tests PostgreSQL d’intégration avec `Promise.all`, isolation contrôlée et répétition.

**Scénarios :** deux copies de semaine ; deux décideurs ; deux imports du même exercice ; deux synchronisations Brevo/HelloAsso ; deux modifications d’équipe.

### TST-09 — MOYEN — Les tests dépendent de l’ordre, des données seedées et de délais arbitraires

**Fonctionnalité :** robustesse de la suite.

**Preuve :** commentaires de `global-setup.ts` et `helpers.ts` indiquent une session partagée ; plusieurs tests utilisent `waitForTimeout(500/600/800)` et réparent explicitement les données pour les tests suivants.

**Risque :** faux positifs/négatifs selon la charge, l’ordre ou la latence ; exécution isolée d’un test non représentative.

**Test recommandé :** fixtures indépendantes par test ou par describe, attentes sur événements réseau/état DOM, répétition ciblée et exécution aléatoire.

**Scénarios :** lancer chaque spec seule, inverser l’ordre, ralentir le réseau, relancer la suite plusieurs fois sur une base neuve.

### TST-10 — MOYEN — Les tests de connecteurs vérifient surtout les mocks, peu les contrats d’erreur réels

**Fonctionnalité :** Brevo, HelloAsso, Pennylane.

**Preuve :** `tests/brevo-mock.mjs` et `tests/helloasso-mock.mjs` fournissent des réponses locales simples ; les scénarios de pagination, rate limit, champs inconnus, schémas modifiés et délais extrêmes sont limités.

**Risque :** synchronisation bloquée ou duplication lorsque l’API réelle varie.

**Test recommandé :** contract tests versionnés et jeux de réponses enregistrés, sans appeler la production.

**Scénarios :** pagination multi-pages, doublon externe, suppression distante, attribut absent, HTTP 401/429/500, JSON invalide, timeout.

### TST-11 — MOYEN — Les tests API et contrats de payload sont peu séparés des tests UI

**Fonctionnalité :** routes d’export, agenda, pièces, auth.

**Preuve :** les tests utilisent surtout `page.goto` et des sélecteurs. Les réponses HTTP, headers, tailles, statuts et absence de fuite ne sont pas systématiquement assertés.

**Risque :** une page peut sembler correcte alors qu’un endpoint change de statut, de cache, de content-type ou de périmètre.

**Test recommandé :** suite API directe pour chaque route publique/protégée avec assertions de contrat.

**Scénarios :** 401/403/404, content-type téléchargement, cache-control, cookie flags, origine hostile, paramètres inconnus, fichier absent.

### TST-12 — FAIBLE — Les tests unitaires métier sont très insuffisants

**Fonctionnalité :** calculs et règles pures.

**Preuve :** les deux fichiers unitaires couvrent essentiellement `vocab` et configuration des clients. Les calculs de budget, droits, temps, dates, CSV, agrégation ledger et filtres de périmètre sont exercés principalement indirectement.

**Risque :** retours rapides cassent des règles sans diagnostic local ; chaque correction nécessite lancer une page lourde.

**Test recommandé :** tests unitaires purs, rapides, avec propriétés et cas limites.

**Scénarios :** seuils de validation, budget négatif, arrondis, semaine multi-mois, permissions par rôle, parsing CSV/XLSX, visibilité des notes/contacts.

## Parcours dont la régression serait particulièrement grave

1. Connexion, reset, invitation, révocation et désactivation.
2. Matrice des rôles et permissions par objet.
3. Validation financière et création d’engagement.
4. Import comptable et remplacement/versionnement des snapshots.
5. Suppression/détachement de financements et paiements reçus.
6. Upload, téléchargement et rattachement de pièces.
7. Clôture mensuelle et saisie/copie des temps.
8. Réattribution de demandes et tâches liées.
9. Synchronisations Brevo/HelloAsso/Pennylane.
10. Migrations sur une base contenant des données historiques.

## Pyramide de tests recommandée

### 1. Tests unitaires — environ 55–65 %

Tester les fonctions pures : `rights`, `budget`, `fields`, transitions, dates, CSV, parsing d’import, filtres de visibilité, agrégations ledger et génération ICS. Ils doivent être rapides, sans Prisma ni navigateur, avec cas limites et propriétés.

### 2. Tests d’intégration commande + PostgreSQL — environ 25–35 %

Exécuter les Server Actions ou services contre une base PostgreSQL isolée. Vérifier transactions, FK, cascades, idempotence, erreurs, permissions objet par objet et concurrence. Chaque test doit contrôler l’état DB avant/après, pas seulement le message UI.

### 3. Tests contrat/API — environ 10–15 %

Tester auth, exports, fichiers, agenda et intégrations avec réponses HTTP, headers, payloads, erreurs et limites. Les mocks externes doivent simuler les erreurs et la pagination.

### 4. Tests E2E Playwright — environ 5–10 %

Conserver un nombre réduit de parcours critiques : connexion/reset, création d’une édition, validation financière, import, clôture temps, upload et synchronisation. Exécuter une variante production-like sans mode démo.

La pyramide doit rester indicative : l’objectif est de déplacer les règles et les écritures testables hors du navigateur, pas de diminuer artificiellement la couverture utilisateur.

## Tests indispensables avant mise en production

- Reset et invitation : un utilisateur ordinaire ne lit ni ne consomme le lien d’un autre compte ; révocation et anciennes sessions vérifiées.
- Matrice complète des rôles, permissions et IDOR sur chaque agrégat sensible.
- Exports, agenda, pièces et Server Actions : matrice anonyme/session invalide/session valide/objet étranger.
- Niveaux de validation : seuils, montants extrêmes, niveau falsifié, double décision et engagement unique.
- Budget et propositions : permission directe et indirecte cohérentes.
- Suppression/détachement : paiements reçus, pièces, conventions, prêts et historique conservés ou refusés.
- Upload : parent cohérent, fichier orphelin après échec, téléchargement et types autorisés.
- Temps : mois verrouillé, semaine multi-mois, deux copies simultanées, déclaration de complétude.
- Imports : fichier vide/mal formé/volumineux, doublon, retry, interruption et absence de mutation partielle.
- Synchronisations externes : pagination, 401, 429, 500, timeout, réponse invalide et idempotence.
- Migrations : base neuve, dernière base historique, vérification des lignes/contraintes et interruption contrôlée.
- Tests API de contrats avec statuts, headers, content-types et taille des réponses.
- Suite `PILOTE_DEMO=0`, plusieurs sessions distinctes, rate limit actif et cookies de production.
- Exécution répétée sur base neuve, tests sans ordre dépendant et suppression des `waitForTimeout` non nécessaires.
