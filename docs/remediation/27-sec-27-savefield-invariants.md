# SEC-27 — Invariants métier et saveField

## Cause racine

`saveField` acceptait `equipment.state` pour tout acteur ayant le droit de gérer l'inventaire, alors que `retireEquipment` vérifie l'absence de prêt actif. Cette voie générique permettait donc de créer un matériel `retired` avec un prêt ouvert.

## Matrice ciblée

| Champ | Action canonique | Décision |
|---|---|---|
| `equipment.state` | `retireEquipment` | retiré de `saveField` |
| `equipment.name`, `category`, `reference`, `location`, `quantity`, `purchasedAt`, `value`, `notes` | édition descriptive | conservés |
| `membership.status`, `payment.status`, `expense.status`, statuts financiers | actions/domaines spécialisés à auditer | dette BLK-14, non modifiée ici |
| `edition.status` | action de statut | contrôle déjà dédié dans `allowed` |

## Politique appliquée

La whitelist générique reste disponible pour les champs éditoriaux. Une transition d'état avec invariant métier doit passer par sa commande spécialisée ; aucune duplication de l'invariant n'a été ajoutée dans `saveField`.

## Correction

`lib/fields.ts` ne déclare plus `equipment.state`. Toute tentative `saveField(equipment, state, ...)` retourne donc « Champ non modifiable ». `retireEquipment` reste la seule voie pour cette transition et continue de refuser un équipement avec prêt actif.

## Validation

- Test unitaire de garde de whitelist ajouté : **13/13 tests unitaires PASS**.
- Test historique matériel/prêts (`tests/materiel.spec.ts`) : **1/1 PASS**.
- `npm run test:security` : **33/33 PASS**.
- `npm run lint` : **PASS**.
- `npx tsc --noEmit` : **PASS**.
- `npm run build` : **PASS**, avertissements Edge Runtime/cache non bloquants.

Le scénario historique avant correction est confirmé par l'analyse de la whitelist et du code `retireEquipment`; il n'a pas été rejoué sur un checkout antérieur. Après correction, la mutation générique est refusée avant toute écriture, donc Equipment et Loan restent inchangés.

## Dette BLK-14

Les statuts d'adhésion, paiements, dépenses et autres champs financiers restent dans la whitelist et doivent faire l'objet d'une analyse séparée. Ils n'ont pas été modifiés dans SEC-27.

## Verdict

**SEC-27 CORRIGÉ**

