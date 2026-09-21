# Tests et recette

Trois suites, chacune sur sa base locale jetable, jamais sur une base de production.

## Quand lire ce fichier

- Avant tout commit ; en écrivant un test ; quand une suite est rouge ; en touchant `playwright*.config.ts`, `tests/global-setup.ts`, `tests/security/global-setup.ts`, les seeds.

## Les suites

| Commande | Quoi | Base | Durée |
|---|---|---|---|
| `npm run check` | vocab + unitaires (`tests/unit/*.test.ts`, node:test) + lint + tsc | aucune (sauf 2 unitaires sur `pilote_test_harness`) | ≈ 1 min |
| `npm test` | recette Playwright (`tests/*.spec.ts`), serveur `next start` port 3100, profil `test` | `pilote_test`, `pilote_test_tlst` | ≈ 6 min |
| `npm run test:security` | suite production-like `tests/security/`, port 3200, profil `security-test`, démo désactivée | `pilote_security_local` | ≈ 1 min |
| `npm run check:full` | tout ce qui précède + `npm run build` | | ≈ 10 min |

## Règles

- **CRITICAL** — `npm run check` vert avant chaque commit ; `npm run check:full` vert avant chaque déploiement. Une campagne entière de sécurité a livré une recette cassée parce que `npm test` n'avait pas été rejoué : ne plus jamais supposer qu'une suite passe.
- **NEVER** affaiblir une garde pour faire passer un test. Si un test historique contredit une garde nouvelle, décider **laquelle** a raison, l'écrire dans le commit, et corriger l'autre.
- **NEVER** figer une date ou une semaine relative au présent dans un test (`2026-W37`, « 41,25 h » d'une semaine paire) : calculer depuis `dayjs()` (`isoWeek() % 2`, `subtract(1, "week")`). Les dates fixes ne sont permises que pour des faits fixes du seed (`thomasMissedDay = 2026-08-20`, mois verrouillé `2026-07`).
- **NEVER** committer un artefact généré par une suite : `uploads-*`, `tests/.auth`, `tests/.security-*`, `test-results`, `.next-*` sont ignorés ; une sentinelle vérifie que `git ls-files` n'en retourne aucun.
- **ALWAYS** pour un bug : un test de non-régression au niveau le plus bas qui le reproduit (unitaire sur un helper pur > sécurité HTTP > recette navigateur).
- **ALWAYS** pour une feature qui touche aux données : un test de permission (le bon rôle passe) **et** un test négatif (le mauvais rôle, l'anonyme, l'autre pôle est refusé). Les invariants métier vivent dans un helper pur (`lib/…`) testé en unitaire.
- Les recettes tournent en `NODE_ENV=production` avec `PILOTE_DEMO=1` : c'est permis **uniquement** par le profil explicite `PILOTE_ENV_PROFILE=test` + hôte loopback (`lib/auth.ts`, SEC-20). Ne pas contourner autrement.
- `prisma migrate reset --force` est lancé par le globalSetup sur `pilote_test` : un agent doit obtenir l'accord explicite de Gaël et le passer dans `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.
- Playwright ne ramasse que `*.spec.ts` hors `tests/security/` (`testMatch` / `testIgnore`, vérifiés par sentinelle). Un test unitaire est un `*.test.ts` dans `tests/unit/`.
- Itération rapide : `PW_DEV=1 npx playwright test tests/x.spec.ts` réutilise le serveur de dev ; `--project chromium` évite le build TLST.

## Sentinelles (`tests/unit/guardrails.test.ts`)

Elles encodent `securite-autorisation.md` : liste figée des champs `saveField`, garde d'accès dans chaque `route.ts`, `getCurrentPerson` dans chaque fichier d'actions, config Playwright, artefacts hors git. Quand l'une casse : lire la règle citée dans le message, décider, puis seulement mettre à jour la sentinelle.
