# SEC-26 / PROD-05 — Sauvegarde, restauration et rollback

## Workflow avant correction

Le script installait les dépendances, exécutait `pg_dump ... || true`, appliquait les migrations, seedait éventuellement la base, construisait ensuite l'application, puis basculait le répertoire et redémarrait le service. Un échec de sauvegarde pouvait donc être ignoré ; le rollback existant restaurait principalement le répertoire de code.

## Workflow après correction

1. Copier la release dans le répertoire voisin.
2. Installer les dépendances.
3. Construire la release ; un échec empêche toute migration.
4. Créer un dump PostgreSQL temporaire.
5. Exiger un fichier non vide et valider son contenu avec `pg_restore --list`.
6. Le renommer atomiquement dans `BACKUP_DIR`, mode `0600`.
7. Archiver `MEDIAS` dans une archive horodatée, non vide, mode `0600`.
8. Appliquer les migrations.
9. Effectuer un seed uniquement lorsqu'il est explicitement demandé.
10. Basculer, redémarrer et vérifier le healthcheck.

Un échec de `pg_dump`, de validation, d'archive médias, de build ou de migration arrête le script avant la bascule. Les anciennes sauvegardes ne sont pas supprimées par cette étape.

## Restauration testée

Sur PostgreSQL local isolé, le dump custom de `pilote_test_harness` a été restauré dans une base distincte `sec26_restore`. La requête sentinelle `count(Person)` a retourné **15**, et la base de restauration a ensuite été supprimée. Aucune base de production n'a été touchée.

## Rollback

- **Cas code seul :** possible uniquement si la migration est rétrocompatible et que l'ancienne release supporte le schéma courant.
- **Cas migration incompatible :** le rollback code seul est interdit ; arrêter le service et restaurer le dump PostgreSQL validé, puis l'archive médias correspondante, avant de remettre l'ancienne release.
- Le script actuel conserve une procédure de retour du répertoire après échec du healthcheck, mais ne restaure pas automatiquement la base. Cette limite est volontaire : une restauration DB aveugle peut écraser des écritures post-migration.

Les futures migrations doivent suivre expand/contract : ajout compatible, déploiement code, migration de données, puis suppression dans une release ultérieure.

## Uploads et permissions

PostgreSQL ne contient pas les fichiers de `UPLOAD_DIR`. Le déploiement archive désormais séparément le répertoire médias ; cette archive doit être restaurée avec le dump pour un état complet. Les sauvegardes vivent dans `BACKUP_DIR`, hors racine web, mode `0600`, avec ownership de l'instance/opérateur selon SEC-21.

## Tests

- Tests de configuration du script : **21/21 unitaires PASS**.
- Test réel dump/restore PostgreSQL isolé : **PASS**.
- `bash -n deploy/deploy.sh` : **PASS**.
- `npm run test:security` : **33/33 PASS**.
- `npm run lint` : **PASS**.
- `npx tsc --noEmit` : **PASS**.
- `npm run build` : **PASS**.

## Procédure VPS

Avant : vérifier espace disque, accès PostgreSQL et destination de sauvegarde ; ne jamais poursuivre si le dump ou sa validation échoue. Pendant : build, dump/validation, archive médias, migration, bascule et redémarrage. Après : readiness, smoke test, logs et migrations appliquées. En cas d'échec post-migration, appliquer la procédure code+DB documentée et ne pas lancer de rollback automatique sans qualification de compatibilité.

## Limites

La restauration complète n'a pas été exécutée sur le VPS réel. Les migrations historiques ne sont pas reclassées automatiquement comme expand/contract. La restauration et le rollback restent opérés manuellement pour les migrations incompatibles.

## Verdict

**SEC-26 CORRIGÉ CÔTÉ OUTILLAGE**

