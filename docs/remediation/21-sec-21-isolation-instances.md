# SEC-21 / PROD-06 — Isolation Unix des instances

## Cause racine

Le template systemd exécutait toutes les instances sous `www-data`, et `deploy.sh` appliquait `chown -R www-data` aux projets, données et médias. Une compromission d'une instance pouvait donc lire les chemins de l'autre si elle les connaissait.

## Modèle cible

L'identité est dérivée du nom d'instance : `pilote-cress` et `pilote-tlst`. Le template `pilote@.service` utilise `User=pilote-%i` et `Group=pilote-%i`.

- code/release : lisible par l'utilisateur de son instance, non inscriptible après le déploiement (`755` répertoires, `644` fichiers) ;
- `.env` : propriété de l'utilisateur de l'instance, `0600` ;
- données runtime et uploads : propriété de l'instance, `0750`, seuls chemins d'écriture prévus ;
- bases PostgreSQL : URL et rôles propres à chaque instance, générés par le déploiement.

`deploy.sh` échoue si l'utilisateur système attendu n'existe pas ; il ne crée pas de compte système automatiquement.

## Protections systemd

Ajoutées au template : `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=strict`, `ProtectHome=true`, `ReadWritePaths` limité aux répertoires data/médias de l'instance, et `UMask=0077`. Le loopback SEC-22 reste actif via la commande `next start --hostname 127.0.0.1`.

## Validation

- Tests de configuration/unitaires : **19/19 PASS**.
- `bash -n deploy/deploy.sh` : **PASS**.
- `npm run test:security` : **33/33 PASS**.
- `npm run lint` : **PASS**.
- `npx tsc --noEmit` : **PASS**.
- `npm run build` : **PASS**.

Les tests locaux vérifient le template, les chemins d'écriture et l'absence de `www-data`. Ils ne peuvent pas démontrer les ACL Unix réelles entre deux utilisateurs car les comptes `pilote-cress` et `pilote-tlst` ne sont pas créés dans cet environnement.

## Procédure VPS, non exécutée

1. Sauvegarder chaque base et les répertoires data/médias.
2. Créer `pilote-cress` et `pilote-tlst` avec home désactivé et shell `nologin`.
3. Arrêter les services concernés.
4. Vérifier que les répertoires de release, `.env`, data et médias appartiennent à l'instance correspondante et appliquer les modes ci-dessus.
5. Installer le nouveau template systemd, vérifier les droits des fichiers de logs ou basculer leur ouverture vers journald.
6. Exécuter `systemctl daemon-reload`, puis démarrer une instance à la fois.
7. Vérifier healthcheck, logs, Prisma et upload sur chaque instance.
8. Depuis chaque utilisateur, vérifier l'accès à ses propres chemins et le refus de lecture de l'autre `.env` et de ses médias.
9. En cas d'échec, arrêter le service, restaurer ownership/modes et remettre l'unité précédente.

## Limites

Le VPS réel n'a pas été audité ni modifié : SEC-21 est corrigé côté configuration, pas déclaré déployé en production. Les permissions effectives des logs et les ACL éventuelles du parent `/var/www` restent à vérifier sur le serveur.

## Verdict

**SEC-21 CORRIGÉ CÔTÉ CONFIGURATION**

