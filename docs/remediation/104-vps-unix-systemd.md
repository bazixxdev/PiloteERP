# VPS-03 — Isolation Unix réelle et durcissement systemd

Date : 2026-09-20  
Hôte : `srv771239`

## Périmètre

Ce lot a traité les identités Unix, l’ownership/modes CRESS/TLST et le durcissement effectif de `pilote@.service`. Nginx/log redaction, tokens, DB et sauvegardes n’ont pas été modifiés.

## État avant

- `pilote@cress.service` et `pilote@tlst.service` utilisaient `www-data:www-data` ;
- `NoNewPrivileges=no`, `PrivateTmp=no`, `ProtectSystem=no`, `ProtectHome=no`, `UMask=0022` ;
- code, `.env`, data et médias appartenaient à `www-data` ;
- `.env` était en `0644` ; data/médias étaient en `0755` ;
- Next tournait sous `www-data` ;
- aucun répertoire `current` n’était présent ;
- les chemins d’écriture persistants identifiés sont `...-pilote-data` et `...-pilote-medias`.

Une copie de l’unité active et des états précédents a été conservée sous `/var/backups/pilote-vps03-20260920-194906/`.

## Identités créées

| Identité | UID | GID | Home | Shell |
|---|---:|---:|---|---|
| `pilote-cress` | 997 | 986 | `/nonexistent` | `/usr/sbin/nologin` |
| `pilote-tlst` | 995 | 985 | `/nonexistent` | `/usr/sbin/nologin` |

`www-data` n’a pas été supprimé.

## Ownership et permissions finales

| Élément | CRESS | TLST |
|---|---|---|
| code/release | `root:root`, répertoires `755`, fichiers non inscriptibles par runtime | idem |
| `.env` | `pilote-cress:pilote-cress`, `600` | `pilote-tlst:pilote-tlst`, `600` |
| data runtime | `pilote-cress:pilote-cress`, `750` | `pilote-tlst:pilote-tlst`, `750` |
| uploads/médias | `pilote-cress:pilote-cress`, `750` | `pilote-tlst:pilote-tlst`, `750` |
| log applicatif | `root:root`, `644`, ouverture conservée par le service manager | idem |

Les répertoires data/médias sont les seuls chemins déclarés inscriptibles dans systemd. Le code et `.next-build` sont protégés en lecture seule au runtime.

## Tests d’isolation

Avant et après systemd, les tests `runuser` ont confirmé :

- chaque identité lit son propre `.env` et son propre code ;
- chaque identité crée puis supprime une sentinelle dans ses propres médias ;
- chaque identité ne peut pas lire le `.env` de l’autre instance ;
- chaque identité ne peut pas écrire dans les médias de l’autre instance ;
- chaque identité ne peut pas créer de fichier dans son propre code.

Aucun contenu de secret n’a été affiché.

## Unité systemd effective

Après `daemon-reload`, `systemctl show` confirme réellement :

| Propriété | CRESS | TLST |
|---|---|---|
| `User` | `pilote-cress` | `pilote-tlst` |
| `Group` | `pilote-cress` | `pilote-tlst` |
| `NoNewPrivileges` | `yes` | `yes` |
| `PrivateTmp` | `yes` | `yes` |
| `ProtectSystem` | `strict` | `strict` |
| `ProtectHome` | `yes` | `yes` |
| `ReadWritePaths` | `/var/www/cress-pilote-data /var/www/cress-pilote-medias` | `/var/www/tlst-pilote-data /var/www/tlst-pilote-medias` |
| `UMask` | `0077` | `0077` |

`ExecStart=/usr/bin/npm run start` conserve le script applicatif qui lance Next avec `--hostname 127.0.0.1`. Les fichiers `.env` et ports d’instance sont conservés.

## Redémarrages et validation runtime

### CRESS

- restart : PASS ;
- processus Next : `pilote-cress` ;
- écoute : `127.0.0.1:3002` ;
- HTTPS : `302` sur la racine ;
- erreurs récentes DB/Better Auth/permission : aucune détectée.

### TLST

- restart : PASS ;
- processus Next : `pilote-tlst` ;
- écoute : `127.0.0.1:3003` ;
- HTTPS : `302` sur la racine ;
- erreurs récentes DB/Better Auth/permission : aucune détectée.

Smoke tests finaux : racine HTTPS `302` et `/connexion` `401` pour chaque instance, réponses applicatives attendues.

## Compatibilité deploy.sh

`bash -n deploy/deploy.sh` passe et la validation statique confirme l’usage de `RUNTIME_USER=pilote-$INSTANCE`, le contrôle préalable de l’existence du compte, les chemins data/médias et `.env`.

Anomalie à traiter dans un lot ultérieur : le script contient encore `chown -R "$RUNTIME_USER:$RUNTIME_USER" "$DIR" "$DATA" "$MEDIAS"`, ce qui réattribuerait le code au runtime lors d’un futur déploiement. Aucun nouveau déploiement n’a été lancé et aucune modification de ce script n’a été faite dans VPS-03.

## Rollback

Rollback disponible avant modification : ancienne unité conservée, ownership précédent connu (`www-data`), procédure de restauration préparée par instance. Aucun rollback n’a été utilisé.

## Verdict

**VPS-03 CONFORME** — isolation Unix effective, secrets et médias séparés, code non inscriptible par le runtime, durcissement systemd chargé et deux instances fonctionnelles.
