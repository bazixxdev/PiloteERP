# Stabilisation du test harness

## 1. Cause exacte du P2022

`Call.note` n’est pas obsolète dans le dépôt : le champ existe dans `prisma/schema.prisma` et dans la migration initiale `20260917000000_initial_postgres/migration.sql`. Le seed `prisma/seeds/cress.ts` l’utilise donc correctement.

Le problème venait de `tests/global-setup.ts`, qui lançait `prisma db seed` sans appliquer lui-même les migrations. Lorsque le serveur Playwright était réutilisé, ou lorsqu’un `BASE_URL` externe était fourni, aucune migration ne garantissait que la base de test correspondait au schéma courant. Le seed s’exécutait alors contre une base ancienne, d’où `P2022: Call.note does not exist`.

## 2. Correction appliquée

Le global setup historique exécute désormais `npx prisma migrate deploy` juste avant le seed. Le setup est ainsi autonome et reproductible, indépendamment du mode de démarrage du serveur Playwright.

## 3. Fichiers modifiés

- `tests/global-setup.ts`
- `docs/remediation/08-test-harness-stabilisation.md`

Aucune règle métier, vulnérabilité applicative ou migration n’a été modifiée.

## 4. Validation depuis une base vide

Sur une base PostgreSQL dédiée `pilote_test_harness` :

1. création de la base ;
2. application des 17 migrations ;
3. génération Prisma ;
4. seed complet : **OK** (`15 personnes, 22 projets, 52 éditions`).

Le premier essai a également révélé que le rôle PostgreSQL local n’avait pas les droits sur le schéma `public`; ce droit d’environnement a été accordé à la base jetable, sans modification du dépôt.

## 5. Suite historique

La tentative précédente de suite Playwright était bloquée au seed par `Call.note`. Après correction du setup, la base vierge et le seed passent. L’exécution complète du global setup nécessite toutefois un serveur Next démarré et une base de recette configurée pour la connexion HTTP ; elle n’a pas été déclarée comme réussite sans cette étape.

Les tests historiques pièces jointes, validations et conventions n’ont donc pas encore produit de résultat fonctionnel complet dans cette session. Aucun échec applicatif n’a été attribué à SEC-07.

## 6. Couverture SEC-05/06/07

La couverture automatisée disponible est actuellement unitaire :

- SEC-05 : `tests/unit/validation-level.test.ts` couvre les niveaux invalides et le niveau 0 ;
- SEC-06 : `tests/unit/proposals-permission.test.ts` couvre `budgetEnvelope`, `spent` et un champ ordinaire ;
- SEC-07 : `tests/unit/attachment-coherence.test.ts` couvre les parents appartenant à A/B et les conventions incohérentes.

Il n’existe toujours pas de specs Playwright production-like dédiées SEC-05/06/07. Leur ajout intégration avec sessions distinctes reste ouvert ; les tests unitaires existants n’ont pas été dupliqués.

## 7. Baseline finale

- migrations depuis zéro : **OK** ;
- seed depuis zéro : **OK** ;
- global setup historique : **non confirmé de bout en bout** (serveur/session HTTP à exécuter) ;
- tests unitaires : **12/12** ;
- tests sécurité : **non exécutables sans base/serveur production-like dédiés** ;
- tests historiques : **non confirmés**, faute de global setup complet ;
- lint : **OK** ;
- TypeScript : **OK** ;
- build production : **OK**.

Les points encore ouverts relèvent de la mise en place de l’exécution Playwright production-like et de l’ajout des specs d’intégration SEC-05/06/07, pas d’une régression introduite par la correction du harness.

## 8. Exécution production-like finale

Une commande reproductible a été ajoutée :

```bash
SECURITY_DATABASE_URL='postgresql://pilote:pilote@localhost:5432/pilote_security_local' \
SECURITY_BASE_URL='http://localhost:3200' \
SECURITY_TEST_PASSWORD='security-test-password-2026' \
npm run test:security
```

Elle démarre automatiquement un build/serveur Next dédié en `PILOTE_DEMO=0`, exécute migrations + seed dans le global setup sécurité, crée les sessions séparées et lance les specs disponibles.

Résultat : **31/31 tests sécurité passés** (SEC-01 à SEC-04 et SEC-03B). Le serveur production-like et les sessions réelles sont donc opérationnels.

## 9. Suite historique ciblée

Après passage du global setup historique à `prisma migrate reset --force --skip-seed`, les bases Chromium et TLST sont recréées depuis zéro. Les tests ciblés ont donné **6/6 réussis** : conventions, validations, demandes et pièces jointes.

Les tests d’intégration dédiés SEC-05/06/07 avec mutation directe de Server Actions et assertions PostgreSQL ne sont pas encore présents. Les couvertures existantes restent : tests unitaires SEC-05/06/07, plus les tests historiques de validation et pièces jointes. Aucun échec n’a été introduit par la stabilisation du harness.
