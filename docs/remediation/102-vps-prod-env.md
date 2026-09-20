# VPS-01 — Mise en conformité environnement production

Date : 2026-09-20  
Hôte : `srv771239`  
Périmètre : variables de production, désactivation du mode démo, sauvegardes préalables et redémarrage contrôlé.

## Limites respectées

Ce lot n’a modifié ni firewall, ni Nginx, ni isolation Unix, ni utilisateurs système, ni ownership global, ni ports réseau, ni tokens. Aucun seed, migration ou restauration n’a été lancé.

## Point de retour

Répertoire : `/var/backups/pilote-vps01/20260920-193012/`

- dumps PostgreSQL : `db/cress.dump` et `db/tlst.dump`, non vides, permissions `0600` ;
- archives médias : `media/cress-medias.tar.gz` et `media/tlst-medias.tar.gz`, non vides, permissions `0600` ;
- configuration : environnements, unité systemd, sortie de configuration Nginx et états de services avant modification, permissions restrictives.

Les sauvegardes DB et médias ont été contrôlées avant toute modification. Les sauvegardes existantes n’ont pas été supprimées.

| Contrôle | État |
|---|---|
| Backup DB CRESS | PASS |
| Backup DB TLST | PASS |
| Backup médias CRESS | PASS |
| Backup médias TLST | PASS |
| Backup configuration | PASS |
| Rollback configuration | Disponible via les `.env` sauvegardés |

## Variables avant / après

Les valeurs secrètes et URLs complètes ne sont pas reproduites.

| Instance | Variable | Avant | Après |
|---|---|---|---|
| CRESS | `NODE_ENV` | production via systemd | `production` |
| CRESS | `PILOTE_DEMO` | `1` | `0` |
| CRESS | `BETTER_AUTH_URL` | HTTPS présente | HTTPS conforme (`https://…`) |
| CRESS | `AUTH_RATE_LIMIT` | absente | présente et non nulle |
| CRESS | profil local/test/security-test | absent | absent |
| CRESS | `PORT` | présente (`3002`) | inchangée |
| TLST | `NODE_ENV` | production via systemd | `production` |
| TLST | `PILOTE_DEMO` | `1` | `0` |
| TLST | `BETTER_AUTH_URL` | HTTPS présente | HTTPS conforme (`https://…`) |
| TLST | `AUTH_RATE_LIMIT` | absente | présente et non nulle |
| TLST | profil local/test/security-test | absent | absent |
| TLST | `PORT` | présente (`3003`) | inchangée |

Toutes les autres variables ont été conservées. Aucun secret, `DATABASE_URL` ou token n’a été régénéré ou modifié.

## Vérifications avant redémarrage

- syntaxe et présence des variables contrôlées sans afficher les valeurs sensibles ;
- `NODE_ENV=production` confirmé pour les deux instances ;
- `PILOTE_DEMO=0` confirmé pour les deux instances ;
- `BETTER_AUTH_URL` HTTPS confirmée ;
- `AUTH_RATE_LIMIT` présent et non nul ;
- aucun profil `local`, `test` ou `security-test` actif.

## Redémarrage contrôlé

### CRESS

- `pilote@cress.service` : restart PASS ;
- état systemd : active/running ;
- erreurs immédiates significatives : aucune ;
- smoke test HTTPS racine : HTTP `302` ;
- smoke test HTTPS `/connexion` : HTTP `401` (réponse applicative protégée, service joignable).

### TLST

- `pilote@tlst.service` : restart PASS ;
- état systemd : active/running ;
- erreurs immédiates significatives : aucune ;
- smoke test HTTPS racine : HTTP `302` ;
- smoke test HTTPS `/connexion` : HTTP `401` (réponse applicative protégée, service joignable).

Les journaux immédiats ne montrent ni erreur DB, ni erreur Better Auth, ni seed, ni activation du mode démo. Aucun test de login avec compte réel n’a été exécuté dans ce lot.

## Anomalies rencontrées

Aucune anomalie bloquante pendant ce lot. Les écarts hors périmètre restent inchangés : isolation Unix, hardening systemd, loopback Next, firewall et redaction Nginx.

## Verdict

**LOT VPS-01 CONFORME — variables de production corrigées, mode démo désactivé et deux redémarrages validés.**
