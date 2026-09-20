# SEC-04 — Notes privées et conventions

Date : 20 septembre 2026

## 1. Scénario initial et reproduction

Une note privée liée à une convention était chargée par `ConventionPage` avec `notesLinked: { include: { author } }`, sans appliquer `canReadNote`. La page Notes appliquait pourtant déjà cette politique.

La fixture production-like crée une note privée contenant `SEC04_PRIVATE_SENTINEL_7f2c91`, écrite par Claire Vasseur et liée à la convention `ADEME-2027`. Lucas Perrin, tiers non auteur et non destinataire, est utilisé pour la reproduction. Avant correction, la page de convention sérialisait cette sentinelle dans son HTML/RSC, tandis que l’accès direct via `/notes?note=...` la masquait.

## 2. Politique existante

`lib/notes.ts` est la source de vérité : `canReadNote` autorise l’auteur, les personnes nommées dans `NoteShare`, puis `canReadShared` selon `private`, `pole_lead`, `pole` ou `all`. `loadNotes` et `loadNote` filtrent avant `toView`, qui convertit les lignes en props sérialisables.

La convention chargeait toutefois une relation Prisma brute et contournait entièrement ce mécanisme. Les notes de l’édition utilisent déjà `loadNotes(me, { editionId })` dans `app/edition/[id]/documents.tsx`.

## 3. Correction

`loadNotes` accepte désormais aussi `conventionId`. `ConventionPage` appelle ce loader après l’authentification et transmet uniquement les `NoteView` autorisées à `DossierWorkspace`. Aucune règle de visibilité n’a été recopiée localement et aucune sémantique de partage n’a changé.

Les métadonnées et le contenu (`body`, auteur, partages) d’une note refusée ne sont donc plus sérialisés par la convention.

## 4. Matrice de visibilité

La politique couvre :

| Visibilité | Auteur | Destinataire nommé | Bon pôle | Autre pôle |
|---|---|---|---|---|
| privée | voit | ne voit pas sauf partage nominatif | ne voit pas | ne voit pas |
| partage nominatif | voit | voit | ne voit pas | ne voit pas |
| pôle | voit | voit selon pôle | voit | ne voit pas |
| tous | voit | voit | voit | voit |

Les tests historiques `tests/notes-riches.spec.ts` couvrent déjà le partage pôle et nominatif au niveau fonctionnel. Le nouveau test SEC-04 vérifie la donnée brute pour l’accès privé via Notes et Convention, ainsi que la lecture légitime de l’auteur.

## 5. Fichiers modifiés

- `lib/notes.ts`
- `app/conventions/[id]/page.tsx`
- `tests/security/global-setup.ts`
- `tests/security/sec-04-notes-private.spec.ts`
- `docs/remediation/04-sec-04-notes-privees.md`

## 6. Résultats

```text
Suite sécurité SEC-01 à SEC-04 : 31 passed
SEC-04 : 2 passed
npm run lint : succès
npx tsc --noEmit : succès
npm run test:unit : 7 passed
npm run build : succès (Next 15.5.25)
```

Avant correction, la sentinelle était présente dans la réponse de convention et absente de la réponse Notes pour le tiers. Après correction, elle est absente des deux réponses ; elle reste présente pour l’auteur.

## 7. Autres chemins examinés

`app/edition/[id]/documents.tsx` utilise déjà `loadNotes` et n’a pas présenté le même défaut. Les actions de création/modification restent protégées par la session et ne sont pas refactorées.

## 8. Limitations et sujets hors périmètre

La matrice complète pôle/tous repose en partie sur les tests fonctionnels historiques ; SEC-04 ajoute la preuve brute du chemin Convention, qui était vulnérable. Aucun nouveau modèle de partage, aucune refonte globale des permissions et aucun ticket SEC-05/SEC-06 n’a été engagé.

## 9. Verdict

**SEC-04 CORRIGÉ**
