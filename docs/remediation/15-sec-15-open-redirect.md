# SEC-15 — Redirections post-connexion

## Cause racine

La page de connexion validait `suite` avec `startsWith("/")` et l’absence de `//`. Cette validation textuelle ne neutralise pas les backslashes, caractères de contrôle ou normalisations d’URL du navigateur.

## Correction

`safeInternalRedirect` résout la destination avec `new URL(value, "https://pilote.invalid")`, vérifie l’origine sentinelle, refuse les contrôles/backslashes et applique le `basePath` lorsqu’il est configuré. Toute valeur invalide retombe sur `/portefeuille` (ou le portefeuille sous basePath).

Les chemins normaux conservent query et hash. Les autres usages de `next`, `callbackUrl` et `returnTo` n’ont pas été trouvés dans les redirections post-login ; `suite` est le seul paramètre concerné.

## Validation

Les tests couvrent URL absolue, `//evil`, variantes backslash, caractères de contrôle, `javascript:`, `data:`, chemin interne avec query/hash et basePath. À compléter idéalement par un test navigateur post-login réel.

Fichiers modifiés : `lib/redirect.ts`, `app/connexion/page.tsx`, tests unitaires et ce rapport.

## Verdict

**SEC-15 CORRIGÉ**.
