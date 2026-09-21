# Production et déploiement

Deux instances sur `bazixx-vps` : CRESS (`pilote@cress`, port 3002) et TLST (`pilote@tlst`, port 3003), comptes Unix dédiés, Next en loopback derrière Nginx, PostgreSQL local. Détail : `deploy/README.md`, `docs/remediation/102` à `111`.

## Quand lire ce fichier

- Déploiement, variable d'environnement, `lib/auth.ts`, `deploy/`, Nginx, systemd, sauvegarde, restauration, rotation d'un jeton.

## Règles

- **CRITICAL** — on déploie **uniquement** par `./deploy/deploy.sh <cress|tlst>` depuis un arbre git propre sur `main` : le script lance d'abord `npm run check:full` en local (journal dans `test-results/check-full-<stamp>.log`) et s'arrête si une suite est rouge — pas de variable pour sauter cette étape ; puis build avant bascule, dump `pg_dump -Fc` validé par `pg_restore --list` + archive médias (mode 0600, `/var/backups/<instance>/`), migration, bascule, healthcheck, `.release.json` (commit déployé, release précédente). Jamais de `rsync`, `git pull` ou `prisma migrate` à la main sur le serveur.
- **NEVER** `PILOTE_DEMO=1`, `AUTH_RATE_LIMIT=0` ou une `BETTER_AUTH_URL` en HTTP sur une instance publique : `lib/auth.ts` refuse de démarrer (fail-fast). Ne pas ajouter de profil à `isExplicitLocalProfile` pour « faire passer » un environnement.
- **NEVER** `--seed` sur une instance qui porte des données réelles ; le seed est réservé à la recette et à la remise à zéro d'une démo, sur demande explicite.
- **NEVER** un secret dans le dépôt, un log, une URL hors `?jeton=`/chemin ICS (masqués par le format Nginx `pilote_safe`), un message d'erreur. Les `.env` vivent sur le serveur en `0600` sous le compte de l'instance ; `env.example` est le gabarit.
- **ALWAYS** avant une migration qui transforme des données : la rejouer sur le dernier dump restauré dans une base jetable (procédure dans `docs/remediation/111-restauration-hors-production.md`).
- **ALWAYS** après un déploiement : `systemctl is-active pilote@<instance>`, `ss -ltn | grep 127.0.0.1:<port>`, `.release.json` = commit attendu, `curl` de `/connexion` en HTTPS (401 = rideau htpasswd, normal).
- Rollback : code seul si la migration est rétrocompatible (`.prev` conservé par le script) ; sinon arrêt du service, `pg_restore` du dump + archive médias, puis ancienne release. Jamais de restauration DB automatique.
- Rotation d'un jeton : `apiToken` par l'action `rotateApiToken` (admin.manage) puis mise à jour des classeurs ; jetons ICS régénérés par personne puis abonnements mis à jour. Ces deux rotations sont **différées** tant qu'aucun consommateur réel n'existe (`docs/remediation/README.md §K`).
- Le VPS `mca-vps` est réservé à un client : rien de Pilote n'y va. Toute action distante destructive (`rm`, `DROP`) se donne à Gaël en commande, une par une.
