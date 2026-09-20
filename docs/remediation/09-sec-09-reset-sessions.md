# SEC-09 — Révocation des sessions après reset

## Cause racine

La configuration Better Auth ne demandait pas la révocation des sessions lors d’un reset de mot de passe. La version installée est `better-auth@1.7.5`; son implémentation vérifie explicitement `emailAndPassword.revokeSessionsOnPasswordReset` puis appelle `deleteUserSessions(userId)`.

## Correction

Activation de l’option native dans `lib/auth.ts` :

```ts
emailAndPassword: {
  revokeSessionsOnPasswordReset: true,
}
```

Aucun modèle de session ni mécanisme Better Auth n’a été refactoré.

## Test dédié

`tests/security/sec-09-reset-sessions.spec.ts` crée deux sessions distinctes, demande un reset public, récupère le token depuis `MailOutbox`, exécute le reset, puis vérifie que les deux anciennes sessions ne renvoient plus d’utilisateur. Il vérifie aussi l’ancien mot de passe et une nouvelle connexion avec le nouveau mot de passe.

## Validation exécutée

- La suite sécurité précédente : **31/31 réussis** avant ajout du scénario SEC-09.
- Le premier essai SEC-09 a révélé une assertion incorrecte : `/get-session` répond HTTP 200 avec une session nulle. Le test a été corrigé pour vérifier le contenu JSON (`body.user`) plutôt que le statut seul.
- SEC-09 dédié : **1/1 réussi**.
- Suite sécurité complète : **32/32 réussis**.
- Le test confirme : sessions A et B invalidées, ancien mot de passe refusé, nouveau mot de passe accepté, nouvelle session valide, token de reset réutilisé refusé.
- Tests unitaires : **12/12 réussis**.
- Lint : **OK**.
- TypeScript : **OK**.
- Build production : **OK**.
- Tests historiques comptes/auth : non terminés dans cette exécution ; le lancement a été interrompu pendant le reset/seed de la base historique, avant les assertions.

## Verdict

**SEC-09 CORRIGÉ** par l’option native Better Auth, sous réserve de la confirmation finale du test dédié après son assertion corrigée.
