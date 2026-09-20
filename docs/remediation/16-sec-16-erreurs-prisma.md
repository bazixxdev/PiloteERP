# SEC-16 — Erreurs Prisma et détails internes

## Cause racine

`saveField` et `uploadAttachment` retournaient directement `err.message` lorsqu’une exception inattendue survenait. Une erreur Prisma (P2025, contrainte, nom de modèle) pouvait donc être sérialisée dans la réponse de Server Action.

## Correction

Le helper `reportInternalError` journalise le détail uniquement côté serveur et renvoie `{ code: "INTERNAL_ERROR", error: "Une erreur interne est survenue. Réessayez plus tard." }`. Les erreurs métier retournées avant le `catch` restent inchangées (introuvable, interdit, validation, conflit).

Chemins corrigés : `saveField` et `uploadAttachment`, qui étaient les chemins confirmés par SEC-16. Les autres `err.message` recherchés sont soit des messages métier, soit des dettes QLT-09 à traiter séparément.

## Validation

Le test unitaire vérifie qu’un message simulant Prisma P2025 ne fuit pas dans le contrat client. Tests unitaires : 35/35 ; lint, TypeScript et build : PASS. La suite sécurité reste 33/33 au dernier passage.

Les logs serveur conservent le détail technique via `console.error`, sans l’ajouter à la réponse. Aucun token ou secret n’est ajouté au contexte de log par ce helper.

## Fichiers modifiés

`lib/errors.ts`, `app/actions/fields.ts`, `app/actions/attachments.ts`, test unitaire et ce rapport.

## Dette restante

Les autres actions qui construisent des erreurs métier ou capturent des exceptions hors de ces deux chemins restent à inventorier dans QLT-09. Une corrélation structurée des logs relève de l’observabilité future.

## Verdict

**SEC-16 CORRIGÉ**.
