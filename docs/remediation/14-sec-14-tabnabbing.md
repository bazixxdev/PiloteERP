# SEC-14 — Protection contre le tabnabbing dans les notes

## Cause racine

La configuration Tiptap Link n’imposait pas d’attributs `target`/`rel`, et le contenu HTML historique pouvait conserver un `rel="opener"`. Un lien externe ouvert dans un nouvel onglet pouvait donc exposer `window.opener`.

## Correction

L’extension Link est configurée avec `target="_blank"` et `rel="noopener noreferrer"`. Avant chargement dans l’éditeur, les ancres externes historiques sont normalisées : tout `rel`/`target` existant est remplacé par ces valeurs sûres. Les schémas autorisés restent limités aux liens HTTP(S) et `mailto:` pour cette normalisation ; les liens internes conservent leurs attributs et leur comportement existant.

Le mode édition et le mode lecture utilisent le même HTML Tiptap ; aucun `window.open` personnalisé n’existe dans le composant.

## Tests et limites

Le test unitaire vérifie la configuration d’isolation et la neutralisation de `rel="opener"`. Les tests unitaires, lint, TypeScript et build doivent être rejoués. Un test navigateur avec une page enfant contrôlée est recommandé pour confirmer `window.opener === null` sur chaque navigateur supporté.

Fichiers modifiés : `components/common/rich-editor.tsx`, `tests/unit/rich-editor-links.test.ts`, ce rapport.

Les headers COOP/CSP globaux ne sont pas modifiés et restent à traiter séparément (PROD-15).

## Verdict

**SEC-14 CORRIGÉ**.
