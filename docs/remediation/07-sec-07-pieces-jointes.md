# SEC-07 — Cohérence des rattachements de pièces jointes

## 1. Scénario vulnérable

Le modèle `Attachment` est polymorphe et accepte plusieurs clés étrangères optionnelles (`editionId`, `validationId`, `fundingLineId`, `deliverableId`, `conventionId`, ainsi que matériel/prêt). `uploadAttachment` faisait confiance aux identifiants fournis par le formulaire : une édition A pouvait être combinée avec une validation de l’édition B.

## 2. Modèle observé

- `ValidationRequest`, `FundingLine` et `Deliverable` permettent de retrouver leur édition ;
- une `Convention` n’est liée à une édition que par une `FundingLine` ;
- les pièces de matériel et de prêt sont gérées par `uploadEquipmentFile` ;
- la base garantit les FK individuellement, mais pas la cohérence entre parents polymorphes.

## 3. Reproduction avant correction

Le chemin vulnérable était démontré dans `uploadAttachment` : l’édition était chargée pour l’autorisation, mais `validationId`, `fundingLineId` et `deliverableId` étaient ensuite persistés sans comparaison avec l’édition chargée. Les deux FK pouvaient donc être valides tout en désignant deux éditions différentes.

La reproduction métier est : `editionId=A`, `validationId` d’une validation de B, puis création de la ligne `Attachment`. Le test unitaire de cohérence reproduit cette combinaison au niveau de la règle serveur ; aucune donnée réelle n’est utilisée.

## 4. Tests de non-régression

`tests/unit/attachment-coherence.test.ts` couvre :

- validation appartenant à A avec édition A : accepté ;
- validation appartenant à B avec édition A : refusé ;
- ligne de financement d’une autre édition : refusée ;
- convention non reliée à l’édition : refusée.

Les contrôles d’autorité et les vérifications de permissions restent dans l’action serveur qui charge les cibles réelles avant écriture.

## 5. Règle de cohérence retenue

L’édition chargée côté serveur est la cible de contexte. Toute validation, ligne de financement ou tout livrable fourni doit résoudre vers cette même édition. Une convention fournie avec une édition doit être reliée à cette édition par une ligne de financement. Toute contradiction est rejetée avant la création du fichier.

Pour le matériel, lorsqu’un prêt et un matériel sont fournis ensemble, le prêt doit référencer exactement ce matériel.

## 6. Correction appliquée

- Ajout de `lib/attachment-coherence.ts`, helper pur de cohérence des parents.
- `uploadAttachment` charge et vérifie validation, ligne, livrable et convention avant `writeFile`.
- La création DB utilise les identifiants validés.
- Si la création DB échoue après écriture, le fichier généré est supprimé immédiatement.
- `uploadEquipmentFile` refuse désormais un couple `equipmentId` / `loanId` incohérent.

Aucune migration Prisma ni modification du modèle polymorphe n’a été effectuée.

## 7. Avant / après

| Scénario | Avant | Après |
|---|---|---|
| édition A + validation A | accepté | accepté si autorisé |
| édition A + validation B | accepté si les FK existent | refusé avant écriture |
| édition A + ligne B | accepté | refusé |
| édition A + livrable B | accepté | refusé |
| édition A + convention non liée | accepté/attachable | refusé |

## 8. Fichiers modifiés

- `app/actions/attachments.ts`
- `app/actions/equipment.ts`
- `lib/attachment-coherence.ts`
- `tests/unit/attachment-coherence.test.ts`
- `docs/remediation/07-sec-07-pieces-jointes.md`

## 9. Validations exécutées

- tests unitaires : **12/12 réussis** ;
- lint ESLint : **réussi** ;
- TypeScript : **réussi** ;
- build production : **réussi**.

## 10. Fichiers orphelins

Les contrôles de cohérence sont exécutés avant `writeFile` dans `uploadAttachment`. En cas d’échec de création DB, le fichier généré est supprimé. Le flux matériel conserve son ordre historique et devra être traité plus largement dans BLK-11 si une stratégie transactionnelle stockage/DB complète est requise.

## 11. Limites restantes

Le modèle autorise toujours plusieurs parents optionnels au niveau Prisma et ne possède pas de contrainte `CHECK` imposant une cible unique. La normalisation, les contraintes DB et l’audit complet des rattachements polymorphes restent dans BLK-04. Les permissions de téléchargement génériques des pièces ne sont pas refondues dans ce ticket.

## 12. Verdict

**SEC-07 CORRIGÉ** pour le contournement de cohérence édition/validation, édition/financement/livrable/convention et matériel/prêt identifié.

## 13. Validation de clôture

- **Suite sécurité SEC-01 à SEC-07 :** non exécutable en l’état. Le profil production-like contient des scénarios SEC-01 à SEC-04 et SEC-03B, mais aucun scénario SEC-05, SEC-06 ou SEC-07 n’est encore présent. La tentative de lancement de la suite historique a par ailleurs échoué dans son global setup sur une base de test dont le seed est incohérent avec le schéma (`Call.note` absent, erreur Prisma P2022), avant l’exécution des tests.
- **Tests historiques pièces jointes / validations / conventions :** non exécutables dans cette tentative pour la même erreur de seed `Call.note`.
- **Tests unitaires :** **12/12 réussis**.
- **Lint :** **réussi**.
- **TypeScript :** **réussi** après régénération des types par le build.
- **Build production :** **réussi** (`npm run build`).

La panne de seed est indépendante des modifications SEC-07 : aucun test n’a révélé de régression directement causée par le correctif, et aucun code applicatif supplémentaire n’a été modifié pour cette validation.
