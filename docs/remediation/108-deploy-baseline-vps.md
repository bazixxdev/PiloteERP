# VPS — Déploiement de la baseline 42a226f7

Date du préflight : 2026-09-20.

## Résultat

Le déploiement a été arrêté avant toute mutation du VPS.

Le commit source demandé est bien `42a226f7cedc7dc8158ad09238b83451c5d05b44`. Le dépôt de travail contenait toutefois des modifications locales non liées au commit ; aucune d’elles n’a été utilisée pour un déploiement.

## Préflight validé

- Services `pilote@cress`, `pilote@tlst` et Nginx : actifs.
- CRESS/TLST : ports Next en loopback `127.0.0.1:3002` et `127.0.0.1:3003`.
- `NODE_ENV=production` et `PILOTE_DEMO=0` pour les deux instances.
- Utilisateurs systemd : `pilote-cress` et `pilote-tlst`.
- Code des releases : `root:root`, non inscriptible par le runtime.
- `.env` : mode `600`, propriétaire propre à chaque instance.
- HTTPS : endpoints joignables ; les réponses observées sont `401`, cohérentes avec les routes protégées.
- Espace disque : 56 GiB disponibles sur `/`.
- Backups DB et médias récents présents dans `/var/backups/pilote-vps01/20260920-193012/` et non vides.
- Configuration systemd durcie et Nginx existant conservés.

## Blocage identifié

Le `deploy/deploy.sh` du commit demandé utilise les répertoires fixes `/var/www/cress-pilote` et `/var/www/tlst-pilote`, avec des suffixes temporaires `.next` et `.previous`. Il ne :

- crée pas de répertoire de release versionné ;
- n’écrit pas de marqueur du commit Git déployé ;
- n’écrit pas de date/instance dans une métadonnée persistante de release ;
- ne fournit pas de lien `current` permettant d’identifier sans ambiguïté la release active.

La traçabilité exigée pour le prochain déploiement n’est donc pas garantie. Le déploiement et les redémarrages ont été volontairement non exécutés. Aucun token, aucune base, configuration ou service n’a été modifié.

## SEC-03B

La présence sur une instance active n’a pas été revalidée après déploiement, celui-ci n’ayant pas eu lieu. Aucune rotation apiToken n’a été effectuée.

## Rollback

Les backups DB/médias et la procédure de rollback restent disponibles. La correction préalable requise est une réconciliation de `deploy.sh` avec la traçabilité de release attendue, puis une nouvelle validation avant déploiement.

## Verdict

`BLOQUÉ AVANT DÉPLOIEMENT` — aucun changement de production effectué.
