# SEC-10 — Suppression non autorisée de contacts

## Cause racine

`deleteContact` autorisait implicitement un contact dont `createdById` était nul : la condition ne refusait que les créateurs connus appartenant à un autre utilisateur. `deleteFunderContact` ne vérifiait pas non plus les références métier. La suppression groupée protégeait les financements et adhésions mais pas les prêts.

## Politique retenue

- un contact sans créateur (`createdById = null`) est historique et ne peut être supprimé que par l’administration ;
- un contact créé par un autre utilisateur ne peut être supprimé que par l’administration ;
- toute référence métier (`FundingLine`, `Convention`, `Membership`, `Loan`) bloque la suppression ;
- les listes restent détachables et ne constituent pas une référence métier bloquante.

## Correction

`contactDeletionError` centralise la décision et est utilisé par la suppression unitaire et la suppression via financeur. La suppression groupée inclut désormais les prêts dans ses protections, en plus des financements et adhésions.

Aucune modification de schéma ni de règle d’archivage globale n’a été effectuée.

## Validation production-like (20/09/2026)

- Base isolée PostgreSQL `pilote_test_harness` : migrations et seed exécutés par le harness.
- Scénario `creatorId = null` + `Membership` : le contact historique est refusé à la suppression pour un contributeur comme pour la direction, car la référence métier est bloquante ; le contact et `Membership.contactId` restent intacts.
- Suppression groupée : le parcours historique vérifie qu'un contact cité est conservé tandis qu'un contact sans référence peut être supprimé ; les protections couvrent désormais `FundingLine`, `Convention`, `Membership` et `Loan`.
- Suppression via financeur : le parcours historique financeur passe et appelle la même garde centralisée avant toute suppression.

Résultats exécutés :

- `npm run test:security` : **33/33 PASS**.
- Tests historiques contacts/adhésions/financeurs (`adherents.spec.ts`, `contacts-tableau.spec.ts`, `contacts.spec.ts`, `financeurs.spec.ts`) : **10/10 PASS**.
- `npm run test:unit` : **12/12 PASS**.
- `npm run lint` : **PASS**.
- `npx tsc --noEmit` : **PASS** après le build (une exécution concurrente précédente avait seulement rencontré des types `.next-build` transitoirement absents).
- `npm run build` : **PASS**, avec avertissements Edge Runtime/cache non bloquants.

Aucun test n'a révélé de régression applicative. Aucun nouveau scénario Playwright SEC-10 dédié n'a été ajouté dans cette validation ; le scénario DB et les parcours historiques ont été exécutés, et le chemin financeur utilise la même protection vérifiée par inspection du code.

## Limites

La politique d’archivage et le nettoyage des contacts historiques restent à traiter dans BLK-20. Les suppressions externes Brevo restent soumises à la politique de la suppression groupée administrateur.

## Verdict

**SEC-10 CORRIGÉ** pour le bypass `creatorId = null` et les références métier identifiées.
