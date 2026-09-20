# SEC-02 — Exports documentaires sans authentification effective

Date : 20 septembre 2026  
Références : `docs/audit/01-securite.md` (SEC-02), `docs/audit/05-tests-robustesse.md` (TST-01/TST-11), `docs/audit/07-backlog-consolide.md`, `docs/remediation/00-guardrails.md`, `docs/remediation/01-sec-01-reset-outbox.md`

## 1. Vulnérabilité initiale

Le middleware autorisait toute URL terminant par `/export` dès qu’un paramètre `jeton` non vide était présent. Les handlers `app/plan-operationnel/export/route.ts` et `app/edition/[id]/export/route.ts` ne vérifiaient ensuite ni session ni jeton et généraient directement les documents depuis PostgreSQL.

## 2. Reproduction avant correction

La lecture du code et l’exécution ciblée sur la base production-like ont confirmé le bypass : avec le handler initial, `?jeton=x` franchissait le middleware puis atteignait la requête métier sans garde locale. Le scénario de non-régression couvre les quatre variantes anonymes et cookie invalide sur les deux routes ; il aurait reçu un document `200` avant le correctif.

## 3. Cause racine

La présence syntaxique de `jeton` était traitée comme une exemption par le middleware, alors que les deux handlers n’appelaient aucun contrôle d’accès. L’autorisation reposait donc sur une barrière optimiste et contournable.

## 4. Politique d’autorisation retenue

Le dépôt démontre que ces deux documents sont des exports internes : leurs liens UI n’utilisent pas `jeton` et les commentaires des handlers indiquent « ouvert depuis l’outil ». Le jeton d’API est documenté pour les exports de données destinés à Excel/Power Query, via `exportAllowed`, mais aucune politique de jeton externe n’est démontrée pour ces deux routes.

Politique appliquée : **session Better Auth valide et rattachée à une personne active obligatoire ; aucun paramètre `jeton` n’est accepté pour ces deux handlers**. Une session ordinaire conserve l’accès actuellement démontré. Les autres exports et `exportAllowed` ne sont pas modifiés.

## 5. Tests ajoutés

Fichier : `tests/security/sec-02-exports.spec.ts`.

Pour `/plan-operationnel/export` et `/edition/[id]/export` :

- anonyme sans jeton, jeton vide et valeur arbitraire : `401` JSON, aucun contenu métier ;
- cookie invalide : `401`, aucun contenu métier ;
- session active : document Word `200` ;
- édition inexistante avec session : `404` « Introuvable ».

L’identifiant d’édition est sélectionné dans la fixture seedée et écrit dans un fichier temporaire du setup, car les IDs CUID changent à chaque seed.

## 6. Correction appliquée

Ajout de `sessionExportAllowed(req)` dans `lib/export-auth.ts`. Ce helper vérifie la session Better Auth à partir des headers de la requête, puis vérifie en base que la personne rattachée est active.

Les deux handlers appellent ce contrôle avant toute requête `Edition`, toute lecture métier et toute génération DOCX. Ils renvoient `401` JSON lorsque la session n’est pas effective.

## 7. Fichiers modifiés

- `lib/export-auth.ts`
- `app/plan-operationnel/export/route.ts`
- `app/edition/[id]/export/route.ts`
- `tests/security/sec-02-exports.spec.ts`
- `tests/security/global-setup.ts`
- `docs/remediation/02-sec-02-exports-anonymes.md`

## 8. Résultats avant/après

Avant : le test reproduisant `?jeton=x` échouait conceptuellement sur le handler initial, qui ne vérifiait pas la session après le bypass middleware.

Après :

```text
npx playwright test --config=playwright.security.config.ts : 11 passed
npm run lint : succès
npx tsc --noEmit : succès
npm run test:unit : 7 passed
npm run build : succès (Next 15.5.25)
```

La suite sécurité inclut aussi les quatre tests SEC-01, tous passés.

## 9. Limitations et incertitudes

- La politique de jeton externe n’est pas utilisée pour ces deux routes, car aucun parcours légitime démontré ne l’emploie ; si un besoin métier réel existe, il devra faire l’objet d’un ticket et d’un jeton vérifié explicitement.
- Le contrôle vérifie l’authentification et l’activité de la personne, mais ne change pas la politique métier de périmètre par édition. Cette question relève d’un audit d’autorisation distinct.
- Le middleware conserve son comportement général pour les autres exports et n’a pas été refactoré.

## 10. Sujets connexes non traités

SEC-03 (exports globaux, `settings.apiToken`, politique `exportAllowed`), performance/pagination des exports et refonte générale des permissions restent volontairement hors périmètre.

## 11. Verdict

**SEC-02 CORRIGÉ**

Un paramètre `jeton` arbitraire, un cookie invalide ou l’absence de session ne permet plus de générer ces exports. Le parcours d’une session active reste fonctionnel.
