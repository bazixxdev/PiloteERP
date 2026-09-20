# SEC-11 — Copie de temps dans un mois verrouillé

## Cause racine

`copyPreviousWeek` ne contrôlait que le mois du lundi de la semaine cible. Une semaine commençant en août pouvait donc écrire des jours de septembre verrouillés.

## Politique retenue

La règle de `saveTime` est la source de vérité : toute date écrite est interdite si le `MonthLock` de la personne et du mois correspondant existe. Pour une copie multi-mois, tous les mois touchés sont contrôlés avant mutation.

## Correction

Dans `app/actions/time.ts`, `copyPreviousWeek` :

- calcule les sept dates de la semaine cible ;
- déduplique les mois concernés et charge leurs verrous en une fois ;
- refuse la copie si un seul mois est verrouillé ;
- prépare les créations avant écriture ;
- exécute les créations et l'invalidation de `WeekDeclaration` dans une transaction Prisma.

La copie ne laisse donc pas d'écriture partielle. Une copie réussie invalide la déclaration de complétude de la semaine, comme les autres mutations de temps.

## Validation

- Tests temps/clôture historiques : **2/2 PASS** (`recette-2-temps.spec.ts`, `temps-rythmes.spec.ts`).
- Suite sécurité : **33/33 PASS**.
- Tests unitaires : **12/12 PASS**.
- Lint : **PASS**.
- TypeScript : **PASS**.
- Build production : **PASS** (avertissements Edge Runtime/cache non bloquants).

Le scénario août ouvert / septembre verrouillé est couvert par la règle désormais appliquée à chaque mois candidat : la copie est refusée avant toute création, donc aucune `TimeEntry` ne peut être créée en septembre. Le scénario rouge pré-correction n'a pas été rejoué sur une version antérieure du code ; la cause est démontrée par l'ancienne implémentation limitée au lundi.

## Scénarios multi-mois et multi-années

La clé de verrouillage est calculée pour chaque date avec `monthKey`, ce qui couvre les passages de mois et de décembre à janvier sans hypothèse sur le mois du lundi.

## Limites

Les problèmes généraux de concurrence et de verrouillage hors de cette action restent du ressort de BLK-11. Le contrôle de `saveWeekSplit` existant n'a pas été refactoré.

## Verdict

**SEC-11 CORRIGÉ**

