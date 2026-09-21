# Sécurité et autorisation

Ce que l'audit de septembre 2026 (SEC-01 → SEC-29, `docs/remediation/`) a coûté deux jours à corriger. Une sentinelle (`tests/unit/guardrails.test.ts`) casse si une de ces règles est contournée.

## Quand lire ce fichier

- Toute Server Action, `route.ts`, export, page qui lit ou écrit des données d'une personne, d'un budget, d'un paiement, d'une note.
- Tout ajout dans `lib/fields.ts` (`FIELDS`), `lib/rights.ts`, `lib/permissions.ts`, `lib/export-auth.ts`, `lib/auth.ts`.

## Règles

- **CRITICAL** — authentification ≠ autorisation : `getCurrentPerson()` donne *qui*, jamais *quoi*. Chaque action et route vérifie ensuite le droit **sur la ressource visée** (`canEditFunding(me)`, `canWriteLayer(me, …)`, `inMyPole`, propriétaire, etc.) avant toute requête Prisma qui retourne des données.
- **NEVER** compter sur le middleware, la visibilité UI ou un `readOnly` côté client comme contrôle : ce sont des conforts, pas des gardes (SEC-02, SEC-17).
- **NEVER** sérialiser puis filtrer : filtrer **avant** de renvoyer (notes privées SEC-04, budget SEC-17, périmètre de pôle). Une donnée qui sort d'un loader est considérée lue.
- **NEVER** ajouter à `FIELDS` (saveField) un statut, un état de validation, une permission, un rôle, un montant financier, un paiement, ni une relation dont le changement a un effet métier (SEC-27). Ces champs ont une **commande dédiée** (`setDossierStatus`, `decideProposal`, `retireEquipment`, `rotateApiToken`, …) qui porte l'invariant. Un champ trivial (texte, date, libellé) peut rester générique ; s'il a un invariant (ex. `call.amountKind`), le mettre dans `saveField` **et** dans la commande de création, ou mieux dans un helper pur commun (`callFieldInvariant`).
- **ALWAYS** une seule implémentation par règle métier : pages, actions, imports, propositions et exports appellent le même helper (`lib/…`). Une mutation indirecte (proposition acceptée, import, reconduction, cascade) applique les mêmes permissions et invariants que la mutation directe (SEC-06, SEC-11, SEC-12).
- **ALWAYS** calculer côté serveur ce que le client pourrait falsifier : niveau de validation requis (SEC-05), montants, rattachements (SEC-07 : une pièce jointe n'est rattachée qu'à des objets de la même édition), périmètre.
- **ALWAYS** vérifier `Person.active` pour tout accès hors session (jeton ICS, jeton d'API) et révoquer les sessions à la désactivation ou au reset (SEC-08, SEC-09).
- Exports : `exportDenial(req, permission)` pour les exports globaux (un **jeton présenté est la seule crédence** : faux → 401 même avec une session ; session sans permission → 403), `sessionExportAllowed` pour les documents internes. **NEVER** un export sans l'un des deux (SEC-02, SEC-03).
- Décisions concurrentes : une transition d'état se fait par `updateMany({ where: { id, status: "pending" } })` et se vérifie sur `count` (claim atomique, SEC-29), jamais par lecture puis écriture.
- Erreurs : jamais un message Prisma ni une pile vers le client — `reportInternalError(scope, e)` (SEC-16).
- Contenu : CSV via `csvCell` (neutralise `= + - @`, SEC-13) ; liens Tiptap `rel="noopener noreferrer"` (SEC-14) ; redirection post-login uniquement interne et sous `BASE_PATH` (SEC-15).
- Secrets : jamais dans une URL loguée, un message d'erreur, un `console.log`, un commit. Le format Nginx `pilote_safe` masque les query strings — ne pas ajouter de jeton ailleurs que dans `?jeton=` ou le chemin ICS déjà masqué (SEC-23).

## Avant de livrer une feature qui touche aux données

1. Qui peut lire ? Qui peut écrire ? Écrit en une ligne dans l'action.
2. Un test **négatif** (le mauvais rôle, l'anonyme, l'autre pôle) dans `tests/security/` ou dans la recette.
3. `npm run check` vert (les sentinelles y sont).
