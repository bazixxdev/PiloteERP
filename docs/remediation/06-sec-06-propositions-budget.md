# SEC-06 — Propositions et permissions budgétaires

## 1. Scénario vulnérable

`saveField("edition", ..., "budgetEnvelope", ...)` vérifie la couche `budget` et exige `fiche.budget`. En revanche, `decideChange` vérifiait uniquement `canActAsPilot`. Un pilote pouvait donc accepter une proposition portant sur `budgetEnvelope` et modifier la valeur sans posséder la permission budgétaire.

Le même défaut concernait `spent`, qui appartient également à la couche `budget`.

## 2. Matrice champ → permission

| Champs proposables de l’édition | Couche | Mutation directe | Acceptation avant | Acceptation après |
|---|---|---|---|---|
| `budgetEnvelope`, `spent` | `budget` | `fiche.budget` | pilote/direction via `canActAsPilot` | `fiche.budget` + droit de décision |
| champs `strategic` | `strategic` | `fiche.strategic` (hors fiche verrouillée) | pilote/direction | workflow existant conservé |
| champs `means` | `means` | `fiche.means` (hors fiche verrouillée) | pilote/direction | workflow existant conservé |
| champs `proposal` | `proposal` | pilote ou `edition.edit_all` | pilote/direction | workflow existant conservé |
| champs `year` | `year` | pilote, équipe ou responsable de pôle selon contexte | pilote/direction | workflow existant conservé |
| champs `validation` | `validation` | `fiche.validation` | non proposables (`proposeChange` les refuse) | inchangé |

La permission budgétaire est explicitement définie dans `canWriteLayer` et utilisée par la mutation directe. La politique complète de parité pour les autres couches reste à traiter dans BLK-14 ; elle n’est pas élargie dans ce ticket.

## 3. Reproduction avant correction

Le chemin vulnérable était démontré par la lecture de `decideChange` : après le seul contrôle `canActAsPilot`, la transaction appelait `edition.update` avec le champ proposé. Pour un pilote sans `fiche.budget`, une proposition `budgetEnvelope` pouvait donc être acceptée et persistée.

La comparaison avec `saveField` confirme la divergence : la mutation directe refusait le même acteur sur la couche `budget`.

Une reproduction E2E complète nécessitant l’invocation d’une Server Action avec contexte de session n’a pas été ajoutée ; le test unitaire ciblé de la politique est exécuté sur les acteurs réels du modèle de permissions.

## 4. Tests rouges et tests de non-régression

Le scénario de régression est couvert par `tests/unit/proposals-permission.test.ts` : un acteur sans `fiche.budget` est refusé pour `budgetEnvelope` et `spent`, tandis qu’un RAF disposant de cette permission est accepté. Les champs ordinaires restent acceptés par la politique de proposition existante et les champs inconnus sont refusés.

Le test est conçu pour échouer avec la politique précédente, qui ne possédait aucun contrôle de champ lors de l’acceptation.

## 5. Cause racine et politique retenue

Cause racine : `decideChange` confondait le droit de décider d’une proposition avec le droit d’appliquer la mutation portée par cette proposition.

Politique retenue : une acceptation budgétaire exige désormais simultanément le droit de décision existant et `fiche.budget`. Le contrôle est effectué avant toute transaction, lecture de la valeur courante ou écriture.

## 6. Correction appliquée

Un helper ciblé `canAcceptProposedField` a été ajouté dans `lib/proposal-permissions.ts`. Il refuse les champs inconnus et impose `fiche.budget` pour toute définition de champ de couche `budget`. `decideChange` l’appelle avant d’entrer dans la transaction lorsque la décision est `accepted`.

La décision `refused` conserve son fonctionnement : elle ne modifie pas la fiche. Les propositions ordinaires conservent le workflow pilote/direction existant.

## 7. Comparaison des mutations

- Mutation directe : `saveField` → `canWriteLayer(..., "budget", ...)` → `fiche.budget` requis.
- Mutation via proposition : `decideChange` → `canActAsPilot` puis `canAcceptProposedField` → `fiche.budget` requis pour `budgetEnvelope` et `spent`.

Dans les deux cas, un pilote sans permission budgétaire est refusé et la valeur reste inchangée.

## 8. Fichiers modifiés

- `app/actions/proposals.ts`
- `lib/proposal-permissions.ts`
- `tests/unit/proposals-permission.test.ts`
- `docs/remediation/06-sec-06-propositions-budget.md`

Aucune migration Prisma ni modification de schéma n’a été faite.

## 9. Résultats des validations

- tests unitaires : **11/11 réussis** ;
- lint ESLint : **réussi** ;
- TypeScript (`npx tsc --noEmit`) : **réussi** ;
- build production (`npm run build`) : **réussi**.

Le test E2E production-like complet des Server Actions n’a pas été ajouté dans ce ticket ; cette limite est donc à conserver lors de l’extension de la suite de sécurité.

## 10. Autres champs sensibles et limites

`spent` est couvert par la même protection que `budgetEnvelope`. Les couches `strategic` et `means` présentent encore une politique de proposition distincte de la mutation directe lorsque la fiche est verrouillée ; cette sémantique fait partie du workflow de propositions existant et doit être clarifiée dans BLK-14 avant toute généralisation. Les conditions de concurrence et décisions simultanées restent dans le périmètre SEC-29.

## 11. Verdict

**SEC-06 CORRIGÉ** pour le contournement budgétaire identifié (`budgetEnvelope` et `spent`).

