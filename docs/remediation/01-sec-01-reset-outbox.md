# SEC-01 / BLK-01 — Cloisonnement de la boîte d’envoi

Date : 20 septembre 2026  
Références : `docs/audit/01-securite.md` (SEC-01), `docs/audit/05-tests-robustesse.md` (TST-02), `docs/audit/07-backlog-consolide.md` (BLK-01), `docs/remediation/00-guardrails.md`

## 1. Vulnérabilité initiale

`app/admin/page.tsx` chargeait `MailOutbox` pour toute personne pouvant ouvrir la page `/admin`, puis sérialisait les courriers et leurs liens de réinitialisation dans le rendu serveur. La section était seulement rendue en fonction de `rw` côté UI. Un utilisateur non administrateur pouvait donc recevoir les liens dans le HTML/RSC malgré l’absence des boutons d’action.

Le même flux exposait les liens d’invitation, car ils sont stockés dans la même table.

## 2. Reproduction avant correction

Sur la base PostgreSQL dédiée `pilote_security_local`, le setup a créé les comptes fictifs distincts puis une demande de réinitialisation pour Claire Vasseur (direction). Avec la session de Lucas Perrin (contributeur), `GET /admin?section=comptes` renvoyait `200` et son HTML contenait l’adresse et le lien `api/auth/reset-password/...` de Claire dans le payload RSC.

Le test rouge vérifiait l’absence de `mail-link-*` et de `api/auth/reset-password/`; il échouait avant la correction. La récupération du lien suffisait à démontrer l’exposition du secret, sans exécuter le reset.

## 3. Cause racine

La requête sensible était incluse dans `Promise.all` sans condition d’autorisation :

```ts
prisma.mailOutbox.findMany({ where: { handedAt: null }, ... })
```

L’autorisation existante (`canAdmin(me)`) n’était appliquée qu’aux contrôles d’écriture et au rendu final.

## 4. Tests ajoutés

Fichier : `tests/security/sec-01-reset-outbox.spec.ts`.

- contributeur : aucune boîte, aucun lien ni token dans le DOM/HTML/RSC ;
- direction : lecture du lien autorisée et fonctionnelle ;
- anonyme : redirection et absence de données sensibles ;
- compte désactivé : absence de données sensibles.

Le setup dédié marque Manon Girard inactive après création des états de session afin que la vérification couvre une session existante dont la personne est désactivée.

## 5. Correction appliquée

Dans `app/admin/page.tsx` :

- `MailOutbox.findMany` n’est exécuté que si `rw` (`canAdmin(me)`) est vrai ;
- la section « Boîte d’envoi » n’est rendue que pour cet acteur autorisé ;
- le parcours direction reste inchangé.

L’autorisation est donc vérifiée avant lecture et avant sérialisation. Aucun nouveau système de permissions n’a été introduit.

## 6. Fichiers modifiés

- `app/admin/page.tsx`
- `tests/security/fixtures.ts`
- `tests/security/global-setup.ts`
- `tests/security/sec-01-reset-outbox.spec.ts`
- `docs/remediation/01-sec-01-reset-outbox.md`

## 7. Résultats

Commandes exécutées après correction :

```text
npx playwright test --config=playwright.security.config.ts : 4 passed
npm run lint : succès
npx tsc --noEmit : succès
npm run test:unit : 7 passed
npm run build : succès (Next 15.5.25)
```

Le build conserve les avertissements déjà observés sur le cache webpack et `localStorage` Node. Une première exécution du profil a rencontré le rate limit après plusieurs connexions répétées ; le redémarrage du serveur de recette a réinitialisé ce compteur et l’exécution complète a ensuite passé.

## 8. Limitations

- Le test vérifie l’absence du secret dans le document et le payload RSC observables par Playwright ; il ne constitue pas une instrumentation Prisma prouvant le nombre exact de requêtes.
- Les scénarios Server Actions directs et endpoints indirects dédiés restent à compléter si une voie supplémentaire est identifiée.
- La fixture désactivée est préparée dans la base de test uniquement.

## 9. Constats connexes volontairement non corrigés

SEC-09 (révocation des anciennes sessions après reset) n’a pas été modifié. Aucun refactor global des permissions, aucune correction SEC-02 et aucune modification des flux d’invitation hors cloisonnement de `MailOutbox` n’ont été engagés.

## 10. Verdict

**SEC-01 CORRIGÉ**

La boîte d’envoi et les liens de reset/invitation ne sont plus chargés ni sérialisés pour un acteur non administrateur, tandis que la direction conserve son parcours légitime.
