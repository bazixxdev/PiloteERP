# SEC-13 — Neutralisation des formules dans les exports CSV

## Cause racine et périmètre

Plusieurs exports construisaient leurs cellules avec un simple échappement CSV. Une valeur utilisateur commençant par `=`, `+`, `-` ou `@` restait donc interprétable comme une formule par un tableur.

Chemins concernés : contacts/listes, adhésions, exports administrateur, matrice, trésorerie et clôture. Les exports JSON/XLSX ne sont pas modifiés par ce ticket.

## Correction

`lib/csv.ts` centralise `csvCell` et `csvRow`. Après détection d’un début dangereux (y compris tabulation, retour chariot ou espaces précédant le caractère), la valeur reçoit une apostrophe initiale, puis l’échappement CSV standard est appliqué. Les valeurs normales, nombres, dates, virgules, guillemets et retours à la ligne restent lisibles.

Ainsi `=1+1` était auparavant exporté tel quel ; il devient `'=1+1`, texte littéral dans Excel et LibreOffice.

## Tests

Les tests couvrent `=1+1`, `+1+1`, `-1+1`, `@SUM(...)`, préfixes tabulation/CRLF, texte, nombre, séparateurs, guillemets et lignes CSV. Unitaires : PASS (32/32). Lint, TypeScript et build : PASS. Suite sécurité : PASS (33/33).

## Fichiers modifiés

`lib/csv.ts`, `lib/contacts.ts`, `lib/members.ts`, `lib/matrix.ts`, `lib/treasury.ts`, `app/admin/export/route.ts`, `app/cloture/export/route.ts`, tests unitaires et ce rapport.

## Limites

Le comportement d’un tableur particulier doit être vérifié lors des tests d’acceptation ; les exports XLSX/JSON relèvent d’autres politiques.

## Verdict

**SEC-13 CORRIGÉ**.
