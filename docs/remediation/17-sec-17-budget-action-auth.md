# SEC-17 — Authentification des Server Actions budgétaires

## Verdict avant correction

**SEC-17 CONFIRMÉ** par inspection du code : `explainRequiredLevel` et `computeRequiredLevel` ne chargeaient aucune session et pouvaient calculer un niveau et une raison à partir de `editionId`. La raison pouvait révéler le reliquat d’enveloppe et les seuils internes. `requestValidation`, elle, passait déjà par `ctx()` et `getCurrentPerson`.

Le protocole Server Actions réel nécessite un navigateur et une action sérialisée ; aucun appel anonyme n’a été autorisé à écrire en base. La preuve principale est la fonction exportée sans garde, complétée par le test de non-régression statique et la revue du protocole Next. À confirmer par un scénario HTTP dédié si le harness expose ultérieurement l’identifiant d’action.

## Correction

`assertEditionReadable` exige désormais une personne active via `getCurrentPerson`, charge uniquement le graphe d’accès de l’édition, puis autorise le pilote, un membre de l’équipe, le même pôle ou le CODIR. La lecture des settings, dépenses, enveloppe et seuils intervient après ce contrôle. Les acteurs refusés reçoivent une erreur stable et aucune donnée budgétaire.

`computeRequiredLevel` délègue à `explainRequiredLevel` et bénéficie donc de la même protection. La règle de calcul serveur de SEC-05 n’a pas changé.

## Validation

- test unitaire d’ordre du garde et de la lecture budgétaire : PASS ;
- tests unitaires : PASS (29/29) ;
- `npm run test:security` : PASS (33/33) ;
- lint : PASS ;
- TypeScript : PASS ;
- build production : PASS.

## Fichiers modifiés

- `app/actions/edition.ts`
- `tests/unit/edition-action-auth.test.ts`
- ce rapport.

## Limites

La couverture directe des requêtes POST Server Actions anonymes reste à compléter avec un identifiant d’action capturé par le harness. Les routes/pages qui chargent déjà une édition conservent leurs contrôles existants.

## Verdict final

**SEC-17 CONFIRMÉ ET CORRIGÉ**.
