# SEC-03A — Autorisation des exports globaux

Date : 20 septembre 2026  
Références : `docs/audit/01-securite.md` (SEC-03), `docs/audit/05-tests-robustesse.md` (TST-01/TST-11), `docs/audit/07-backlog-consolide.md` (BLK-05), `docs/remediation/00-guardrails.md`, `docs/remediation/01-sec-01-reset-outbox.md`, `docs/remediation/02-sec-02-exports-anonymes.md`

## 1. Routes examinées

| Route | Données | Contrôle avant | Politique démontrée |
|---|---|---|---|
| `/admin/export` | personnes, projets, éditions, financements, temps, dépenses, validations, JSON complet | `exportAllowed` : session seule ou jeton valide | `admin.manage` pour l’export interne (section Admin › Données) |
| `/cloture/export` | temps agrégés par projet/personne | `exportAllowed` : session seule ou jeton valide | `time.lock`, car l’écran Clôture et ses actions sont réservés RAF/direction |
| `/matrice/export` | matrice globale éditions × financeurs | `exportAllowed` : session seule ou jeton valide | `codir.access`, car le bouton et les montants sont conditionnés par `isCodir` |
| `/plan-operationnel/export`, `/edition/[id]/export` | documents Word | `sessionExportAllowed` depuis SEC-02 | session active ; traité dans SEC-02 |

Les seules routes utilisant encore `exportAllowed` étaient les trois routes globales ci-dessus. Les liens UI confirment les permissions retenues : `admin.manage`, `canLockMonths` (`time.lock`) et `isCodir` (`codir.access`).

## 2. Politique avant correction

Toute session Better Auth valide était considérée comme suffisante par `exportAllowed`, sans distinction de permission métier. Un contributeur ou un pilote pouvait donc appeler directement les trois URLs et recevoir le fichier, même si les boutons étaient absents ou réservés dans l’interface.

Un jeton API valide reste un mécanisme externe distinct. Sa visibilité, sa rotation et son exposition sont explicitement laissées à SEC-03B.

## 3. Matrice rôles × exports

| Acteur | Admin | Clôture | Matrice |
|---|---:|---:|---:|
| anonyme | refusé | refusé | refusé |
| cookie invalide | refusé | refusé | refusé |
| contributeur | refusé | refusé | refusé |
| pilote | refusé | refusé | refusé |
| RAF | autorisé | autorisé | autorisé |
| direction | autorisé | autorisé | autorisé |

Cette matrice repose sur les permissions en base/seed et les conditions de rendu UI, pas sur le seul nom du rôle.

## 4. Reproduction

Avec la base PostgreSQL production-like et les comptes seedés, un contributeur ou un pilote authentifié recevait auparavant `200` et un CSV en appelant directement chaque route. Le middleware ne faisait qu’établir la présence optimiste d’un cookie ; le handler appelait ensuite `exportAllowed`, qui retournait vrai pour toute session valide.

Les scénarios ajoutés couvrent aussi l’anonyme et le cookie invalide, avec statut, type de réponse et absence de données métier.

## 5. Tests rouges préparés

`tests/security/sec-03a-exports-roles.spec.ts` encode la matrice complète. Les assertions des contributeurs/pilotes auraient échoué sur le code initial (`200` au lieu de `403`), avant l’ajout du contrôle de permission.

## 6. Correction

`permissionExportAllowed(req, permission)` a été ajouté dans `lib/export-auth.ts`. Il vérifie :

1. un jeton API réellement valide lorsqu’un jeton est fourni (chemin externe conservé) ;
2. sinon une session Better Auth valide ;
3. une personne active rattachée ;
4. la permission demandée dans la table `Role`.

Les trois handlers appellent ce helper avant toute requête métier et renvoient `403` pour une session authentifiée mais insuffisamment autorisée. Les anonymes sans cookie restent rejetés par le middleware en `401`.

## 7. Matrice après correction

La matrice attendue est maintenant observée : contributeur et pilote reçoivent `403` sans données ; RAF et direction reçoivent `200` avec le type CSV attendu ; anonyme et cookie invalide sont rejetés (`401` ou `403` pour le cookie invalide selon la barrière atteinte).

## 8. Fichiers modifiés

- `lib/export-auth.ts`
- `app/admin/export/route.ts`
- `app/cloture/export/route.ts`
- `app/matrice/export/route.ts`
- `tests/security/sec-03a-exports-roles.spec.ts`
- `docs/remediation/03a-sec-03-exports-roles.md`

## 9. Tests exécutés

```text
SEC-03A : 15 passed
SEC-01 + SEC-02 + SEC-03A : 26 passed
npm run lint : succès
npx tsc --noEmit : succès
npm run test:unit : 7 passed
npm run build : succès (Next 15.5.25)
```

## 10. Politiques restant À CONFIRMER

- Le périmètre métier plus fin de l’export matrice (tous les financeurs ou périmètre de pôle) reste à confirmer ; le code/UI actuel exporte la matrice globale pour les membres du CODIR.
- La question de savoir si un rôle personnalisé peut recevoir ces permissions est volontairement déléguée à la configuration existante des rôles ; aucun nouveau rôle n’est créé.

## 11. Sujets volontairement non traités

SEC-03B (`settings.apiToken`, rotation et accès anonyme par jeton), SEC-04, pagination, performance et refonte globale RBAC restent hors périmètre.

## 12. Verdict

**SEC-03A CORRIGÉ**
