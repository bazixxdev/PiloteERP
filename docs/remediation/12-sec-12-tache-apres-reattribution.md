# SEC-12 — Tâche après réattribution d'une demande

## Cause racine

`updateTask` synchronisait le statut de la `Request` liée après avoir vérifié uniquement que la tâche appartenait à l'acteur courant. Il ne recalculait pas `canTreatRequest` sur la demande actuelle. Une tâche conservée après réattribution pouvait donc encore piloter la demande.

## Politique retenue

La demande actuelle est la source d'autorité. Avant une mutation `done`/réouverture provenant d'une tâche, l'acteur doit encore être destinataire, responsable du pôle ou disposer du droit global de traitement. La propriété historique de la tâche ne suffit pas.

## Correction

`app/actions/tasks.ts` recharge la Request liée et appelle `canTreatRequest` avant toute synchronisation. Si le droit a été perdu, l'action est refusée et ni la tâche ni la Request ne sont modifiées. Le parcours légitime de l'acteur toujours affecté reste inchangé.

## Devenir de l'ancienne tâche et atomicité

L'ancienne tâche reste en base et reste visible à son propriétaire historique, mais elle ne peut plus être cochée ou décochée via `updateTask` après réattribution. Le refus avant mutation conserve Task et Request cohérentes. La réattribution elle-même ne réattribue ni ne supprime automatiquement la tâche.

## Validation

- Tests historiques demandes/tâches : **5/6 PASS**. Les quatre scénarios de demandes et le premier scénario tâches passent. Un test historique de kanban échoue sur l'absence de la tâche « Envoyer la convocation » ; échec de données/date préexistant, sans lien avec SEC-12.
- `npm run test:security` : **33/33 PASS**.
- `npm run test:unit` : **12/12 PASS**.
- `npm run lint` : **PASS**.
- `npx tsc --noEmit` : **PASS**.
- `npm run build` : **PASS**, avec avertissements Edge Runtime/cache non bloquants.

Le scénario rouge pré-correction n'a pas été rejoué sur une version antérieure ; la voie vulnérable est démontrée par l'ancienne absence du contrôle et corrigée avant validation.

## Limites

Le devenir UX automatique des anciennes tâches et les problèmes généraux de concurrence Tasks/Requests restent hors SEC-12. Les notifications existantes ne sont pas refactorées.

## Verdict

**SEC-12 CORRIGÉ**

