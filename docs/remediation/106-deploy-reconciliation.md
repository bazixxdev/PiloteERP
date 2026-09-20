# Réconciliation du prochain déploiement

Date : 2026-09-20  
Périmètre : comparaison documentaire de `deploy/deploy.sh` avec l’état VPS-01 à VPS-03 validé. Aucun déploiement réel n’a été lancé.

## Écart identifié

L’écart documenté dans [README.md](README.md) et [104-vps-unix-systemd.md](104-vps-unix-systemd.md) était réel : après la bascule, `deploy.sh` exécutait :

```bash
chown -R "$RUNTIME_USER:$RUNTIME_USER" "$DIR" "$DATA" "$MEDIAS"
```

Cela rendait toute la release, y compris le code, propriété de l’utilisateur runtime et pouvait annuler la politique VPS-03 `root:root` + code non inscriptible. Le script ne vérifiait pas non plus explicitement que l’unité existante était encore durcie, ni que l’environnement conservait toutes les invariantes de production.

## Correction appliquée

`deploy.sh` a été corrigé uniquement sur ces points :

- production fail-fast : `NODE_ENV=production`, `PILOTE_DEMO=0`, `BETTER_AUTH_URL` HTTPS, `AUTH_RATE_LIMIT` non nul et aucun profil `local`, `test` ou `security-test` ;
- validation de l’unité systemd : utilisateurs dédiés, `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, `ProtectHome`, `UMask=0077` et `ReadWritePaths` limités aux data/médias ;
- release après bascule : `root:root`, répertoires lisibles/exécutables mais non inscriptibles par le runtime, modes de fichiers existants conservés hors suppression de l’écriture groupe/autres ;
- `.env` : ownership de l’instance et `0600` ;
- data/médias : ownership de l’instance, répertoires `0750`, fichiers `0640` ;
- les étapes existantes restent dans l’ordre build → dump DB validé → archive médias validée → migration → seed explicite éventuel → démarrage/healthcheck.

Le script n’écrase pas une unité systemd existante : il la valide et échoue si elle n’est pas conforme. Il conserve donc le hardening installé manuellement sur le VPS au lieu de le remplacer silencieusement.

## Vérification par exigence

| Exigence du prochain déploiement | Résultat |
|---|---|
| conserver `PILOTE_DEMO=0` | PASS : `1` est refusé, absence complétée par `0` |
| utiliser `pilote-cress` / `pilote-tlst` | PASS : `RUNTIME_USER=pilote-$INSTANCE`, compte exigé |
| ne pas rendre le code runtime inscriptible | PASS : release `root:root`, `go-w` retiré |
| conserver `.env` sécurisé | PASS : owner instance, `0600` |
| conserver uploads isolés | PASS : owner instance, data/médias `0750`, fichiers `0640` |
| lancer Next sur loopback | PASS : package déployé + unité validée ; le script `start` porte `--hostname 127.0.0.1` |
| backup DB + médias avant migration | PASS : dump non vide + `pg_restore --list`, archive médias non vide |
| construire avant migration | PASS : build ligne 110, migration ligne 124 |
| rester compatible systemd hardening | PASS : unité existante contrôlée, nouvelle unité issue du dépôt si absente |
| ne pas détruire les corrections VPS manuelles | PASS : unité existante non remplacée, ownership code restauré root-owned |

## Simulation et tests

Sans toucher au VPS :

- `bash -n deploy/deploy.sh` : PASS ;
- test ciblé `tests/unit/deploy-backup.test.ts` : **5/5 PASS** ;
- ordre statique vérifié : build ligne 110, backup DB ligne 111, migration ligne 124 ;
- présence statique vérifiée pour les garde-fous production, ownership root-owned, permissions `.env`/data/médias et protections systemd ;
- aucun `deploy/deploy.sh <instance>` n’a été exécuté.

Les backups, migrations, build distant et healthcheck restent volontairement non exécutés dans cette réconciliation ; ils sont conservés dans le flux réel du script et devront être observés lors du prochain déploiement planifié.

## Fichiers modifiés

- `deploy/deploy.sh`
- `tests/unit/deploy-backup.test.ts`
- `docs/remediation/106-deploy-reconciliation.md`

## Conclusion

Le défaut identifié est corrigé dans le script et couvert par des tests statiques ciblés. Le prochain déploiement est conçu pour préserver l’état VPS-01 à VPS-03 ; VPS-04 et les rotations de secrets restent hors périmètre.
