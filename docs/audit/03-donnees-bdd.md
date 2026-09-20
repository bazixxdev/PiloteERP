# Audit couche données et base de données — PiloteERP

**Référence :** `bazixxdev/PiloteERP`, `main`, commit `3a0a6144474edb1aa1c7554ac68ea545251e74c4`. **Aucune modification du code, du schéma ou des migrations.**

## Périmètre et état général

Le snapshot contient 62 modèles Prisma, 152 relations, 25 contraintes d’unicité et 35 index déclarés, répartis sur 17 migrations. PostgreSQL est la base cible actuelle ; l’historique contient une phase SQLite puis une migration PostgreSQL initiale complète.

Le modèle est relationnel et possède de bonnes bases : clés étrangères nombreuses, tables de jonction avec clés composites (`EditionTeam`, `ProjectPole`, `ContactListItem`, `NoteShare`), index sur plusieurs chemins de lecture et `@unique` sur les identifiants externes. En revanche, plusieurs invariants métier importants restent uniquement dans TypeScript et plusieurs tables polymorphes utilisent des clés étrangères nullable sans contrainte de cohérence entre elles.

## Findings

### DB-01 — ÉLEVÉ — La suppression d’une ligne de financement peut supprimer des paiements reçus

**Statut : problème avéré, reproduit. Fichiers/modèles :** `prisma/schema.prisma:621-637` (`Payment`), `app/actions/edition.ts:291-300`, `app/actions/payments.ts:45-52`.

**Problème.** `Payment.fundingLineId` et `Payment.conventionId` sont optionnels et tous deux en `onDelete: Cascade`. `detachFundingLineFromConvention` décide qu’une ligne est vide sans compter ses paiements (`deliverables`, `attachments`, `actions` seulement), puis la supprime. La suppression directe d’un paiement reçu est pourtant refusée par `deletePayment`.

**Scénario.** Une ligne de financement liée à une convention porte un versement déjà reçu. L’utilisateur détache la ligne ; le code la considère vide, la supprime et PostgreSQL cascade la suppression du paiement.

**Conséquence.** Perte irréversible d’un encaissement et de son historique financier. Ce chemin a été reproduit sur la base de recette isolée : le paiement existait avant le détachement et n’existait plus après.

**Correctif recommandé.** Inclure les paiements dans le test d’usage ; interdire la suppression d’une ligne ayant un paiement, ou détacher la ligne en conservant l’écriture dans une entité historique. Ajouter une contrainte métier et un test transactionnel.

**Migration :** probablement oui si l’on remplace la cascade par `RESTRICT` ou si l’on ajoute un état d’archivage. **Risque déploiement :** élevé ; inventorier les lignes existantes avant modification.

### DB-02 — ÉLEVÉ — Les pièces jointes polymorphes peuvent référencer plusieurs parents incompatibles

**Statut : problème avéré. Fichiers/modèle :** `prisma/schema.prisma:991-1015` (`Attachment`), `app/actions/attachments.ts:27-61`.

**Problème.** `Attachment` possède plusieurs FK nullable (`editionId`, `equipmentId`, `loanId`, `conventionId`, `fundingLineId`, `deliverableId`, `validationId`) sans contrainte “exactement un parent” ni vérification que les parents appartiennent au même graphe métier.

**Scénario.** Une insertion fournit `editionId` d’une édition A et `validationId` d’une demande B. Les deux FK sont valides individuellement, donc la base accepte l’enregistrement.

**Conséquence.** Pièces orphelines du point de vue métier, affichées dans le mauvais dossier ou utilisées dans un bon pour accord. Reproduction confirmée dans l’audit sécurité.

**Correctif recommandé.** Déduire le parent depuis une seule cible métier côté application et ajouter une structure de rattachement plus normalisée, ou au minimum des contraintes/triggers de cohérence documentés. Ajouter un contrôle de cohérence avant écriture et des tests de matrice.

**Migration :** oui si le modèle est normalisé. **Risque :** important ; migrer les lignes incohérentes avant de rendre les FK obligatoires.

### DB-03 — ÉLEVÉ — Les autres relations polymorphes reposent aussi sur des invariants applicatifs

**Statut : problème avéré de conception, exploitation à mesurer. Modèles :** `Payment`, `Task`, `Note`, `TimeEntry`, `Loan`.

**Problème.** Plusieurs entités portent des combinaisons facultatives : un paiement peut viser une ligne ou une convention ; une tâche peut viser édition, action, liste, demande et convention ; une note peut viser édition ou convention ; un temps peut viser projet, action ou code. PostgreSQL garantit l’existence de chaque ID mais pas la compatibilité des combinaisons.

**Conséquence.** Des données valides pour Prisma peuvent être impossibles à interpréter par les écrans et agrégats. Les suppressions `SetNull` peuvent aussi laisser une ligne sans contexte métier.

**Correctif recommandé.** Choisir un parent canonique par agrégat, utiliser des tables de rattachement explicites ou des contraintes `CHECK`/triggers quand elles sont stables. Ajouter une commande de réparation et un rapport d’incohérences.

**Migration :** selon le modèle retenu, oui. **Risque :** moyen à important.

### DB-04 — ÉLEVÉ — Les valeurs numériques et états critiques n’ont pas de contraintes SQL

**Statut : problème avéré. Modèles :** `Edition`, `FundingLine`, `Payment`, `Expense`, `TimeEntry`, `ValidationRequest`, `Membership`, `Loan`.

**Problème.** Les montants et durées sont des `Float` (`budgetEnvelope`, `amountGranted`, `Payment.amount`, heures), les états sont des `String`, et il n’existe pas de `CHECK` pour les bornes, transitions ou cohérences de dates. `requiredLevel` est un `Int` sans borne.

**Scénario.** Deux chemins d’écriture ou un import contournent la validation TypeScript et inscrivent montant négatif, niveau hors plage, heures négatives ou `receivedAt` avant `expectedAt`.

**Conséquence.** Totaux et alertes incohérents, tris d’états non prévus, corrections manuelles coûteuses.

**Correctif recommandé.** Utiliser `Decimal` pour les montants financiers, des enums Prisma pour les états stables, et des `CHECK` pour les bornes essentielles. Garder les règles de transition dans des commandes transactionnelles.

**Migration :** oui, avec nettoyage préalable et conversion des `Float`. **Risque :** important pour les agrégats financiers.

### DB-05 — ÉLEVÉ — Les écritures multi-étapes restent non atomiques sur plusieurs parcours

**Statut : problème avéré. Fichiers :** `app/actions/edition.ts:79-85`, `time.ts:115-140`, `requests.ts:41-63`, `attachments.ts:48-61`.

**Problème.** Certaines opérations suppriment puis recréent des lignes dans une boucle ou écrivent un fichier avant l’insertion DB. Toutes les séquences ne sont pas dans `$transaction`.

**Scénario.** `uploadAttachment` écrit le fichier puis échoue sur la création Prisma : le fichier reste sans ligne DB. `setTeam` supprime les membres puis peut échouer au milieu des `upsert`. `copyPreviousWeek` peut créer seulement une partie des entrées.

**Conséquence.** Fichiers orphelins, équipes partielles, feuilles de temps incohérentes et reprise manuelle.

**Correctif recommandé.** Transactionner les mutations DB, écrire dans un stockage temporaire puis finaliser après commit, ou prévoir une tâche de compensation et un nettoyage des orphelins. Ajouter des tests d’échec injecté.

**Migration :** non pour le principe ; éventuellement index/états de nettoyage. **Risque :** moyen.

### DB-06 — ÉLEVÉ — Les décisions concurrentes ne verrouillent pas toujours l’agrégat complet

**Statut : problème avéré/probable selon parcours. Fichiers :** `app/actions/proposals.ts:39-54`, `edition.ts:145-162`, `time.ts:115-140`, `ledger.ts:15-23`.

**Problème.** Certaines mises à jour utilisent un `updateMany` conditionnel sur le statut, ce qui est bien pour une décision unique, mais les effets associés (`Expense`, `ChangeLog`, notifications) sont ensuite exécutés hors de la même transaction. D’autres chemins calculent puis écrivent sans verrou ou isolation explicitée.

**Scénario.** Deux décideurs acceptent/refusent une proposition presque simultanément, ou deux copies de semaine voient la même absence avant insertion. Un import et une lecture concurrente peuvent observer un snapshot intermédiaire si la transaction n’englobe pas le traitement complet.

**Conséquence.** État final contradictoire, doublon d’effet secondaire ou données écrasées silencieusement.

**Correctif recommandé.** Utiliser une transaction avec prédicat de version/statut, `Serializable` lorsque nécessaire, contraintes uniques et retry contrôlé sur conflit. Tester avec plusieurs clients simultanés.

**Migration :** parfois ajout d’une colonne `version`/contrainte unique. **Risque :** moyen.

### DB-07 — MOYEN — Les cascades sont nombreuses et pas toujours alignées avec l’historique métier

**Statut : problème avéré de conception. Modèles :** `Edition`, `Organisation`, `Equipment`, `Person`, `Note`, `Task`, `Attachment`, `Membership`.

**Problème.** 152 relations contiennent de nombreuses cascades. Supprimer une édition supprime équipes, actions, financements, validations, pièces, commentaires, temps planifiés et autres enfants. Supprimer une organisation cascade des adhésions et contacts organisationnels dans certains chemins ; supprimer un équipement cascade les prêts et leurs pièces.

**Conséquence.** Une suppression administrative peut effacer l’historique nécessaire à la comptabilité, aux justificatifs ou aux audits. Le soft delete existe pour certaines personnes/contacts, mais pas uniformément pour les agrégats financiers.

**Correctif recommandé.** Classer les relations “référentielles”, “opérationnelles” et “auditables”. Remplacer les cascades auditables par `RESTRICT` ou archivage, et exposer une suppression logique contrôlée.

**Migration :** oui pour les FK. **Risque :** élevé ; vérifier chaque chaîne avant changement.

### DB-08 — MOYEN — L’unicité couvre certaines jonctions mais pas les doublons métier

**Statut : amélioration recommandée avec lacunes avérées. Modèles :** `Contact`, `Project`, `FundingLine`, `Payment`, `ValidationRequest`, `Request`.

**Problème.** Les tables de jonction ont de bonnes clés composites, mais plusieurs doublons métier restent possibles : plusieurs contacts actifs avec même email, plusieurs lignes du même financeur/dispositif sur une édition, plusieurs paiements identiques, demandes ou validations répétées sans clé d’idempotence.

**Conséquence.** Imports rejoués, double clics ou retries créent des doublons difficiles à distinguer des événements réels.

**Correctif recommandé.** Définir les clés d’idempotence par cas d’usage (source+année+code, fournisseur+référence, événement externe), ajouter des index uniques partiels lorsque la règle est stable, et conserver un identifiant d’import.

**Migration :** probablement oui après dédoublonnage. **Risque :** moyen.

### DB-09 — MOYEN — Plusieurs lectures chargent des graphes volumineux sans pagination

**Statut : problème avéré dans le code, impact dépendant du volume. Fichiers :** `lib/queries.ts:21-34,79-88`, `app/admin/page.tsx:55-70`, `app/admin/export/route.ts:15-35`, `lib/contacts.ts:102-139`.

**Problème.** Les `findMany` récupèrent des ensembles complets et des `include` profonds : portefeuille d’éditions avec actions, temps, financements, paiements, validations et équipes ; export complet de toutes les tables ; annuaire sans pagination.

**Conséquence.** Temps de réponse et mémoire augmentent avec les années, transferts de gros payloads et risque de timeout sur l’export.

**Correctif recommandé.** Pagination serveur, projections `select` adaptées à chaque écran, limites explicites d’export et curseurs pour l’historique. Mesurer avant de choisir un cache.

**Migration :** non, sauf index complémentaires. **Risque :** faible à moyen.

### DB-10 — MOYEN — Les index ne couvrent pas tous les filtres récurrents

**Statut : probable, à confirmer par `EXPLAIN ANALYZE`. Modèles :** `TimeEntry`, `ValidationRequest`, `Notification`, `Task`, `Attachment`, `Request`.

**Problème.** Certains index existent sur les FK simples, mais les requêtes filtrent souvent par couples statut/date/personne/édition (`ValidationRequest.status`, notifications non lues par personne, tâches par personne et état, pièces par parent et date). Les index composites correspondants ne sont pas systématiques.

**Conséquence.** Scans croissants lorsque l’historique grossit, particulièrement sur les pages d’accueil et exports.

**Correctif recommandé.** Capturer les requêtes lentes réelles puis ajouter uniquement les index validés par `EXPLAIN`; ne pas indexer chaque colonne par anticipation.

**Migration :** oui pour les index retenus, idéalement `CONCURRENTLY` hors transaction selon la stratégie de déploiement. **Risque :** faible, mais coût de build à mesurer.

### DB-11 — MOYEN — Le remplacement du snapshot comptable détruit l’ancien état avant validation complète

**Statut : problème avéré de conception, risque opérationnel. Fichier :** `app/actions/ledger.ts:15-23,103-108`.

**Problème.** `writeSnapshot` supprime toutes les `LedgerLine` d’une source/année puis insère le nouvel agrégat dans une transaction. La transaction protège l’échec SQL, mais pas une importation sémantiquement mauvaise validée comme fichier correct ; `clearLedger` supprime sans snapshot de sauvegarde.

**Conséquence.** Une mauvaise importation remplace la référence précédente et rend le retour arrière manuel. `LedgerImport` trace l’import mais ne conserve pas les lignes historiques.

**Correctif recommandé.** Versionner les imports, écrire dans une table staging, contrôler les totaux/compte de lignes puis promouvoir par identifiant d’import. Conserver au moins le dernier snapshot validé.

**Migration :** oui si versionnement/staging. **Risque :** important côté volume et reprise.

### DB-12 — FAIBLE — Le soft delete et l’historisation sont hétérogènes

**Statut : problème avéré de cohérence, gravité dépendante des données. Modèles :** `Person`, `Contact`, `Organisation`, `Edition`, `Note`, `Membership`, `Payment`.

**Problème.** Certaines entités sont désactivées ou archivées (`active`, `leftAt`, `archivedAt`), d’autres sont supprimées définitivement. Les journaux (`ChangeLog`, imports) ne couvrent pas toutes les suppressions et changements de relations.

**Conséquence.** Impossible de reconstituer uniformément qui a supprimé ou détaché une donnée, et risque de comportements différents selon l’écran.

**Correctif recommandé.** Définir une politique de rétention par agrégat, conserver auteur/date/raison des suppressions sensibles, et rendre les listes explicites sur les données archivées.

**Migration :** selon le périmètre, oui. **Risque :** moyen.

## Points positifs et limites

Les FK, clés composites de jonction, index de base et migrations versionnées sont de bonnes fondations. Les imports comptables utilisent une transaction pour le remplacement des lignes. Les actions de comptes et de départ utilisent également des transactions sur plusieurs transferts.

Les performances SQL, les plans d’exécution, les volumes de production, les verrous réels et la qualité des données existantes n’ont pas été mesurés sur le serveur. Les constats “probable” doivent être validés avec des statistiques PostgreSQL, `EXPLAIN (ANALYZE, BUFFERS)` et un jeu de données représentatif.

## Priorités données

1. Bloquer la suppression en cascade des paiements reçus (DB-01).
2. Corriger la cohérence des pièces polymorphes (DB-02).
3. Protéger les commandes multi-étapes et concurrentes (DB-05, DB-06).
4. Décider la politique d’historique et de cascade (DB-07, DB-12).
5. Versionner les snapshots comptables (DB-11).
6. Ajouter les contraintes numériques et d’état après inventaire (DB-04).
7. Définir les clés d’idempotence et dédoublonner (DB-08).
8. Mesurer les plans puis paginer/projeter les lectures (DB-09, DB-10).
