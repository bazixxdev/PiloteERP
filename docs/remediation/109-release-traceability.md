# Traçabilité des releases

## Problème initial

Le déploiement utilisait des répertoires fixes (`/var/www/<instance>-pilote`) et des suffixes temporaires, sans manifeste permettant d’identifier de façon fiable le commit, l’instance, la date de déploiement ou la release précédente.

## Modèle retenu

Avant toute copie, `deploy.sh` récupère `git rev-parse HEAD`, vérifie que le commit existe et refuse tout working tree dirty, y compris les fichiers non suivis. Le code construit correspond donc à un état Git reproductible.

Chaque release active contient un fichier root-owned en mode `0444` :

```json
{
  "instance": "cress",
  "commit": "<sha complet>",
  "commit_short": "<sha court>",
  "deployed_at": "<date ISO UTC>",
  "release": "<identifiant UTC-commit-instance>",
  "previous_release": "<identifiant précédent ou none>",
  "branch": "<branche ou detached>"
}
```

Le manifeste ne contient ni secret, ni token, ni URL de base de données.

## Identification

Sur le VPS, après déploiement :

```sh
cat /var/www/cress-pilote/.release.json
cat /var/www/tlst-pilote/.release.json
```

Le champ `release` identifie la release active et `previous_release` identifie la release remplacée.

## Rollback

La release précédente est conservée sous un suffixe horodaté `.previous`. En cas d’échec du healthcheck, le script journalise le passage de la release courante vers la release précédente ; le manifeste de cette dernière reste inchangé et conserve son propre commit.

## Validation

- tests unitaires du mécanisme de déploiement : capture du commit, refus du dirty tree, manifeste, champs requis, absence de secrets et rollback traçable ;
- `bash -n deploy/deploy.sh` ;
- `git diff --check` ;
- tests unitaires, lint, TypeScript et build à exécuter avant le déploiement.

Aucun déploiement VPS n’est effectué pendant cette phase.
