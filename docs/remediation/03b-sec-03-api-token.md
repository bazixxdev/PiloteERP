# SEC-03B — Protection et rotation du token d’export global

Date : 20 septembre 2026  
Références : audits SEC-03/TST-01/TST-11 et remédiations `00-guardrails`, `01-sec-01`, `02-sec-02`, `03a-sec-03`.

## 1. Usages identifiés

| Usage | Token accepté | Session acceptée | Permission / données |
|---|---|---|---|
| `/admin/export` | oui, via `exportAllowed` puis `permissionExportAllowed` | oui si `admin.manage` | export global des tables |
| `/cloture/export` | oui | oui si `time.lock` | temps agrégés |
| `/matrice/export` | oui | oui si `codir.access` | matrice globale |
| `/admin?section=donnees` | affichage et URLs | page accessible en lecture aux autres rôles avant ce ticket | valeur secrète et URLs externes |

`settings.apiToken` est une colonne `TEXT` nullable de `Settings`. Il est généré par le seed avec `randomBytes(18).toString("base64url")`, lu par `lib/export-auth.ts`, affiché par `AdminPage`/`ApiCard` et modifiable auparavant via `saveField` (`AutoField`). Aucun mécanisme de rotation dédié n’existait.

## 2. Reproduction initiale

Avant correction, un contributeur qui ouvrait `Admin › Données` recevait `settings.apiToken` dans le rendu serveur/RSC, le champ et les URLs `ApiCard`. Copié depuis cette page, le token permettait ensuite un appel anonyme à `/matrice/export?...&jeton=...` avec une réponse `200`. La session du compte n’était pas nécessaire pour cet appel ; sa révocation ne pouvait donc pas invalider le token.

## 3. Cause racine

La page chargeait `getSettings()` puis passait directement `settings.apiToken` à l’UI quel que soit `rw`. Le même secret servait d’autorisation externe sans rotation explicite. La protection de l’export était volontairement indépendante des sessions.

## 4. Politique retenue

- `admin.manage` est la permission de gestion du token, seule permission existante correspondant à l’administration des paramètres et exports.
- Les rôles ordinaires ne reçoivent ni la valeur, ni les URLs contenant le token.
- Les tokens restent distincts des sessions et continuent d’autoriser uniquement les routes explicitement prévues par `exportAllowed`.
- Les permissions SEC-03A restent inchangées pour les sessions.

## 5. Tests rouges et tests ajoutés

`tests/security/sec-03b-api-token.spec.ts` vérifie :

- contributeur et désactivé : token absent du HTML/RSC et absence du bouton de rotation ;
- token valide sans session : export matrice accepté ; token invalide : refusé ;
- rotation : ancien token refusé, nouveau token accepté.

Les assertions d’exposition et d’utilisation auraient échoué avec le rendu initial qui sérialisait le token.

## 6. Correction et rotation

- `AdminPage` ne rend plus les exports, le champ ou `ApiCard` pour un acteur non `admin.manage`.
- `ApiTokenPanel` expose la valeur uniquement à l’administrateur et fournit le bouton de rotation.
- `rotateApiToken` vérifie `canAdmin`, génère 32 octets via `crypto.randomBytes`, puis remplace `Settings.apiToken` en une mise à jour Prisma unique. L’ancien token cesse immédiatement d’être valide.
- `saveField` reste protégé par `canAdmin`; aucun secret de production n’est ajouté au dépôt.

Le token reste stocké en clair, car l’interface doit pouvoir afficher/copier une valeur nouvelle et construire les URLs destinées aux consommateurs externes. Un stockage haché nécessiterait un parcours de révélation distinct et n’est pas introduit ici.

## 7. Résultats

```text
SEC-03B : 3 passed
Suite sécurité SEC-01/02/03A avant ajout du ticket : 26 passed
npm run lint : succès
npx tsc --noEmit : succès
npm run test:unit : 7 passed
npm run build : succès (Next 15.5.25)
```

Après les deux ajustements de test liés à la longueur du token seedé et au statut `403` d’un token invalide, les trois scénarios SEC-03B passent.

## 8. Procédure obligatoire en production

Après déploiement du correctif :

1. se connecter comme direction/RAF sur l’installation réelle ;
2. ouvrir `Admin › Données › Connexions externes` ;
3. cliquer « Régénérer » et enregistrer le nouveau token dans le gestionnaire prévu ;
4. vérifier qu’un appel avec l’ancien token renvoie `401/403` ;
5. vérifier qu’un appel avec le nouveau token renvoie `200` sur chaque route consommée ;
6. mettre à jour Excel/Power Query et tout autre consommateur externe ;
7. en cas d’erreur, corriger les consommateurs avec le nouveau token plutôt que de réutiliser l’ancien.

Cette rotation est obligatoire car l’ancien token doit être considéré comme compromis.

## 9. Sujets non traités

SEC-04, OAuth/API keys multiples, hash du token, refonte générale des exports et SEC-23 (tokens dans URLs et journaux) restent hors périmètre. Les routes qui transportent encore le token en query string (`/admin/export`, `/cloture/export`, `/matrice/export`) sont à reprendre dans SEC-23.

## 10. Verdict

**SEC-03B CORRIGÉ**
