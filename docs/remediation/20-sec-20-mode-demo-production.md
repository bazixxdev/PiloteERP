# SEC-20 / PROD-01 — Mode démonstration en production

## Cause racine

`deploy/deploy.sh` ajoutait `PILOTE_DEMO=1` lorsqu'il manquait dans le `.env` serveur. Le seed était aussi lancé automatiquement lorsque la base était vide. `lib/session.ts` active alors le changement d'utilisateur dès qu'une session existe.

## Politique appliquée

- Production avec `PILOTE_DEMO=1` : démarrage applicatif et déploiement refusés.
- Production avec `PILOTE_DEMO=0` : autorisée, sans mode démo.
- Configuration absente dans le déploiement : le script écrit explicitement `PILOTE_DEMO=0`.
- Test/développement : `PILOTE_DEMO=1` reste disponible uniquement lorsqu'il est explicitement défini par les profils Playwright/dev.

## Corrections

`lib/auth.ts` lève une erreur explicite au démarrage d'une production configurée avec `PILOTE_DEMO=1`. La garde est ignorée pendant `next build` afin de ne pas confondre compilation et démarrage ; le service systemd est le point d'exécution production.

`deploy/deploy.sh` refuse un `.env` existant avec `PILOTE_DEMO=1`, n'ajoute plus cette valeur par défaut et écrit `PILOTE_DEMO=0` lorsqu'elle est absente. Une base vide n'est plus seedée implicitement : un `--seed` explicite est requis. Le seed explicite reste une opération d'opérateur et doit être réservé aux bases de recette.

## Validation

- Test configuration production + démo : **refus**.
- Test configuration production + `PILOTE_DEMO=0` : **autorisé sans mode démo**.
- Tests unitaires : **15/15 PASS**.
- `npm run test:security` : **33/33 PASS**, harness avec `PILOTE_DEMO=0`.
- `npm run lint` : **PASS**.
- `npx tsc --noEmit` : **PASS**.
- `npm run build` : **PASS**.

La combinaison production + variable absente est neutralisée par le déploiement, qui pose `PILOTE_DEMO=0`; l'absence ne peut donc plus activer implicitement le mode démo. Les profils historiques Playwright gardent leur `PILOTE_DEMO=1` explicite.

## Limites restantes

Le seed explicite `deploy.sh --seed` peut encore créer des comptes de démonstration si un opérateur le demande volontairement ; il n'est plus automatique. La séparation complète bootstrap métier / fixtures et une politique de déploiement plus large restent hors SEC-20.

## Verdict

**SEC-20 CORRIGÉ**

