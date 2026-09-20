# SEC-22 / PROD-07 — Écoute loopback de Next

## Cause racine

Le service systemd définissait `HOSTNAME=127.0.0.1`, mais lançait `npm run start` sans option `--hostname`. La liaison dépendait donc d'un comportement implicite de Next.

## Correction

Le script `start` de `package.json` lance désormais :

`NEXT_DIST_DIR=.next-build next start --hostname 127.0.0.1`

Le service systemd conserve le port fourni par l'instance et son `HOSTNAME=127.0.0.1`. Les ports n'ont pas changé.

## Observation runtime

Avec Next 15.5.25, le processus corrigé a été démarré sur le port isolé 3211. `netstat` a confirmé : `127.0.0.1.3211 LISTEN`. Aucune écoute `0.0.0.0:3211` ou `[::]:3211` n'a été observée.

La comparaison « avant » est établie par la configuration : `next start` sans `--hostname` ne rendait pas la contrainte explicite ; elle n'a pas été lancée sur une instance de production.

## Proxy Nginx

Les deux configurations d'instance utilisent exclusivement :

- CRESS : `proxy_pass http://127.0.0.1:3002` ;
- TLST : `proxy_pass http://127.0.0.1:3003`.

Aucun changement Nginx ou de port n'a été nécessaire. L'état du pare-feu système reste hors périmètre et doit être vérifié séparément.

## Validation

- Tests unitaires/configuration : **17/17 PASS**, dont la présence explicite de `--hostname 127.0.0.1` et les proxy Nginx loopback.
- `npm run test:security` : **33/33 PASS**.
- `npm run lint` : **PASS**.
- `npx tsc --noEmit` : **PASS**.
- `npm run build` : **PASS**.
- Validation runtime loopback : **PASS**.

## Fichiers modifiés

- `package.json`
- `deploy/systemd/pilote@.service` (commentaire de contrainte)
- `tests/unit/loopback-start.test.ts`
- `docs/remediation/22-sec-22-loopback-next.md`

## Verdict

**SEC-22 CORRIGÉ**

