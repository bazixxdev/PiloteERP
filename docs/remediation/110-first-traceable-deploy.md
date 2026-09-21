# VPS — Premier déploiement traçable

Date : 2026-09-21.

## Commit et baseline

- Commit candidat et déployé : `180496abbbf6fdc47d903559cda6fa3d93c7fea6`.
- Working tree propre avant déploiement : oui.
- `npm ci` : PASS.
- `npx prisma generate` : PASS.
- Tests unitaires : PASS, 41/41.
- Tests sécurité : PASS, 33/33, sur `pilote_security_local` uniquement.
- Tests historiques distincts : aucune commande/suite séparée disponible dans le dépôt ; les scénarios historiques sont inclus dans les suites existantes et n’ont pas été rejoués comme une suite dédiée.
- Lint : PASS.
- TypeScript : PASS.
- Build production : PASS.
- Tests deploy/release : PASS, 8/8.
- `bash -n deploy/deploy.sh` : PASS.

## Backups préalables

Les sauvegardes suivantes ont été créées avant le déploiement et vérifiées comme non vides ; les dumps ont été contrôlés avec `pg_restore --list` :

- CRESS : `/var/backups/cress/first-traceable-20260921T053159Z/` — DB, médias, archive de l’ancien layout et unité systemd.
- TLST : `/var/backups/tlst/first-traceable-20260921T053159Z/` — DB et médias.

Les archives sensibles ont été conservées avec des permissions restrictives. Aucun contenu de secret n’est documenté.

## CRESS

- Release : `20260921-073416Z-180496abbbf6-cress`.
- Racine active : `/var/www/cress-pilote`.
- `.release.json` présent et lisible ; commit complet égal au commit candidat.
- `previous_release` : `none` pour cette première release manifestée ; l’ancien layout est conservé dans `/var/www/cress-pilote.prev`.
- Service actif, `User=pilote-cress`.
- Next écoute sur `127.0.0.1:3002`.
- `NODE_ENV=production`, `PILOTE_DEMO=0`.
- HTTPS et route de connexion accessibles ; réponse non authentifiée observée : `401`.
- Code `root:root`, `.env` en `600` sous `pilote-cress`, médias sous `pilote-cress`.

## TLST

- Release : `20260921-073820Z-180496abbbf6-tlst`.
- Racine active : `/var/www/tlst-pilote`.
- `.release.json` présent et lisible ; commit complet égal au commit candidat.
- `previous_release` : `none` pour cette première release manifestée ; l’ancien layout est conservé dans `/var/www/tlst-pilote.prev`.
- Service actif, `User=pilote-tlst`.
- Next écoute sur `127.0.0.1:3003`.
- `NODE_ENV=production`, `PILOTE_DEMO=0`.
- HTTPS et route de connexion accessibles ; réponse non authentifiée observée : `401`.
- Code `root:root`, `.env` en `600` sous `pilote-tlst`, médias sous `pilote-tlst`.

## Durcissements conservés

Les valeurs systemd effectives restent `NoNewPrivileges=yes`, `PrivateTmp=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `UMask=0077`, avec écriture limitée aux répertoires data/médias. Les sockets Next restent en loopback et le format Nginx `pilote_safe` est toujours actif pour CRESS et TLST.

## SEC-03B

Le code actif CRESS contient le mécanisme `rotateApiToken` et ses contrôles `admin.manage`. La présence a été vérifiée par inspection sans appeler l’action et sans effectuer de rotation de token.

## Rollback

Les répertoires `.prev` CRESS et TLST sont présents. Le script conserve également les dossiers d’échec horodatés et journalise le retour vers la release précédente si le healthcheck échoue. Aucun rollback n’a été nécessaire.

## Verdict

`PASS` — premier déploiement traçable réalisé avec le layout fixe historique ; aucune rotation de token, modification Nginx, firewall, utilisateurs Unix ou architecture `releases/current` effectuée.
