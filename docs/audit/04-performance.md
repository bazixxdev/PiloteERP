# Audit performance — PiloteERP

**Référence :** `bazixxdev/PiloteERP`, `main`, commit `3a0a6144474edb1aa1c7554ac68ea545251e74c4`. **Aucune modification du code.**

## Méthode et niveau de preuve

L’audit a recherché les requêtes Prisma, les boucles d’écriture, les appels externes, les `include` profonds, les limites/paginations et les calculs répétés. Le build production isolé et les tests unitaires passent, mais aucune charge représentative ni profilage de production n’a été réalisé. Les constats sont donc séparés en :

- **MESURÉ / QUASI CERTAIN** : le coût découle directement du code ou a été observé sur un chemin exécuté ;
- **PROBABLE** : le motif est crédible mais son impact dépend du volume ou du plan PostgreSQL ;
- **À MESURER** : optimisation possible uniquement si les métriques la justifient.

## 1. MESURÉ ou quasi certain

### PERF-01 — ÉLEVÉ — Exports complets sans pagination ni plafond métier

**Emplacement :** `app/admin/export/route.ts:15-52`, `app/contacts/export/route.ts`, `app/plan-operationnel/export/route.ts`, `app/edition/[id]/export/route.ts`.

**Preuve technique.** L’export `tout` exécute tous les loaders et chaque loader utilise `findMany` sans `take`, curseur ou pagination. Sur la base de recette, un export JSON complet a déjà produit environ 474 Ko ; il croîtra linéairement avec l’historique.

**Impact attendu.** Temps CPU/sérialisation, mémoire du processus Next et temps de transfert augmentent avec les tables. Un export déclenché simultanément par plusieurs utilisateurs peut saturer le processus.

**Mesure réelle.** Mesurer durée, RSS Node, nombre de lignes et taille de réponse pour 1, 10 et 100 années ; regarder `pg_stat_statements` et le temps de sérialisation.

**Correction possible.** Exports par table paginés ou génération asynchrone en fichier ; projection `select` minimale et plafond explicite pour l’interface.

### PERF-02 — ÉLEVÉ — Graphe d’édition très large chargé à chaque page

**Emplacement :** `lib/queries.ts:56-88`, `app/edition/[id]/page.tsx`, `lib/queries.ts:7-14`.

**Preuve technique.** `editionFullInclude` charge actions avec temps et tâches, financements avec contacts/conventions/paiements, validations, équipes, commentaires, remarques, pièces, dépenses, décisions, propositions et réalisations, puis effectue encore une lecture de temps par projet/année.

**Impact attendu.** Payload SQL et JSON importants même lorsqu’un onglet n’affiche qu’une partie de ces données ; latence et mémoire proportionnelles au nombre de pièces, commentaires et historiques.

**Mesure réelle.** Instrumenter le nombre de lignes et octets de chaque relation, le temps SQL par requête et le temps de rendu RSC sur une édition ancienne et une édition récente.

**Correction possible.** Query objects par onglet, `select` stricts, chargement différé des historiques et pagination des collections.

### PERF-03 — ÉLEVÉ — N+1 d’écritures dans les synchronisations et imports

**Emplacement :** `lib/helloasso-sync.ts:48-82`, `lib/brevo-sync.ts:40-45,112-123`, `app/actions/admin.ts:122-150`, `app/actions/contacts.ts:239-244,314-336`, `app/actions/time.ts:60-65,127-134`.

**Preuve technique.** Plusieurs boucles font un `findUnique`/`findFirst` puis une écriture par élément. `copyPreviousWeek` fait une insertion par ligne ; les imports de contacts et organisations font une recherche par ligne ; HelloAsso recherche chaque adhésion externe séparément.

**Impact attendu.** Latence proportionnelle au nombre de lignes et pression sur le pool de connexions. Un import de quelques milliers de contacts peut monopoliser le worker.

**Mesure réelle.** Compter les requêtes Prisma par import et mesurer p50/p95 pour 100, 1 000 et 10 000 lignes avec logs Prisma ou `pg_stat_statements`.

**Correction possible.** Précharger les clés en une requête, construire des maps en mémoire, utiliser `createMany`/`updateMany` lorsque l’idempotence est maîtrisée, et transactionner par lot.

### PERF-04 — MOYEN — Synchronisations externes synchrones dans la requête utilisateur

**Emplacement :** `app/actions/brevo.ts`, `app/actions/helloasso.ts`, `lib/brevo-sync.ts`, `lib/helloasso-sync.ts`, `app/actions/ledger.ts:65-80`.

**Preuve technique.** Les actions administratives attendent les appels HTTP externes et les boucles de synchronisation avant de retourner. Les intégrations sont exécutées dans le même processus que les pages Next.

**Impact attendu.** Une API distante lente bloque une requête et consomme une instance Node ; un grand miroir externe augmente la fenêtre de timeout et le risque de retry manuel.

**Mesure réelle.** Tracer durée par appel externe, nombre de pages, durée DB et taux d’échec ; tester latence 100 ms/1 s/5 s et interruption réseau.

**Correction possible.** Job asynchrone avec état de synchronisation, timeouts, reprise et progression ; la page déclenche puis consulte le résultat.

### PERF-05 — MOYEN — Requêtes inutiles ou surdimensionnées dans les pages

**Emplacement :** `app/admin/page.tsx:55-78`, `app/edition/[id]/page.tsx:42-55`, `app/conventions/[id]/page.tsx:29-41`, `app/materiel/page.tsx:31-36`.

**Preuve technique.** Les pages chargent simultanément de nombreux référentiels et relations même lorsque la section ou le panneau demandé n’en utilise qu’une partie. `AdminPage` charge personnes, pôles, financeurs, missions, codes, référentiels et rythmes autour de chaque section.

**Impact attendu.** Temps de requête et transfert inutiles sur chaque navigation, surtout pour les écrans d’administration peu utilisés.

**Mesure réelle.** Comparer les requêtes et octets d’une navigation vers chaque section avec un trace Prisma et un profil RSC.

**Correction possible.** Charger les données au niveau de la section active, sélectionner uniquement les colonnes nécessaires et partager seulement les référentiels réellement communs.

## 2. PROBLÈMES PROBABLES

### PERF-06 — MOYEN — Portefeuille : lecture d’un volume de temps supérieur au besoin

**Emplacement :** `lib/queries.ts:19-34`.

**Raison technique.** Le portefeuille charge toutes les éditions vivantes puis tous les `TimeEntry` dont le `projectId` appartient aux projets affichés, sans filtre d’année dans la requête. Le code filtre l’année uniquement en mémoire via `dayjs`.

**Impact attendu.** Les années historiques d’un même projet sont relues à chaque portefeuille, même si une seule année est affichée.

**Mesure réelle.** Comparer le nombre de lignes retournées au nombre de lignes réellement agrégées par année ; `EXPLAIN ANALYZE` avec plusieurs années.

**Correction possible.** Ajouter une borne de dates dérivée des éditions affichées ou agréger en SQL, après validation du besoin multi-années.

### PERF-07 — MOYEN — Imports contacts et synchronisations font des recherches non indexées ou répétées

**Emplacement :** `app/actions/admin.ts:124-150`, `lib/brevo-sync.ts`, `lib/contacts.ts:102-139`, `prisma/schema.prisma:244-277`.

**Raison technique.** Les recherches insensibles à la casse par nom, les contrôles de doublon par email et les listes complètes peuvent devenir coûteux. `Contact.email` est indexé, mais le chemin de normalisation et les requêtes exactes doivent être confirmés par le plan.

**Impact attendu.** Import plus lent et scans lorsque l’annuaire grossit.

**Mesure réelle.** `EXPLAIN (ANALYZE, BUFFERS)` sur les recherches d’import avec 10k/100k contacts ; mesurer les appels par ligne.

**Correction possible.** Colonne normalisée/index fonctionnel ou clé externe, préchargement des clés et traitement par lots.

### PERF-08 — MOYEN — Collections d’historique bornées de façon inégale

**Emplacement :** `app/notifications/page.tsx:20`, `app/materiel/prets/page.tsx:24`, `lib/queries.ts:67-74`, `app/conventions/[id]/page.tsx`.

**Raison technique.** Certaines collections utilisent `take` (300 notifications, 200 prêts, 30 changements), tandis que commentaires, remarques, pièces, paiements et réalisations dans les includes complets n’ont pas de borne.

**Impact attendu.** Une convention ou édition ancienne peut rendre une page de plus en plus lourde ; le comportement varie selon le type d’historique.

**Mesure réelle.** Compter les éléments par relation et mesurer RSC/SQL sur les dix plus gros agrégats.

**Correction possible.** Pagination ou fenêtre récente explicite, avec accès à l’historique complet séparé.

### PERF-09 — MOYEN — Calculs répétés côté serveur

**Emplacement :** `lib/queries.ts:36-52`, `lib/treasury.ts`, `lib/ledger-db.ts`, pages de portefeuille/trésorerie.

**Raison technique.** `budgetOf(e)` est appelé plusieurs fois pour la même édition ; les agrégations d’alertes, ledger et temps sont calculées après chargement complet. Cela n’est pas forcément coûteux à petite échelle, mais se répète à chaque navigation sans cache de requête explicite.

**Impact attendu.** CPU et garbage collection supplémentaires lorsque le portefeuille contient beaucoup d’éditions.

**Mesure réelle.** Profiler CPU avec 100/1 000 éditions et compter les appels par rendu.

**Correction possible.** Calculer une fois par objet, mutualiser les agrégations et ne mettre en cache qu’après mesure et invalidation définie.

## 3. OPTIMISATIONS À FAIRE UNIQUEMENT SI LES MÉTRIQUES LE JUSTIFIENT

### PERF-10 — FAIBLE — Cache applicatif des référentiels et paramètres

**Emplacement :** `lib/session.ts:getRefs`, `getSettings`, pages qui chargent rôles/référentiels.

Les référentiels sont lus souvent et changent peu, mais les caches Next/React ont des règles d’invalidation et plusieurs instances possibles. Mesurer d’abord la part réelle de ces requêtes. Un cache partagé ou une revalidation ciblée peut être pertinent ; un cache local non invalidé créerait des données obsolètes.

### PERF-11 — FAIBLE — Découpage/lazy loading de composants et dépendances UI

**Emplacement :** `components/ui/*`, `components/tasks/task-list.tsx`, `app/admin/forms.tsx`, éditeur riche Tiptap.

Le bundle contient de nombreux composants génériques et l’éditeur riche est une dépendance client. Un découpage dynamique peut réduire le JavaScript initial, mais uniquement si les mesures Lighthouse/bundle analyzer montrent un poids pertinent sur les routes concernées.

### PERF-12 — FAIBLE — Virtualisation des longues listes

Les listes de contacts, tâches, notifications et prêts ont des bornes ou des chargements complets variables. La virtualisation ne doit être introduite qu’après mesure du nombre de lignes réellement affichées et du coût de rendu navigateur ; la pagination serveur est prioritaire si le volume est élevé.

## API et frontend

Les Server Actions utilisent le protocole RSC et renvoient parfois des graphes complets ou des erreurs détaillées. Il n’existe pas de mesure de payload par action dans le dépôt. Les composants client utilisent correctement des transitions à plusieurs endroits, mais les actions qui font `router.refresh()` après synchronisation peuvent provoquer un rechargement de page complet et répéter les requêtes de la page.

Les uploads sont bornés à 5–10 Mo selon le flux, ce qui limite le cas nominal, mais le parseur XLSX et les imports restent synchrones. Les images ne constituent pas un axe principal observé dans le code ; les pièces sont servies comme fichiers et doivent être mesurées séparément.

## Plan de mesure avant optimisation

1. Activer temporairement les logs Prisma avec durée et corrélation de requête.
2. Installer `pg_stat_statements` sur une recette représentative et capturer p50/p95/p99.
3. Mesurer les pages portefeuille, édition, admin, contacts et exports avec 1, 10 et 100 années.
4. Mesurer mémoire Node et taille RSC/HTTP pendant un export et une synchronisation.
5. Profiler deux imports de 1 000 et 10 000 lignes, avec API externe lente.
6. Ajouter seulement les index, projections, limites ou caches justifiés par ces mesures.

## Synthèse

Les problèmes les plus crédibles et immédiatement actionnables sont les exports sans plafond, le graphe complet d’édition, les N+1 d’import/synchronisation, les traitements externes synchrones et les lectures de temps non bornées par année. Les caches, la virtualisation et le découpage de bundle sont des optimisations conditionnelles ; elles ne doivent pas précéder les mesures.
