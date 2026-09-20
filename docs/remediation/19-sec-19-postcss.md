# SEC-19 / PROD-04 — PostCSS transitif sous Next

## 1. État initial

Une installation propre (`npm ci`) avec Next `15.5.25` résolvait PostCSS ainsi :

- `next@15.5.25` → `postcss@8.4.31` ;
- `@tailwindcss/postcss@4.3.3` et `shadcn@4.21.0` → `postcss@8.5.28`.

La version `8.4.31` était dans la plage de l’avis PostCSS (versions `<=8.5.22`). Sa présence dans l’arbre est confirmée. L’exploitabilité d’un parcours utilisateur de Pilote n’est pas démontrée : PostCSS est utilisé pendant le build CSS, le risque observé est donc principalement build/toolchain. À confirmer pour tout scénario d’exploitation spécifique à l’application.

## 2. Correction retenue

Le changement minimal est un override npm explicite dans `package.json` :

```json
"overrides": { "postcss": "8.5.28" }
```

Next n’a pas été mis à niveau et aucune API applicative n’a été modifiée. Après réinstallation propre, `npm ls postcss --all` ne montre plus qu’une seule version :

```text
@tailwindcss/postcss@4.3.3 → postcss@8.5.28 overridden
next@15.5.25 → postcss@8.5.28 deduped
shadcn@4.21.0 → postcss@8.5.28 deduped
```

La version `8.4.31` n’est plus installée ni atteignable par les chemins de build (`npm explain postcss@8.4.31` ne trouve aucune dépendance).

## 3. Source maps et CSS

`next.config.ts` ne force pas la génération de source maps de production. `postcss.config.mjs` ne déclare que `@tailwindcss/postcss`; aucun réglage supplémentaire lié aux source maps n’a été introduit. Le build de production s’est terminé et a généré les routes CSS/Next sans erreur PostCSS.

## 4. Validation

- `npm ci --no-audit --no-fund` : PASS, installation propre et `prisma generate` exécuté ;
- `npm ls postcss --all` : PASS, uniquement `8.5.28` ;
- `npm run build` : PASS ;
- `npm run lint` : PASS ;
- `npx tsc --noEmit` : PASS ;
- `npm run test:unit` : PASS (23/23) ;
- `npm run test:security` avec la base production-like : PASS (33/33).

## 5. Audit résiduel

`npm audit` signale encore 7 avis (3 modérés, 4 élevés). L’inventaire contient notamment `exceljs`/`uuid`, Prisma (`@prisma/config`/`deepmerge-ts`) et un avis transitif lié à la chaîne Next/PostCSS. La présence effective de PostCSS vulnérable n’est pas confirmée par `npm ls` : la résolution installée est `8.5.28`. Ces alertes restantes ne sont pas corrigées dans SEC-19 ; ExcelJS et Prisma relèvent de tickets distincts. L’écart entre l’arbre effectivement installé et le signal agrégé de `npm audit` doit être revalidé lors d’une prochaine mise à jour npm/Next.

## 6. Fichiers modifiés

- `package.json` — ajout de l’override PostCSS ;
- `package-lock.json` — résolution verrouillée résultante ;
- ce rapport.

## Verdict

**SEC-19 CORRIGÉ** pour la résolution réellement utilisée par le build : `postcss@8.4.31` a été remplacé par `8.5.28`. Les avis npm transitifs résiduels et les autres dépendances vulnérables restent à traiter séparément.
