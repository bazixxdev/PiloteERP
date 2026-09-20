# Backlog technique consolidé — PiloteERP

Ce backlog consolide les rapports `00-cartographie.md` à `06-production-dependances.md`. Les doublons ont été regroupés : par exemple, `saveField`, les autorisations dispersées et les erreurs de cascade ne sont pas répétés comme des tâches indépendantes. **Aucune correction n’a été commencée.**

Les ordres sont relatifs : une tâche de rang 1 doit être traitée avant une tâche de rang supérieur lorsque celle-ci en dépend.

## Backlog priorisé

| Ordre | ID | Domaine | Sévérité | Titre | Effort | Dépendances |
|---:|---|---|---|---|---|---|
| 1 | BLK-01 | sécurité | CRITIQUE | Cloisonner la boîte d’envoi et les liens de reset | L | — |
| 2 | BLK-02 | sécurité | CRITIQUE | Désactiver le mode démo et le bootstrap seed en production | M | BLK-01 pour les tests d’accès |
| 3 | BLK-03 | données | ÉLEVÉ | Empêcher la perte de paiements reçus par cascades/détachements | M | — |
| 4 | BLK-04 | sécurité/données | ÉLEVÉ | Garantir la cohérence des pièces et relations polymorphes | L | BLK-03 |
| 5 | BLK-05 | sécurité | ÉLEVÉ | Unifier l’autorisation par ressource et fermer les exports/actions divergents | XL | BLK-01, BLK-04 |
| 6 | BLK-06 | sécurité | ÉLEVÉ | Corriger validations financières, budget et transitions indirectes | L | BLK-05 |
| 7 | BLK-07 | production | ÉLEVÉ | Sécuriser déploiement, sauvegarde, restauration et rollback DB | XL | BLK-03 |
| 8 | BLK-08 | production | ÉLEVÉ | Isoler les instances et forcer l’écoute loopback | M | BLK-07 |
| 9 | BLK-09 | dépendances | ÉLEVÉ | Remplacer/isolER le parseur XLSX et vérifier les résolutions vulnérables | M | — |
| 10 | BLK-10 | tests | ÉLEVÉ | Ajouter la matrice de tests authz/IDOR/reset/exports | L | BLK-01, BLK-05 |
| 11 | BLK-11 | données | ÉLEVÉ | Rendre atomiques les commandes multi-étapes et concurrentes | L | BLK-03, BLK-04 |
| 12 | BLK-12 | données | ÉLEVÉ | Ajouter contraintes numériques, états et idempotence | XL | BLK-06, BLK-11 |
| 13 | BLK-13 | performance | ÉLEVÉ | Borner les exports et les graphes d’édition | M | BLK-05 |
| 14 | BLK-14 | architecture | ÉLEVÉ | Retirer progressivement `saveField` comme second moteur métier | XL | BLK-05, BLK-06, BLK-11 |
| 15 | BLK-15 | production | MOYEN | Définir observabilité, audit sécurité et health/readiness | M | BLK-07, BLK-08 |
| 16 | BLK-16 | production | MOYEN | Fiabiliser emails, fichiers, timeouts et jobs externes | L | BLK-07, BLK-15 |
| 17 | BLK-17 | performance | MOYEN | Réduire N+1 imports/synchronisations après mesure | M | BLK-11, BLK-15 |
| 18 | BLK-18 | tests | MOYEN | Construire la pyramide unitaires/intégration/API | L | BLK-10, BLK-11 |
| 19 | BLK-19 | architecture | MOYEN | Séparer pages, query services et commandes | XL | BLK-14, BLK-18 |
| 20 | BLK-20 | données | MOYEN | Définir rétention, archivage et historisation uniforme | L | BLK-03, BLK-07 |
| 21 | BLK-21 | performance | MOYEN | Paginer les historiques et mesurer les index | M | BLK-13, BLK-17 |
| 22 | BLK-22 | production | MOYEN | Standardiser configuration et politique de dépendances | M | BLK-02, BLK-09 |
| 23 | BLK-23 | architecture | FAIBLE | Réduire alias historiques et conventions divergentes | M | BLK-19, BLK-20 |
| 24 | BLK-24 | performance | FAIBLE | Optimiser cache, bundle et virtualisation uniquement sur métriques | M | BLK-15, BLK-21 |

## Fiches de tâches

### BLK-01 — Cloisonner reset et boîte d’envoi

**Domaine / sévérité :** sécurité / CRITIQUE. **Impact :** empêcher la prise de contrôle d’un compte privilégié par un compte ordinaire. **Fichiers :** `app/admin/page.tsx`, `app/actions/accounts.ts`, `lib/rights.ts`, pages reset. **Dépendances :** aucune. **Risque de régression :** moyen, car l’administration doit conserver son parcours. **Effort :** L.

Filtrer côté serveur toute lecture de `MailOutbox`, ne jamais exposer les liens à un lecteur, vérifier la cible lors de la préparation et ajouter les scénarios multi-sessions. Rejouer le test de non-régression avant tout autre changement de droits.

### BLK-02 — Désactiver le mode démo en production

**Domaine / sévérité :** sécurité / CRITIQUE. **Impact :** empêcher l’usurpation de personne et les comptes/seed de démonstration. **Fichiers :** `deploy/deploy.sh`, `lib/auth.ts`, `lib/session.ts`, `prisma/seeds/common.ts`, `playwright.config.ts`. **Dépendance :** BLK-01. **Risque :** moyen. **Effort :** M.

Rendre le mode production explicite et échouer en cas de configuration ambiguë. Le profil de test doit rester séparé du profil production-like.

### BLK-03 — Protéger les paiements reçus et les cascades

**Domaine / sévérité :** données / ÉLEVÉ. **Impact :** éviter perte financière irréversible. **Fichiers :** `prisma/schema.prisma` modèles `Payment`/`FundingLine`/`Convention`, `app/actions/edition.ts`, `payments.ts`. **Dépendances :** aucune. **Risque :** élevé lors de la migration FK. **Effort :** M.

Inclure les paiements dans les vérifications d’usage, préférer archivage ou `RESTRICT`, inventorier les données existantes et tester les détachements.

### BLK-04 — Normaliser ou valider les rattachements polymorphes

**Domaine / sévérité :** sécurité/données / ÉLEVÉ. **Impact :** empêcher pièces et objets incohérents. **Fichiers :** `Attachment`, `Task`, `Payment`, `Note` dans `schema.prisma`, actions correspondantes. **Dépendances :** BLK-03. **Risque :** important pour données existantes. **Effort :** L.

Choisir un parent canonique, valider la cohérence du graphe et migrer les lignes incompatibles avant de durcir les contraintes.

### BLK-05 — Unifier l’autorisation par ressource

**Domaine / sévérité :** sécurité / ÉLEVÉ. **Impact :** fermer IDOR, exports trop larges et actions divergentes. **Fichiers :** `lib/rights.ts`, `lib/permissions.ts`, `lib/session.ts`, `middleware.ts`, exports et `app/actions/*`. **Dépendances :** BLK-01, BLK-04. **Risque :** élevé : changements de visibilité. **Effort :** XL.

Formaliser une matrice sujet/action/ressource/contexte puis l’appeler depuis pages, exports, téléchargements et actions. Ajouter les tests avant migration des chemins.

### BLK-06 — Fermer les contournements financiers

**Domaine / sévérité :** sécurité / ÉLEVÉ. **Impact :** empêcher approbation au mauvais niveau et modification budgétaire indirecte. **Fichiers :** `app/actions/edition.ts`, `proposals.ts`, `lib/rights.ts`. **Dépendance :** BLK-05. **Risque :** moyen à élevé selon règles métier. **Effort :** L.

Recalculer les niveaux côté serveur, interdire le niveau zéro comme décideur, appliquer la permission du champ lors de l’acceptation d’une proposition et tester les transitions concurrentes.

### BLK-07 — Sécuriser sauvegarde, restauration et migrations

**Domaine / sévérité :** production / ÉLEVÉ. **Impact :** reprise après incident et déploiement réversible. **Fichiers :** `deploy/deploy.sh`, migrations Prisma, configuration systemd. **Dépendances :** BLK-03. **Risque :** important en exploitation. **Effort :** XL.

Rendre `pg_dump` vérifié et bloquant, sauvegarder les médias, tester une restauration, adopter expand/contract et définir le rollback de schéma et données.

### BLK-08 — Isoler instances et ports

**Domaine / sévérité :** production / ÉLEVÉ. **Impact :** limiter l’amplification d’une compromission. **Fichiers :** `deploy/systemd/pilote@.service`, `deploy/deploy.sh`, Nginx. **Dépendance :** BLK-07. **Risque :** moyen. **Effort :** M.

Utilisateurs Unix distincts, répertoires en écriture minimaux, `--hostname 127.0.0.1`, filtrage pare-feu et test d’accès direct aux ports.

### BLK-09 — Traiter dépendances vulnérables

**Domaine / sévérité :** dépendances / ÉLEVÉ. **Impact :** réduire parsing hostile et risques build. **Fichiers :** `package.json`, `package-lock.json`, `lib/pennylane.ts`, actions contacts/ledger, résolution PostCSS. **Dépendances :** aucune. **Risque :** moyen sur imports. **Effort :** M.

Choisir une distribution XLSX maintenue ou un remplaçant, isoler le parseur et vérifier toutes les résolutions PostCSS/Next dans une installation propre.

### BLK-10 — Matrice de tests d’accès

**Domaine / sévérité :** tests / ÉLEVÉ. **Impact :** empêcher réintroduction des failles critiques. **Fichiers :** `tests/*`, `playwright.config.ts`, fixtures DB. **Dépendances :** BLK-01, BLK-05. **Risque :** faible. **Effort :** L.

Ajouter tests directs API/Server Actions avec utilisateurs distincts, objets étrangers, cookie invalide, exports et reset. Les tests ne doivent pas dépendre du sélecteur démo.

### BLK-11 — Rendre commandes et concurrence atomiques

**Domaine / sévérité :** données / ÉLEVÉ. **Impact :** éviter écritures partielles, doublons et fichiers orphelins. **Fichiers :** `app/actions/time.ts`, `edition.ts`, `attachments.ts`, `requests.ts`, imports. **Dépendances :** BLK-03, BLK-04. **Risque :** moyen. **Effort :** L.

Définir les frontières transactionnelles, ajouter idempotence/version, stockage temporaire et tests `Promise.all`/retries.

### BLK-12 — Contraintes et idempotence DB

**Domaine / sévérité :** données / ÉLEVÉ. **Impact :** empêcher valeurs invalides et doublons. **Fichiers :** `prisma/schema.prisma`, migrations, actions/imports. **Dépendances :** BLK-06, BLK-11. **Risque :** élevé sur données existantes. **Effort :** XL.

Nettoyer les données, ajouter `Decimal`, checks/enums, clés d’idempotence et contraintes uniques justifiées.

### BLK-13 — Borner exports et éditions

**Domaine / sévérité :** performance / ÉLEVÉ. **Impact :** éviter mémoire/timeout. **Fichiers :** `app/admin/export/route.ts`, `lib/queries.ts`, routes d’export. **Dépendance :** BLK-05. **Risque :** faible. **Effort :** M.

Projections, pagination et génération asynchrone des exports lourds ; mesurer payload et RSS avant/après.

### BLK-14 — Retirer `saveField` du domaine critique

**Domaine / sévérité :** architecture / ÉLEVÉ. **Impact :** restaurer invariants centralisés. **Fichiers :** `app/actions/fields.ts`, `lib/fields.ts`, actions spécialisées. **Dépendances :** BLK-05, BLK-06, BLK-11. **Risque :** élevé sur UI inline. **Effort :** XL.

Limiter l’API générique aux champs triviaux et déléguer états, relations et transitions aux commandes spécialisées.

### BLK-15 — Observabilité et readiness

**Domaine / sévérité :** production / MOYEN. **Impact :** détecter erreurs et incidents. **Fichiers :** systemd, Nginx, actions sensibles, endpoints. **Dépendances :** BLK-07, BLK-08. **Risque :** faible. **Effort :** M.

Logs structurés/redactés, rotation, métriques, health/readiness DB et audit des changements de droits.

### BLK-16 — Fiabiliser services et stockage

**Domaine / sévérité :** production / MOYEN. **Impact :** éviter requêtes bloquées et pertes de médias. **Fichiers :** intégrations `lib/brevo*`, `helloasso*`, `pennylane.ts`, attachments, reset. **Dépendances :** BLK-07, BLK-15. **Risque :** moyen. **Effort :** L.

Timeouts, retries bornés, jobs asynchrones, queue email et sauvegarde/restauration des uploads.

### BLK-17 — Réduire N+1 après mesure

**Domaine / sévérité :** performance / MOYEN. **Impact :** imports et sync plus rapides. **Fichiers :** `lib/*-sync.ts`, `app/actions/admin.ts`, `contacts.ts`, `time.ts`. **Dépendances :** BLK-11, BLK-15. **Risque :** moyen. **Effort :** M.

Précharger les clés, maps en mémoire, `createMany` par lots et métriques de requêtes.

### BLK-18 — Construire la pyramide de tests

**Domaine / sévérité :** tests / MOYEN. **Impact :** diagnostic rapide et couverture métier. **Fichiers :** `tests/unit`, `tests`, services à extraire. **Dépendances :** BLK-10, BLK-11. **Risque :** faible. **Effort :** L.

Ajouter tests unitaires de règles pures, intégration PostgreSQL des commandes et API contract tests ; réduire la dépendance aux délais UI.

### BLK-19 — Séparer query services, commandes et UI

**Domaine / sévérité :** architecture / MOYEN. **Impact :** réduire couplage et coût d’évolution. **Fichiers :** `app/**/page.tsx`, `app/actions/*`, `lib/queries.ts`, pages admin/contacts. **Dépendances :** BLK-14, BLK-18. **Risque :** moyen. **Effort :** XL.

Refactoriser verticalement par agrégat, avec view-models et repositories testables.

### BLK-20 — Politique d’historique uniforme

**Domaine / sévérité :** données / MOYEN. **Impact :** conservation et audit des données. **Fichiers :** schéma `Person`, `Contact`, `Edition`, `Payment`, `Membership`, `Note`, actions de suppression. **Dépendances :** BLK-03, BLK-07. **Risque :** moyen. **Effort :** L.

Définir archivage, rétention et auteur de suppression par agrégat.

### BLK-21 — Pagination et index guidés par métriques

**Domaine / sévérité :** performance / MOYEN. **Impact :** croissance des historiques. **Fichiers :** `lib/queries.ts`, pages d’historique, schéma. **Dépendances :** BLK-13, BLK-17. **Risque :** faible. **Effort :** M.

Mesurer `EXPLAIN`, ajouter index composites justifiés et séparer historique récent/complet.

### BLK-22 — Configuration et dépendances reproductibles

**Domaine / sévérité :** production / MOYEN. **Impact :** éviter écarts dev/test/prod. **Fichiers :** `package.json`, `playwright.config.ts`, `deploy/deploy.sh`, `next.config.ts`, `docker-compose.yml`. **Dépendances :** BLK-02, BLK-09. **Risque :** faible. **Effort :** M.

Schéma de configuration typé, profils explicites, CI avec `npm ci`, scan de lock et artefact de build identifié.

### BLK-23 — Nettoyer alias et vocabulaire historique

**Domaine / sévérité :** architecture / FAIBLE. **Impact :** lisibilité et onboarding. **Fichiers :** `lib/fields.ts`, schéma, composants financeurs/organisations, migrations. **Dépendances :** BLK-19, BLK-20. **Risque :** faible. **Effort :** M.

Choisir un nom canonique, migrer les alias et documenter les compatibilités.

### BLK-24 — Optimisations conditionnelles frontend/cache

**Domaine / sévérité :** performance / FAIBLE. **Impact :** bundle et rendu uniquement si mesurés. **Fichiers :** composants UI, Tiptap, listes, configuration Next. **Dépendances :** BLK-15, BLK-21. **Risque :** faible. **Effort :** M.

Ne faire cache, lazy loading ou virtualisation qu’après mesures bundle/RUM et tests d’invalidation.

## Plan de remédiation en lots relisibles

### Lot 0 — Garde-fous et preuve

Inclure BLK-10 partiellement : tests de reproduction des failles critiques, base de recette production-like, inventaire des données. Aucun changement fonctionnel ; ce lot fixe les critères de sortie.

### Lot 1 — Accès comptes et mode production

Traiter BLK-01 puis BLK-02. Rejouer reset, invitation, révocation, désactivation et démarrage sans mode démo.

### Lot 2 — Intégrité financière et cascades

Traiter BLK-03 puis BLK-06. Ajouter les tests DB correspondants avant toute migration.

### Lot 3 — Pièces et commandes atomiques

Traiter BLK-04 puis BLK-11. Tester incohérences, fichiers orphelins, retries et concurrence.

### Lot 4 — Autorisation uniforme

Traiter BLK-05, puis finaliser BLK-10. Vérifier pages, API, exports, fichiers et Server Actions par matrice.

### Lot 5 — Déploiement récupérable

Traiter BLK-07, BLK-08 et BLK-15. Le lot doit fournir une restauration de preuve, readiness, logs et ports contrôlés.

### Lot 6 — Dépendances et intégrations

Traiter BLK-09, BLK-16 et BLK-22. Tester imports, APIs lentes, retries, email et stockage.

### Lot 7 — Performance mesurée

Mesurer puis traiter BLK-13, BLK-17 et BLK-21. Chaque optimisation doit être accompagnée d’un avant/après.

### Lot 8 — Architecture durable

Traiter BLK-12, BLK-14, BLK-18, BLK-19 et BLK-20 par agrégat, sans refactor global. Chaque sous-lot doit conserver les contrats E2E critiques.

### Lot 9 — Nettoyage conditionnel

Traiter BLK-23 et BLK-24 uniquement après stabilisation, couverture et métriques. Ce lot ne doit jamais précéder les corrections de sécurité ou d’intégrité.

## Critères de sortie communs

Chaque lot doit fournir : tests ciblés verts, migration explicitement reviewée si nécessaire, preuve de rollback ou de restauration lorsqu’il touche aux données, mesure avant/après lorsqu’il touche à la performance, et aucune modification non liée dans le même changement.
