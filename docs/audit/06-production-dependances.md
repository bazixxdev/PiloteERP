# Audit de préparation à la production — PiloteERP

**Référence :** `bazixxdev/PiloteERP`, `main`, commit `3a0a6144474edb1aa1c7554ac68ea545251e74c4`. **Aucune modification du code, de la configuration ou du déploiement.**

## Avis général

Le build production local a réussi avec Node 26.8.2, Next 15.5.25, Prisma 6.19.3, 17 migrations et un seed fictif. Cela valide la reproductibilité technique de base, pas la préparation opérationnelle d’un serveur réel.

L’avis reste **défavorable pour des données réelles** tant que le bootstrap démo, la chaîne de reset administrateur, les garanties de sauvegarde/restauration, les dépendances vulnérables et l’isolation des instances ne sont pas traités. Les éléments d’infrastructure réelle sont explicitement **À confirmer** car aucun serveur n’a été consulté.

## Findings

### PROD-01 — CRITIQUE — Le déploiement active le mode démo par défaut

**Fichiers :** `deploy/deploy.sh:71-86`, `lib/auth.ts:31-38`, `tests/playwright.config.ts`.

Le script ajoute `PILOTE_DEMO=1` si la variable n’existe pas et peut exécuter le seed sur une base vide. En mode démo, une session connectée peut choisir une autre personne active via le cookie `pilote_person`.

**Risque.** Une recette de déploiement appliquée à une instance contenant ensuite des données réelles peut laisser un sélecteur de rôle global et des comptes de seed actifs.

**Correctif recommandé.** Refuser explicitement `PILOTE_DEMO=1` lorsque `NODE_ENV=production`, séparer bootstrap initial et seed de démonstration, et faire échouer le déploiement si le mode n’est pas explicitement défini.

**Validation avant production :** démarrer une instance production avec variable absente et vérifier que le démarrage échoue ou que le mode démo est impossible.

### PROD-02 — CRITIQUE — Une session ordinaire peut accéder aux liens de reset administrateur

**Fichiers :** `app/admin/page.tsx:66-72`, `app/actions/accounts.ts:55-75`, `lib/rights.ts`, `app/mot-de-passe-oublie/*`.

Le parcours a été reproduit dans l’environnement local : un lecteur connecté peut charger la boîte d’envoi de l’administration, récupérer un lien de reset puis définir le mot de passe d’un compte administrateur.

**Risque.** Prise de contrôle d’un compte privilégié.

**Correctif recommandé.** Filtrer strictement la boîte d’envoi par `canAdmin`, séparer les secrets de reset des données affichées et tester cette frontière avec une vraie session utilisateur.

**Statut.** Déjà détaillé dans `01-securite.md`; doit bloquer la mise en production.

### PROD-03 — ÉLEVÉ — Dépendance `xlsx` vulnérable et non maintenue sur des imports utilisateur

**Fichiers :** `package.json:37`, `package-lock.json`, `app/actions/contacts.ts`, `lib/pennylane.ts`.

La version verrouillée est `xlsx 0.18.5`, utilisée pour lire des fichiers contacts et comptables. Les avis CVE-2023-30533 (prototype pollution) et CVE-2024-22363 (ReDoS) couvrent cette branche ; le paquet npm historique n’est pas maintenu comme distribution corrigée.

**Risque.** Fichier spécialement construit ou très coûteux pouvant dégrader le processus ; la prise de contrôle n’est pas démontrée dans Pilote.

**Correctif recommandé.** Choisir une distribution maintenue ou un parseur de remplacement, isoler le parsing, borner lignes/cellules/temps/mémoire et tester des corpus hostiles.

### PROD-04 — ÉLEVÉ — Résolution PostCSS imbriquée ancienne

**Fichiers :** `node_modules/next/node_modules/postcss`, `package-lock.json`, `postcss.config.mjs`.

L’installation contient PostCSS 8.4.31 sous Next, alors que la racine est plus récente. Plusieurs avis 2026 couvrent la version imbriquée. Aucun chemin de CSS utilisateur vers PostCSS n’a été trouvé ; l’exploitabilité applicative est donc **À confirmer**.

**Correctif recommandé.** Vérifier la résolution complète après mise à jour Next/PostCSS, construire dans un environnement propre et contrôler source maps et entrées de build.

### PROD-05 — ÉLEVÉ — Sauvegarde non bloquante et rollback incomplet

**Fichiers :** `deploy/deploy.sh:78-88,95-115`.

`pg_dump` est suivi de `|| true`, puis les migrations et le build continuent. Le rollback restaure le dossier de code, pas automatiquement une base déjà migrée.

**Risque.** Déploiement réussi sans sauvegarde exploitable, puis impossibilité de revenir à un schéma compatible avec l’ancien code.

**Correctif recommandé.** Rendre la sauvegarde vérifiée et bloquante, tester la restauration avant bascule, adopter des migrations expand/contract et documenter le rollback de données.

### PROD-06 — ÉLEVÉ — Isolation système insuffisante entre instances

**Fichiers :** `deploy/systemd/pilote@.service:9-21`, `deploy/deploy.sh:99-100`, `deploy/instances/*.env`.

Toutes les instances utilisent `www-data:www-data` et le déploiement donne récursivement à cet utilisateur le code, les données et les médias. Aucun `ProtectSystem`, `ReadWritePaths`, `NoNewPrivileges` ou utilisateur distinct n’est défini.

**Risque.** Une compromission d’une instance peut lire ou modifier les fichiers et secrets d’une autre.

**Correctif recommandé.** Utilisateur et permissions par instance, code en lecture seule, secrets hors arborescence mutable et confinement systemd/conteneur. **Infrastructure réelle : À confirmer.**

### PROD-07 — ÉLEVÉ — `HOSTNAME=127.0.0.1` ne garantit pas l’écoute loopback de `next start`

**Fichiers :** `deploy/systemd/pilote@.service:15-16`, `package.json:8`, Next installé.

Le service définit `HOSTNAME`, mais `npm run start` lance `next start` sans `--hostname`. Le comportement du CLI installé n’utilise pas cette variable pour limiter l’écoute. Si les ports 3002/3003 sont exposés, le proxy Nginx et ses protections peuvent être contournés.

**Correctif recommandé.** Passer explicitement `--hostname 127.0.0.1` et filtrer les ports au niveau hôte. Accessibilité réseau réelle : **À confirmer**.

### PROD-08 — ÉLEVÉ — Configuration de production dépendante de variables permissives

**Fichiers :** `lib/auth.ts:17-73`, `deploy/deploy.sh:71-77`, `playwright.config.ts`.

Une URL `http://` est traitée comme locale et désactive les cookies `Secure`. `AUTH_RATE_LIMIT=0` est autorisé dans certaines combinaisons de mode/URL. Les recettes l’activent explicitement.

**Risque.** Cookie transmis sans HTTPS ou quotas désactivés après une mauvaise copie de configuration.

**Correctif recommandé.** Schéma de configuration de démarrage, HTTPS obligatoire hors profil local explicite, refus de `AUTH_RATE_LIMIT=0` en production et test de matrice des variables.

### PROD-09 — MOYEN — Dépendances directes déclarées avec caret

**Fichiers :** `package.json`, `package-lock.json`.

Next/React sont épinglés, mais Prisma, Better Auth, Tiptap, `xlsx`, `docx`, Recharts et plusieurs outils utilisent `^`. Le lock fournit une résolution reproductible tant qu’il est utilisé, mais une régénération ou une mise à jour partielle peut introduire des versions nouvelles.

**Correctif recommandé.** Politique de lock obligatoire en CI (`npm ci`), mises à jour planifiées avec changelog et scan d’avis. Épingler les composants sensibles si le cycle de validation l’exige.

### PROD-10 — MOYEN — Observabilité et audit opérationnel incomplets

**Fichiers :** `deploy/systemd/pilote@.service:19-21`, configurations Nginx, actions comptes/rôles/ICS.

Les sorties vont vers des fichiers locaux ; la rotation, rétention, alerting et corrélation ne sont pas définis dans le dépôt. Il n’existe pas d’audit de sécurité structuré pour les changements de rôle, reset, révocation ICS, accès aux exports ou suppressions sensibles.

**Risque.** Incident difficile à détecter et à reconstruire ; les jetons d’URL peuvent apparaître dans les access logs (`$request`).

**Correctif recommandé.** Logs structurés sans secrets, redaction Nginx, rotation centralisée, métriques et événements d’audit avec acteur/cible/résultat.

### PROD-11 — MOYEN — Health check trop faible pour certifier l’état applicatif

**Fichiers :** `deploy/deploy.sh:102-110`, `deploy/instances/*.env`.

Le script attend une URL de santé mais le dépôt ne montre pas de health endpoint détaillant DB, migrations, stockage ou intégrations. Une réponse HTTP peut donc précéder la disponibilité réelle d’un composant.

**Correctif recommandé.** Endpoint liveness minimal et readiness séparé vérifiant DB/migration ; ne pas appeler les services externes dans le liveness.

### PROD-12 — MOYEN — Emails et reset reposent sur une boîte interne non branchée

**Fichiers :** `lib/auth.ts:43-52`, `app/mot-de-passe-oublie/*`, `app/admin/page.tsx`.

Le reset écrit dans `MailOutbox` et l’administration remet le lien manuellement. Il n’y a pas de fournisseur SMTP, retry, suivi de livraison ou expiration côté opérateur au-delà du token Better Auth.

**Risque.** Processus non opérable à grande échelle, lien copié dans un canal non contrôlé, absence d’alerte sur les échecs.

**Correctif recommandé.** Intégration email explicite avec secrets hors dépôt, queue/retry, journal de livraison et suppression du lien dans les vues non administratives.

### PROD-13 — MOYEN — Stockage fichiers local sans stratégie de sauvegarde démontrée

**Fichiers :** `lib/attachments.ts`, `app/actions/attachments.ts`, `app/api/pieces/[id]/route.ts`, `deploy/deploy.sh:47,100`.

Les fichiers sont écrits dans `UPLOAD_DIR` et servis par le processus. Le script sauvegarde PostgreSQL mais ne montre pas de sauvegarde/restauration des médias ni de vérification des fichiers orphelins.

**Risque.** Base restaurée sans pièces, ou pièces perdues lors d’un changement d’hôte.

**Correctif recommandé.** Stockage durable versionné ou sauvegarde cohérente DB+médias, test de restauration, quota disque et nettoyage des fichiers sans ligne.

### PROD-14 — MOYEN — Timeouts et retries externes incomplets

**Fichiers :** `lib/brevo.ts`, `lib/helloasso.ts`, `lib/pennylane.ts`, actions de synchronisation.

Les appels externes sont attendus dans la requête et le dépôt ne présente pas une politique uniforme de timeout, retry exponentiel, circuit breaker ou idempotence par opération.

**Risque.** Requêtes pendantes, doublons lors d’un retry manuel, saturation du worker.

**Correctif recommandé.** Client HTTP partagé avec timeout, budgets de retry, clés d’idempotence et jobs asynchrones.

### PROD-15 — MOYEN — Headers HTTP et politique navigateur incomplète

**Fichiers :** `deploy/nginx/cress.bazixx.fr.conf`, `tlst.bazixx.fr.conf`.

`nosniff` et `X-Robots-Tag` sont présents. En revanche, aucune CSP, COOP/CORP, Permissions-Policy ou stratégie explicite de cache n’est définie dans les fichiers fournis. La terminaison HTTPS dépend de Certbot et de l’état réel du serveur.

**Risque.** Protection navigateur et isolation d’onglet variables ; cache involontaire de réponses sensibles à confirmer.

**Correctif recommandé.** Définir les headers après inventaire des besoins, `Cache-Control` explicite pour sessions/export/pièces, et vérifier TLS/redirect sur l’infrastructure.

### PROD-16 — FAIBLE — Source maps et diagnostics de build non documentés

**Fichiers :** `next.config.ts`, scripts build/deploy.

Le build utilise le `distDir` configurable mais ne documente pas la politique de source maps, d’artefacts conservés ni de rapprochement avec les logs. Les warnings de build ont été observés en recette.

**Correctif recommandé.** Décider si les source maps sont privées, les stocker hors serveur public et conserver l’artefact exact associé à chaque release.

## Dépendances inutilisées et obsolescence

Une dépendance déclarée n’est pas déclarée inutilisée uniquement parce qu’elle n’apparaît pas dans une recherche rapide : les imports dynamiques et plugins comptent. L’audit n’a pas supprimé de paquet. Une revue ciblée doit vérifier les packages directs, les doublons de PostCSS et les composants de build. `npm ci --omit=dev` n’est pas la stratégie actuelle car Prisma/build nécessitent une étape de construction séparée.

## Ce qui peut fonctionner en développement puis casser en production

- Tests en `PILOTE_DEMO=1`, rate limit désactivé et mot de passe de seed commun.
- HTTPS, cookies `Secure`, `BASE_PATH` et URLs de reset différents entre local et proxy.
- Nginx/Certbot, Basic Auth et ports loopback non reproduits par `next start` seul.
- Boîte d’envoi locale remplaçant SMTP réel.
- Build avec dépendances déjà présentes et cache local, alors que le serveur fait `npm ci`.
- Médias présents sur le disque de développement mais non restaurés avec PostgreSQL.
- Dépendances externes disponibles en recette via mocks mais lentes, paginées ou modifiées en production.
- Migrations exécutées avant bascule sans restauration réellement testée.

## Check-list de mise en production

Avant mise en ligne, exiger :

1. mode démo refusé et seed contrôlé ;
2. reset/invitation corrigés et testés avec comptes distincts ;
3. scan de dépendances et décision sur `xlsx`/PostCSS ;
4. `npm ci` reproductible et artefact de build identifié ;
5. sauvegarde PostgreSQL et médias restaurée sur une recette ;
6. migrations expand/contract et rollback documenté ;
7. readiness DB et logs/alertes centralisés ;
8. ports Next explicitement loopback ;
9. HTTPS, cookies, headers et cache vérifiés derrière Nginx ;
10. timeouts/retries/jobs externes testés en panne ;
11. rotation des logs et redaction des jetons ;
12. limites d’upload, espace disque et nettoyage contrôlés.

## Limites

Le VPS, le pare-feu, les certificats réels, les droits Unix, les sauvegardes existantes, les secrets hors dépôt et les dashboards n’ont pas été consultés. Toute conclusion les concernant reste donc explicitement **À confirmer**.
