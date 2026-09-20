# SEC-24 / PROD-08 — Configuration HTTP et profil local

## Cause racine

`lib/auth.ts` déduisait auparavant le caractère local de `BETTER_AUTH_URL` avec `startsWith("http://")`. Toute URL HTTP pouvait donc désactiver les cookies Secure et rendre `AUTH_RATE_LIMIT=0` acceptable dans certains cas.

## Politique retenue

Le profil est désormais explicite via `PILOTE_ENV_PROFILE` (`local`, `test` ou `security-test`) et l’hôte doit être `localhost`, `127.0.0.1` ou `::1`. Le seul protocole HTTP accepté est donc celui d’un profil explicitement local sur loopback.

En production sans profil de recette :

- `BETTER_AUTH_URL` doit être une URL absolue HTTPS ;
- `AUTH_RATE_LIMIT=0` provoque une erreur de démarrage ;
- `PILOTE_DEMO=1` reste refusé par SEC-20 ;
- `useSecureCookies` reste activé.

Une URL `http://example.com` n’est jamais assimilée à du local. Les profils de test configurent explicitement `PILOTE_ENV_PROFILE=security-test`, ce qui conserve le harness HTTP loopback et son rate limit de recette.

## Tests et fichiers

Les tests de configuration couvrent : production HTTP refusée, production HTTPS acceptée, `AUTH_RATE_LIMIT=0` refusé, et profil `security-test` HTTP loopback accepté. Les tests unitaires passent à 28/28.

Fichiers modifiés : `lib/auth.ts`, `playwright.security.config.ts`, `tests/unit/demo-production.test.ts`, ce rapport.

Validations : lint PASS, TypeScript PASS, build production PASS, suite sécurité production-like 33/33.

## Limites

La configuration effective du VPS doit conserver une URL HTTPS et ne doit pas définir un profil local. Les cookies et le rate limit sont validés au chargement de l’authentification ; aucune modification de Better Auth ou de politique SameSite n’a été introduite.

## Verdict

**SEC-24 CORRIGÉ**.
