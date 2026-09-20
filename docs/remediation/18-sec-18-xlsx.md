# SEC-18 / PROD-03 — Imports tableurs

## Version initiale et usages

Le projet utilisait `xlsx@0.18.5`, verrouillé dans `package-lock.json`, sur deux chemins réels : import de contacts (`app/actions/contacts.ts`) et import du grand livre/Pennylane (`app/actions/ledger.ts`, `lib/pennylane.ts`). Les écrans annonçaient `.xlsx`, `.xls` et `.csv`, mais le parser était utilisé pour tous les fichiers Excel.

La version vulnérable est confirmée par l'inspection du lockfile et de `npm ls`. L'exploitabilité d'un avis donné dans Pilote n'a pas été démontrée offensivement ; seuls des fichiers de test inoffensifs ont été utilisés.

## Stratégie retenue

`xlsx` n'ayant pas de mise à jour compatible disponible dans le dépôt, le parser a été remplacé par `exceljs@4.4.0` pour les classeurs `.xlsx`. Le CSV conserve un parseur local borné. Les anciens `.xls` sont désormais rejetés explicitement et doivent être convertis en `.xlsx` ou `.csv`.

## Limites et erreurs

`lib/spreadsheet.ts` applique avant parsing :

- taille maximale : 10 Mo ;
- 1 à 5 feuilles ;
- 20 000 lignes et 100 colonnes maximum ;
- formats acceptés : `.xlsx` et `.csv` uniquement.

Les erreurs sont converties en messages stables par les actions existantes avant toute écriture DB. L'import comptable écrit toujours son snapshot dans une transaction après parsing et validation ; un fichier invalide ne produit donc aucune écriture.

## Compatibilité et tests

- Fixture XLSX générée avec accents : **PASS**.
- Fichier `.xls` et fichier dépassant 10 Mo : **refus contrôlé**.
- Tests unitaires : **23/23 PASS**.
- Tests historiques contacts/comptabilité ciblés : non rejoués séparément dans cette étape ; les suites de sécurité et de build passent.
- `npm ci --ignore-scripts --no-audit --no-fund` : **PASS**, puis `npx prisma generate` requis pour le build local.
- `npm ls xlsx --all` : **aucune occurrence**.
- `npm run test:security` : **33/33 PASS**.
- `npm run lint` : **PASS**.
- `npx tsc --noEmit` : **PASS**.
- `npm run build` : **PASS** après génération Prisma.

Les usages contacts et grand livre sont migrés vers le nouveau lecteur. Les pièces jointes `.xlsx` restent des fichiers stockés et ne sont pas parsées par ces chemins.

## Limites restantes

`exceljs` apporte des dépendances transitives signalées par `npm audit`; elles doivent faire l'objet d'un suivi séparé. La conversion des anciens `.xls`, les tests métier complets d'import et une isolation de parsing dédiée restent à approfondir.

## Verdict

**SEC-18 CORRIGÉ**

