# SEC-05 — Niveau de validation financière

Date : 20 septembre 2026

## 1. Règle métier reconstruite

`requiredLevelFor(amount, settings, remaining)` calcule toujours un niveau parmi 1, 2 et 3 :

- niveau 3 si le montant dépasse le reliquat disponible ou le seuil 2 ;
- niveau 2 si le montant dépasse le seuil 1 ;
- niveau 1 sinon.

`validationLevelOf=0` signifie « informé, pas valideur ». `canDecideValidation` interdit l’auto-approbation, vérifie le niveau, puis le périmètre d’édition/pôle. Les rôles par défaut portent des niveaux 0 à 3.

Le formulaire affichait un réglage manuel (`canOverride`), mais aucune permission explicite ni parcours légitime ne démontrait qu’un acteur pouvait diminuer le niveau calculé. Le commentaire EF-F2 était ambigu ; il ne constitue pas une autorisation de sécurité.

## 2. Reproduction et cause

`requestValidation` calculait `computed`, puis remplaçait ce résultat par `input.requiredLevel`. Une requête client avec `requiredLevel=0` pouvait donc enregistrer une demande importante au niveau 0. La décision se fondait ensuite sur cette valeur persistée, permettant à un décideur insuffisant de passer le contrôle et de créer l’`Expense` lors de l’approbation.

## 3. Tests et bornes

`tests/unit/validation-level.test.ts` vérifie les seuils, le reliquat, les niveaux invalides (`0`, négatif, `>3`) et l’impossibilité pour un niveau 0 de décider. Les scénarios historiques de validation restent couverts par la suite existante.

La défense est appliquée à deux endroits :

- à la création, `requestValidation` ignore désormais entièrement `input.requiredLevel` et persiste uniquement `requiredLevelFor(...)` ;
- à la décision, `decideValidation` refuse une demande persistée dont le niveau n’est pas un entier de 1 à 3, et `canDecideValidation` applique le même garde-fou.

## 4. Résultats

```text
npm run test:unit : 9 passed
Suite sécurité SEC-01 à SEC-04 : 31 passed
npm run lint : succès
npx tsc --noEmit : succès
npm run build : succès (Next 15.5.25)
```

Le scénario `requiredLevel=0` ne peut plus abaisser le niveau serveur ; un montant au-dessus des seuils reste au niveau 2 ou 3 selon la règle. Une donnée historique invalide ne peut pas non plus être décidée.

## 5. Fichiers modifiés

- `app/actions/edition.ts`
- `lib/rights.ts`
- `tests/unit/validation-level.test.ts`
- `docs/remediation/05-sec-05-validation-level.md`

## 6. Dérogation

Aucune dérogation de diminution n’est conservée. Le champ client peut continuer à être affiché pour information/compatibilité UI, mais sa valeur n’est plus une source d’autorité. Le niveau serveur est systématiquement retenu.

## 7. Sujets non traités

SEC-06, concurrence avancée, contraintes Prisma supplémentaires (BLK-12), refonte générale des validations et modèle de permissions restent hors périmètre.

## 8. Verdict

**SEC-05 CORRIGÉ**
