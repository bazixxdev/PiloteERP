# Audit VPS réel — lecture seule

Date : 2026-09-20  
Hôte CRESS/TLST audité : `srv771239` (`bazixx-vps`)  
Référentiel comparé : corrections SEC-20, SEC-21, SEC-22, SEC-23, SEC-24 et SEC-26 présentes dans ce dépôt.

## Périmètre et méthode

Audit sans mutation : aucune écriture distante, aucun changement de permission, aucun `daemon-reload`, reload/restart de service, rotation de secret, restauration ou modification de firewall. `nginx -t` a été exécuté uniquement comme test de syntaxe.

Le dépôt local contient les corrections mais présente des modifications non commitées ; la release distante ne peut donc pas être déclarée identique au HEAD local sur la seule base du commit.

## Matrice d’écart

| Contrôle | État attendu | État réel | Conforme ? | Action nécessaire | Priorité |
|---|---|---|---|---|---|
| Comptes Unix | `pilote-cress` et `pilote-tlst` présents | Aucun des deux comptes n’existe ; `www-data` est présent | Non | Créer/valider les comptes dédiés selon SEC-21 | BLOQUANT AVANT DONNÉES RÉELLES |
| Utilisateur systemd | `User=pilote-%i`, `Group=pilote-%i` | Les deux unités chargées utilisent `www-data:www-data` | Non | Déployer l’unité corrigée puis valider | BLOQUANT AVANT DONNÉES RÉELLES |
| Durcissement systemd | `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, `ProtectHome`, `ReadWritePaths`, `UMask=0077` | `NoNewPrivileges=no`, `PrivateTmp=no`, protections absentes, `UMask=0022` | Non | Installer l’unité SEC-21 | BLOQUANT AVANT DONNÉES RÉELLES |
| Isolation code/data/media | Ownership par instance, data/media `0750` | Code, data et médias appartiennent à `www-data:www-data`, répertoires `0755` | Non | Réattribuer ownership/modes après sauvegarde contrôlée | BLOQUANT AVANT DONNÉES RÉELLES |
| `.env` | Instance owner, `0600` | `/var/www/*-pilote/.env` : `www-data:www-data`, `0644` | Non | Restreindre les secrets et vérifier les accès croisés | BLOQUANT AVANT DONNÉES RÉELLES |
| Isolation croisée lisibilité | Chaque compte lit ses secrets/uploads mais pas ceux de l’autre | Test non démontrable : comptes absents ; ownership partagé | Non | Créer comptes puis exécuter les tests de lecture refusée | BLOQUANT AVANT DONNÉES RÉELLES |
| Mode production | `NODE_ENV=production`, `PILOTE_DEMO=0`, HTTPS, rate limit non nul, aucun profil local/test | `NODE_ENV`, profil et rate limit ne sont pas présents dans les clés inspectées ; `PILOTE_DEMO=1` sur CRESS et TLST ; URL présente mais valeur non affichée | Non | Corriger les environnements et vérifier les valeurs sans les divulguer | BLOQUANT AVANT DONNÉES RÉELLES |
| Loopback Next | `127.0.0.1:3002` et `127.0.0.1:3003` | `*:3002` et `*:3003` | Non | Déployer le démarrage explicite `--hostname 127.0.0.1` | BLOQUANT AVANT DONNÉES RÉELLES |
| PostgreSQL | Loopback uniquement | `127.0.0.1:5432` et `[::1]:5432` | Oui | — | — |
| Firewall | Entrées limitées aux ports nécessaires | Sur `bazixx-vps`, UFW inactif ; iptables INPUT ACCEPT, ports publics 22/80/443 et autres services non filtrés au niveau hôte | Non | Établir puis valider une politique firewall | BLOQUANT AVANT DONNÉES RÉELLES |
| Nginx syntaxe | Test valide | `nginx -t` réussi | Oui | — | — |
| Nginx proxy | CRESS → `127.0.0.1:3002`, TLST → `127.0.0.1:3003` | Conforme dans la configuration chargée | Oui | — | — |
| HTTPS/redirection | TLS public et HTTP → HTTPS | Vhosts CRESS/TLST présents en 443 et redirections 301 visibles ; certificats non inspectés en détail | Partiel | Vérifier certificats/chaînes et test HTTPS public | IMPORTANT |
| Redaction logs | `log_format pilote_safe` actif, sans query string ni chemin tokenisé | `access_log` CRESS/TLST présents, `pilote_safe` absent de `nginx -T` ; logs historiques nombreux | Non | Installer/activer le format puis rotation contrôlée et revue historique | BLOQUANT AVANT DONNÉES RÉELLES |
| Logs applicatifs | Accès restreint | `/var/log/cress-pilote.log` et TLST `0644`, `root:root` | Non | Définir ownership/permissions ou journald selon SEC-21/23 | IMPORTANT |
| Sauvegardes DB | Dumps non vides, `0600`, ownership contrôlé | Dumps CRESS/TLST présents et non vides, mais `0644`, `root:root` ; validation `pg_restore --list` non exécutée | Partiel | Restreindre les dumps et valider leur contenu | BLOQUANT AVANT DONNÉES RÉELLES |
| Sauvegardes médias | Archives non vides, séparées de la DB | Aucune archive médias CRESS/TLST identifiée dans les chemins inspectés | Non | Produire/contrôler une archive médias par instance | BLOQUANT AVANT DONNÉES RÉELLES |
| Espace/disponibilité | Espace suffisant, services sains | Disque racine 43% utilisé, mémoire disponible ; unités actives | Oui | Surveiller absence de swap et erreurs | DURCISSEMENT |
| Erreurs récentes | Pas d’erreur significative de service | Échecs Certbot répétés, invalid assignment dans `.env` TLST, scans SSH | Non | Corriger l’environnement TLST et traiter Certbot ; revue sécurité SSH | IMPORTANT |
| Release active | Release versionnée/current identifiable et correspondant au dépôt corrigé | Répertoires non versionnés ; aucun symlink `current` identifié ; processus Next v15.5.25 ; date de déploiement des répertoires : 2026-09-19 | Non | Déployer via structure versionnée et conserver une preuve de commit | IMPORTANT |

## Identités, chemins et tests d’accès

Les unités réellement chargées sont `pilote@cress.service` et `pilote@tlst.service`, toutes deux actives. Leur `systemctl cat` réel utilise `www-data`, `npm run start`, ne contient pas les protections SEC-21 et écrit dans `/var/log/%i-pilote.log`.

Les chemins `/var/www/cress-pilote*` et `/var/www/tlst-pilote*` sont partagés par `www-data` et en `0755`. Les comptes dédiés étant absents, les tests « compte CRESS peut lire ses propres fichiers mais pas ceux de TLST » et l’inverse sont **FAIL/non exécutables** ; aucun contournement de permission n’a été tenté.

## Réseau et exposition

Sockets observées sur `bazixx-vps` : Nginx `0.0.0.0/[::]:80,443`, SSH `0.0.0.0/[::]:22`, PostgreSQL loopback, et Next sur `*:3002` et `*:3003`. Les ports Next sont donc exposés hors loopback indépendamment du proxy.

Les checks HTTPS `/health` ont répondu `401` pour les deux domaines, ce qui prouve une réponse applicative/proxy mais pas une readiness publique anonyme.

## Secrets, logs et sauvegardes

Les valeurs sensibles n’ont pas été affichées. Les variables `BETTER_AUTH_URL` et `PILOTE_DEMO` sont présentes ; `PILOTE_DEMO=1` est explicitement observé sur les deux instances. Les clés `NODE_ENV`, `PILOTE_ENV_PROFILE` et `AUTH_RATE_LIMIT` n’ont pas été trouvées dans les `.env` inspectés ; `NODE_ENV=production` est toutefois injecté par l’ancienne unité systemd. L’environnement réel est donc non conforme à la politique documentée.

Les logs Nginx actifs/historiques existent avec rotation `.gz`. Le format sûr du dépôt n’est pas visible dans `nginx -T`, et les anciens logs peuvent potentiellement contenir des URLs tokenisées ; aucune valeur de log n’a été reproduite et aucune rotation n’a été lancée.

Des dumps DB CRESS/TLST non vides existent sous `/var/backups/{cress,tlst}`, mais en `0644`. Aucune sauvegarde médias spécifique CRESS/TLST n’a été trouvée dans l’inspection. Aucun dump n’a été restauré.

## Écarts classés

### BLOQUANT AVANT DONNÉES RÉELLES

1. Isolation Unix absente : comptes dédiés absents, services et fichiers partagés sous `www-data`.
2. Durcissement systemd absent.
3. `PILOTE_DEMO=1` sur les deux services de production.
4. `NODE_ENV`/profil/rate limit non vérifiables conformément aux exigences ; configuration `.env` incomplète.
5. Next exposé sur `*:3002` et `*:3003`.
6. Firewall hôte inactif/politique INPUT permissive sur `bazixx-vps`.
7. Format de logs redacted non actif et historique potentiellement sensible.
8. Sauvegardes DB trop permissives et sauvegardes médias absentes/non démontrées.

Nombre d’écarts bloquants : **8**.

## Verdict

**VPS NON PRÊT** — le dépôt contient les remédiations, mais elles ne sont pas déployées sur l’infrastructure réelle auditée.
