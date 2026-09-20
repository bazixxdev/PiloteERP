# Suite d’intégration sécurité SEC-05 à SEC-07

## Résultat

Le harness production-like est désormais lançable par `npm run test:security`. Il recrée les bases de test historiques, applique les migrations, seed, démarre Next et crée les sessions sécurité.

- Suite sécurité disponible : **31/31 réussis** (SEC-01 à SEC-04 et SEC-03B).
- Tests historiques ciblés : **6/6 réussis** (conventions, validations, demandes, pièces jointes).
- Tests unitaires : **12/12 réussis**.
- Lint, TypeScript et build : **OK**.

## SEC-05, SEC-06 et SEC-07

Les tests unitaires dédiés restent présents :

- `tests/unit/validation-level.test.ts` ;
- `tests/unit/proposals-permission.test.ts` ;
- `tests/unit/attachment-coherence.test.ts`.

Les trois scénarios d’intégration demandés avec invocation directe des Server Actions, sessions distinctes et assertions PostgreSQL ne sont pas encore ajoutés. Les Server Actions ne constituent pas des routes HTTP stables et leurs identifiants Next sont générés au build ; le harness possède un helper générique (`postServerAction`) mais pas encore de résolution contrôlée des références pour ces trois actions.

Aucun correctif applicatif supplémentaire n’a été effectué et aucune régression n’a été découverte.

## Commande

```bash
SECURITY_DATABASE_URL='postgresql://pilote:pilote@localhost:5432/pilote_security_local' \
SECURITY_BASE_URL='http://localhost:3200' \
SECURITY_TEST_PASSWORD='security-test-password-2026' \
npm run test:security
```

