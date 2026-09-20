# SEC-29 — Décisions concurrentes sur une proposition

## Verdict avant correction

**SEC-29 CONFIRMÉ** par inspection : `decideChange` testait `p.status === "pending"` avant la transaction, appliquait éventuellement l’édition et le ChangeLog, puis mettait la proposition à jour sans condition sur `status`. Deux appels concurrents pouvaient donc tous deux entrer dans la transaction et appliquer deux effets.

## Correction

La transaction réclame désormais atomiquement la ligne avec `updateMany({ where: { id, status: "pending" } })`. Une seule transaction obtient `count === 1` et réserve la décision. La mutation d’édition et son ChangeLog sont exécutés après cette réservation dans la même transaction. Une seconde décision provoque un conflit stable `Cette proposition a déjà été décidée.` et est entièrement rollbackée.

Les notifications restent après commit : elles ne modifient pas l’état métier et ne peuvent être émises que par la décision gagnante. La revalidation reste également hors transaction.

## Validation

- test de structure transactionnelle : PASS ;
- tests unitaires : PASS (30/30) ;
- `npm run test:security` : PASS (33/33) ;
- lint : PASS ;
- TypeScript : PASS ;
- build production : PASS.

Le scénario PostgreSQL concurrent direct doit être rejoué sur le harness avec deux sessions autorisées pour mesurer les effets réels (ACCEPT+ACCEPT et ACCEPT+REJECT) ; la protection atomique est toutefois portée par la condition SQL `status = pending`.

## Fichiers modifiés

- `app/actions/proposals.ts`
- `tests/unit/proposals-concurrency.test.ts`
- ce rapport.

## Limites BLK-11

Les autres workflows multi-étapes et les notifications générales ne sont pas refactorisés. Les appels externes restent hors transaction par conception.

## Verdict final

**SEC-29 CONFIRMÉ ET CORRIGÉ**.
