# VPS-05 — Restauration réelle DB + médias hors production

Date : 2026-09-21. Opérateur : Claude (reprise après la campagne Codex). Aucune écriture sur le VPS ; aucune base de production touchée.

## Sources

Sauvegardes produites par `deploy/deploy.sh` lors du premier déploiement traçable (release `20260921-073416Z-180496abbbf6-cress`, voir [110](110-first-traceable-deploy.md)) :

| Fichier (bazixx-vps, `/var/backups/cress/`) | Taille | SHA-256 |
|---|---|---|
| `cress_pilote-20260921-073416.dump` (`pg_dump -Fc`) | 434 793 o | `e3a2ae3c…5e0f73` |
| `cress-medias-20260921-073416.tar.gz` | 4 331 o | `cf268aa9…2ff4653` |

Rapatriés par `scp` en lecture seule ; empreintes SHA-256 identiques entre le VPS et la copie locale.

## Restauration

Environnement : Mac de développement, PostgreSQL 16 local, base jetable `cress_restore_test` (propriétaire `pilote`, sans superuser), médias extraits dans un dossier de travail temporaire.

| Étape | Résultat |
|---|---|
| `pg_restore --list` | 63 entrées `TABLE DATA` |
| `pg_restore --no-owner --role=pilote -d cress_restore_test` | exit 0, sans erreur |
| `_prisma_migrations` | 17 migrations, dernière `20260919055004_brevo_ignored` = état de `main` déployé |
| Comptages | Person 15 · Attachment 63 · Convention 3 · Call 8 · Payment 103 · Session 3 |
| `tar -xzf` médias | 63 fichiers PDF (1 page, PDF 1.4), propriétaire d'origine `pilote-cress`, modes `0640/0750` conservés |

## Cohérence base ↔ fichiers

- `Attachment.storedName` (63) ↔ fichiers extraits (63) : **0 ligne sans fichier, 0 fichier orphelin**.
- `Attachment.size` ↔ taille réelle sur disque : **63/63 identiques**.

## Migration suivante rejouée sur les données restaurées

La branche `feat/appels-dossiers` porte la migration `20260919125609_call_description_convention_helpers` (renommage `Call.note` → `description`, repli de `amountHint` dans la description, table `ConventionHelper`). `prisma migrate deploy` appliqué sur `cress_restore_test` : succès ; les 8 appels ont conservé leur texte, les 8 montants indicatifs sont repliés (« Montant indicatif : … »), aucune ligne perdue. C'est le scénario exact du prochain déploiement.

## Application démarrée sur la restauration

Build de production dédié (`.next-restore`), `next start --hostname 127.0.0.1 -p 3300`, `NODE_ENV=production`, `PILOTE_DEMO=0`, profil `security-test`, `UPLOAD_DIR` pointant sur les médias restaurés.

| Requête sans session | Attendu | Observé |
|---|---|---|
| `GET /connexion` | 200 | 200 |
| `GET /api/health` | 401 | 401 |
| `GET /api/pieces/<id restauré>` | 401 | 401 |
| `GET /appels` | redirection connexion | 307 → `/connexion?suite=%2Fappels` |

## Limites

- L'ouverture **authentifiée** d'une pièce jointe dans l'interface n'a pas été rejouée (pas de session ouverte sur la copie restaurée) ; la cohérence fichier ↔ base est démontrée au niveau système et la route reste correctement gardée.
- La restauration a été faite sur une machine de développement, pas sur le VPS : la procédure VPS (arrêt du service, `pg_restore` dans une base neuve, remise des médias, bascule) reste celle décrite dans [SEC-26](26-sec-26-backup-rollback.md).
- Les anciens dumps du 17–18/09 dans `/var/backups/cress/` sont encore en mode `0644` (antérieurs à SEC-26) ; à resserrer ou purger lors d'un prochain passage sur le VPS.

## Verdict

**VPS-05 PASS** — une sauvegarde produite par le déploiement se restaure intégralement (base + médias), sans perte ni incohérence, et supporte la migration suivante.
