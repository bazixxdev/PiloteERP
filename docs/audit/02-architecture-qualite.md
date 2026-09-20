# Audit architecture, qualité et maintenabilité — PiloteERP

**Référence :** `bazixxdev/PiloteERP`, `main`, commit `3a0a6144474edb1aa1c7554ac68ea545251e74c4`.
**Périmètre :** code, schéma Prisma, tests, configuration et déploiement du snapshot. Aucun fichier applicatif n’a été modifié.

## Résumé exécutif

Le projet est une application Next.js monolithique cohérente pour un outil interne : les pages serveur, les Server Actions, Prisma et les composants React sont livrés dans un même dépôt et partagent un vocabulaire métier riche. Cette organisation permet d’avancer vite, mais elle concentre plusieurs responsabilités dans les mêmes fichiers et rend les invariants difficiles à garantir.

Les risques de maintenabilité les plus importants sont avérés : accès Prisma directement depuis de nombreuses pages, Server Actions qui combinent authentification, autorisation, validation, transaction, notifications et revalidation, et une action générique `saveField` qui devient un second moteur métier. Les pages d’administration, de contacts et d’éditions sont particulièrement volumineuses. Les règles de droits existent, mais sont recopiées ou contournées selon les chemins.

La dette n’est pas principalement stylistique. Elle augmente le risque de régression fonctionnelle et de divergence entre deux façons de faire la même opération. L’audit sécurité a déjà démontré ce risque sur les propositions budgétaires, les temps copiés, les pièces jointes et les paiements en cascade.

## 1. Cartographie technique observée

Le frontend et le backend applicatif sont réunis dans l’App Router Next.js. Les pages `app/**/page.tsx` chargent souvent directement Prisma côté serveur et composent des composants client. Les mutations sont principalement des Server Actions sous `app/actions/**`. Les modules `lib/**` contiennent à la fois accès aux données, règles métier, formatage, intégrations et autorisation. Prisma est la couche de persistance unique visible dans le code applicatif.

Mesures du snapshot :

| Mesure | Observation |
|---|---:|
| Fichiers suivis | 459 |
| TypeScript/TSX | 358 fichiers, environ 29 270 lignes |
| Actions/modules contenant `"use server"` | 32 |
| Fonctions exportées repérées dans `app/actions` et `lib` | 377 |
| Fichiers `app`/`components` accédant directement à Prisma | 74 |
| Plus gros fichiers applicatifs | `components/tasks/task-list.tsx` 431 lignes ; `app/admin/page.tsx` 422 ; `app/actions/contacts.ts` 391 ; `app/actions/edition.ts` 355 |
| Tests Playwright suivis | 44 annoncés dans la cartographie initiale |

Ces chiffres ne sont pas des seuils de qualité en eux-mêmes. Ils signalent les zones où une modification demande le plus de contexte et où les tests de caractérisation sont prioritaires.

## 2. Findings

### QLT-01 — ÉLEVÉ — Les pages et composants portent directement l’accès aux données

**Statut : problème avéré. Fichiers :** `app/**/page.tsx`, routes d’export, `components/shell/*`, notamment `app/admin/page.tsx:51-78`, `app/conventions/[id]/page.tsx:29-41`, `app/admin/export/route.ts:15-35`.

**Description.** Au moins 74 fichiers sous `app` ou `components` importent Prisma. Les pages construisent elles-mêmes des `findMany`, `include`, filtres de périmètre et agrégations, pendant que les Server Actions utilisent d’autres requêtes pour les mêmes objets.

**Pourquoi c’est un problème.** La politique de lecture, le shape des données et les relations chargées ne sont pas centralisés. Une nouvelle contrainte de périmètre doit être retrouvée dans des pages, exports, actions et composants différents.

**Risque concret.** Une correction appliquée à une page peut manquer un export ou une route serveur. L’audit sécurité a déjà observé des différences entre pages d’export et actions protégées.

**Correction proposée.** Introduire des query services par agrégat métier (`editionQueries`, `contactsQueries`, `financeQueries`) qui exposent des vues nommées et appliquent le périmètre. Les pages ne devraient composer que la vue et les composants.

**Effort :** important. **Risque de régression :** important lors du déplacement des `include` et des filtres ; commencer par un agrégat et comparer les réponses.

### QLT-02 — ÉLEVÉ — Les Server Actions sont des orchestrateurs trop larges

**Statut : problème avéré. Fichiers :** `app/actions/edition.ts`, `contacts.ts`, `admin.ts`, `time.ts`, `ledger.ts`, `equipment.ts`.

**Description.** Les actions vérifient la session, chargent le graphe Prisma, calculent les droits, nettoient les entrées, mutent plusieurs modèles, créent des notifications, écrivent l’historique puis appellent `revalidatePath`. `requestValidation` et `decideValidation` dans `edition.ts:91-183` sont des exemples représentatifs.

**Pourquoi c’est un problème.** Une action devient difficile à tester sans Next, Prisma et une session complète. Les règles de transaction et les effets secondaires sont mélangés à la validation.

**Risque concret.** Une règle métier peut être appliquée dans un formulaire mais oubliée dans une action sœur ; une notification ou une revalidation peut être oubliée après une nouvelle mutation.

**Correction proposée.** Séparer `command` métier pur, repository Prisma, politique d’accès et adaptateur Server Action. Les commandes retournent un résultat métier ; l’adaptateur gère revalidation et traduction UI.

**Effort :** important. **Risque :** important ; migrer verticalement un flux complet, avec tests de contrat avant/après.

### QLT-03 — ÉLEVÉ — `saveField` est un second moteur de domaine

**Statut : problème avéré. Fichiers :** `app/actions/fields.ts:12-154`, `lib/fields.ts:1-88`.

**Description.** `saveField` accepte un modèle, un identifiant et un champ, convertit la valeur puis route vers des branches spécialisées ou vers un `delegate.update`. La liste blanche décrit de nombreux modèles et champs, y compris `equipment`, `loan`, `membership`, `payment`, `settings` et `docLink`.

**Pourquoi c’est un problème.** Les mutations spécialisées possèdent déjà leurs invariants. La voie générique crée une deuxième API d’écriture qui peut les contourner et qui est difficile à raisonner statiquement.

**Risque concret.** L’audit sécurité a démontré qu’un matériel en prêt pouvait être marqué retiré via `saveField`, alors que `retireEquipment` le refusait, et qu’un détachement pouvait supprimer un paiement reçu par cascade.

**Correction proposée.** Limiter `saveField` aux champs réellement triviaux et faire déléguer chaque domaine à une commande spécialisée. Interdire les champs d’état et les relations depuis l’API générique.

**Effort :** important. **Risque :** élevé, car les écrans inline dépendent de cette API ; introduire des adaptateurs temporaires instrumentés.

### QLT-04 — ÉLEVÉ — Autorisation et règles métier sont dispersées

**Statut : problème avéré. Fichiers :** `lib/rights.ts`, `lib/permissions.ts`, `lib/roles.ts`, `lib/session.ts`, `app/actions/*`, pages d’exports.

**Description.** Les contrôles combinent `canAdmin`, `canEditFunding`, `canWriteLayer`, `isCodir`, des comparaisons directes de rôle, l’appartenance à une équipe et des décisions locales. Les exporteurs utilisent encore `exportAllowed`, tandis que le middleware ne fait qu’un contrôle optimiste de cookie.

**Pourquoi c’est un problème.** Il n’existe pas une politique uniforme par ressource et opération. Les mêmes données ont des chemins de lecture et d’écriture différents.

**Risque concret.** Les écarts observés dans `01-securite.md` — exports trop larges, proposition budgétaire, validation abaissée — sont des symptômes de cette dispersion, pas des anomalies isolées.

**Correction proposée.** Formaliser une matrice `subject/action/resource/context`, puis l’utiliser dans les pages, actions, exports et téléchargements. Les comparaisons directes de rôles doivent être confinées au module de politique.

**Effort :** important. **Risque :** important ; produire d’abord une matrice de compatibilité avec les permissions actuelles.

### QLT-05 — ÉLEVÉ — Transactions et effets secondaires ne sont pas systématiques

**Statut : problème avéré. Fichiers :** `app/actions/edition.ts`, `proposals.ts`, `contacts.ts`, `time.ts`, `funders.ts`, `payments.ts`.

**Description.** Certaines commandes utilisent `$transaction`, d’autres enchaînent plusieurs écritures Prisma et revalidation. `decideChange` transactionne l’écriture principale mais crée des notifications après ; `copyPreviousWeek` crée les lignes dans une boucle ; plusieurs opérations suppriment puis recréent des relations.

**Pourquoi c’est un problème.** Une erreur au milieu laisse des données partiellement modifiées. Les tests mono-utilisateur ne détectent pas toujours les interleavings concurrents.

**Risque concret.** Demi-import, semaine partiellement copiée, notification absente ou relation supprimée après échec secondaire. `detachFundingLineFromConvention` a déjà exposé un effet de cascade non prévu.

**Correction proposée.** Définir une frontière transactionnelle par commande et séparer les effets asynchrones via un outbox idempotent. Ajouter des contraintes conditionnelles et des tests de concurrence.

**Effort :** important. **Risque :** moyen à important selon le flux.

### QLT-06 — MOYEN — Les gros fichiers mélangent présentation, requêtes et orchestration

**Statut : problème avéré. Fichiers :** `app/admin/page.tsx` (422 lignes), `components/tasks/task-list.tsx` (431), `app/contacts/list-view.tsx` (310), `app/ma-semaine/page.tsx` (289), `app/temps/grid.tsx` (274), `app/conventions/[id]/page.tsx` (198).

**Description.** Ces fichiers contiennent chargement Prisma ou préparation de données, règles d’affichage, formulaires et mutations client. `AdminPage` charge plusieurs agrégats, choisit la section, calcule les droits et rend plusieurs tableaux.

**Pourquoi c’est un problème.** Le coût cognitif est élevé et les changements d’une section risquent de modifier le comportement d’une autre. Les tests ciblent souvent la page entière au lieu d’unités stables.

**Correction proposée.** Extraire des view-models côté serveur, des composants de section et des formulaires par domaine ; conserver une page mince qui compose ces blocs.

**Effort :** moyen à important. **Risque :** moyen ; refactoriser section par section avec snapshots fonctionnels.

### QLT-07 — MOYEN — Le domaine est dupliqué entre modèles historiques et nouveaux modèles

**Statut : problème avéré. Fichiers :** `prisma/schema.prisma`, `lib/fields.ts`, `app/edition/[id]/fiche.tsx`, migrations historiques.

**Description.** Le schéma conserve des colonnes texte historiques (`imposedIndicators`, `ownIndicators`) en parallèle des modèles `Indicator`. La fiche affiche explicitement `legacyIndicators` (`fiche.tsx:73`) en plus des indicateurs structurés. Le dépôt conserve également une séquence SQLite puis une migration PostgreSQL initiale globale.

**Pourquoi c’est un problème.** Deux représentations d’une même notion imposent des règles de synchronisation et rendent les rapports ambigus.

**Risque concret.** Un écran écrit le modèle structuré tandis qu’un export ou une migration lit le champ historique ; les utilisateurs voient des valeurs divergentes.

**Correction proposée.** Choisir une source canonique, migrer les anciennes valeurs, documenter la compatibilité puis retirer les champs ou les isoler dans une projection explicitement nommée.

**Effort :** important. **Risque :** important pour les exports et données existantes.

### QLT-08 — MOYEN — Le typage métier reste trop permissif

**Statut : problème avéré. Fichiers :** `app/actions/*`, `lib/fields.ts`, `prisma/schema.prisma`.

**Description.** Plusieurs APIs prennent des `string` libres pour des états, types et champs (`kind`, `status`, `field`, `model`). Les valeurs sont validées localement par tableaux ou casts. `saveField` utilise des valeurs dynamiques et `Record<string, unknown>`.

**Pourquoi c’est un problème.** Le compilateur ne protège pas les transitions de statut ni les couples modèle/champ. La validité dépend du chemin runtime appelé.

**Correction proposée.** Définir des unions dérivées des référentiels, schémas d’entrée partagés et commandes typées par agrégat. Garder les chaînes libres uniquement pour les contenus réellement libres.

**Effort :** moyen. **Risque :** moyen ; commencer par états et actions financières.

### QLT-09 — MOYEN — Gestion d’erreurs et contrat de résultat incohérents

**Statut : problème avéré. Fichiers :** `app/actions/*`, notamment `fields.ts:154-162`, `attachments.ts:66-68`, `helloasso.ts:8-12`.

**Description.** Les actions mélangent retours `{ok:false}`, exceptions Prisma capturées, messages humains et erreurs techniques brutes. Certaines branches lèvent une exception (`ctx` dans `edition.ts`), d’autres la transforment en chaîne.

**Pourquoi c’est un problème.** Les clients ne peuvent pas distinguer validation, absence, conflit, indisponibilité externe et erreur serveur. Les messages deviennent une API implicite.

**Risque concret.** Les détails Prisma apparaissent dans la réponse d’une action et les composants doivent tester des textes français. Les retries ou alertes automatiques sont difficiles à implémenter.

**Correction proposée.** Introduire un type d’erreur stable (`code`, `safeMessage`, `details internes`, `retryable`) et un handler unique côté action. Journaliser le détail serveur sans le renvoyer.

**Effort :** moyen. **Risque :** faible à moyen.

### QLT-10 — MOYEN — Les effets “cron” et intégrations sont déclenchés par les pages

**Statut : problème avéré. Fichiers :** `app/layout.tsx`, `lib/deadline-notifications.ts`, `app/actions/brevo.ts`, `helloasso.ts`, `ledger.ts`.

**Description.** `app/layout.tsx` déclenche la passerelle d’échéances à chaque chargement selon le commentaire du code. Les intégrations externes vivent dans le même processus que les requêtes utilisateur et leurs actions administratives.

**Pourquoi c’est un problème.** Le trafic utilisateur devient le déclencheur d’un traitement périodique. Les doublons, délais externes et erreurs réseau se mélangent à la latence d’une page.

**Correction proposée.** Déporter les tâches périodiques vers un worker/cron explicite avec clé d’idempotence, timeout et journal d’exécution. Les pages ne doivent que lire les résultats.

**Effort :** important. **Risque :** moyen ; prévoir une période de double lecture contrôlée.

### QLT-11 — MOYEN — La configuration est dispersée entre scripts, systemd, Playwright et Compose

**Statut : problème avéré. Fichiers :** `package.json`, `next.config.ts`, `playwright.config.ts`, `docker-compose.yml`, `deploy/deploy.sh`, `deploy/systemd/pilote@.service`, `deploy/instances/*.env`.

**Description.** Les ports, bases, secrets de recette, `PILOTE_DEMO`, chemins d’upload et modes de démarrage sont définis à plusieurs endroits. Les recettes Playwright activent explicitement démo et désactivent le rate limit ; le script de déploiement ajoute lui-même `PILOTE_DEMO=1` par défaut.

**Pourquoi c’est un problème.** Une modification de configuration peut être correcte dans un environnement et contredite dans un autre. Le nom `HOSTNAME`, les chemins de build et les variables de base sont particulièrement sensibles.

**Correction proposée.** Définir un schéma de configuration typé, une source par environnement et une validation au démarrage ; générer les fichiers de service depuis cette configuration.

**Effort :** moyen. **Risque :** moyen à important sur le déploiement.

### QLT-12 — FAIBLE — Les dépendances et conventions présentent une dette de génération

**Statut : amélioration recommandée, éléments avérés mais impact variable. Fichiers :** `package.json`, `components/ui/*`, commentaires “prototype”, alias historique `funder`/`organisation`, anciennes migrations.

**Description.** Le dépôt contient beaucoup de composants UI génériques volumineux, des alias historiques, des commentaires de lots successifs et plusieurs mentions de prototype. Ce n’est pas en soi un défaut fonctionnel ; c’est un signal de générations successives et de conventions qui se superposent.

**Risque concret.** Un développeur peut choisir le mauvais helper ou modèle (`funder` versus `organisation`) et reproduire une abstraction déjà existante.

**Correction proposée.** Tenir un catalogue de modules publics, supprimer les alias après migration, imposer une convention de nommage et documenter les points d’extension.

**Effort :** faible à moyen. **Risque :** faible.

## 3. Duplication et code probablement inutilisé

Les duplications les plus coûteuses sont les gardes d’accès, les recherches Prisma par ressource, les contrats `Result`, les conversions de dates/valeurs et les notifications/revalidations. Elles sont avérées par la répétition dans 32 fichiers d’actions ; leur fusion doit rester ciblée, car une abstraction trop générale reproduirait le problème de `saveField`.

Le code mort ne peut pas être affirmé sans analyse de graphe d’import et couverture en production. Les fichiers ou helpers marqués “prototype”, “legacy” ou “historique” sont **à vérifier**, pas à supprimer automatiquement. Aucun outil de couverture n’a été exécuté sur les 44 scénarios dans cet audit ; il faut donc distinguer “non référencé statiquement” de “inutilisé en production”.

## 4. Dépendances circulaires et conventions

Les imports sont majoritairement organisés par alias `@/`, avec des modules `lib` appelés depuis pages et actions. Une boucle d’import complète n’a pas été démontrée par un graphe dédié : **À vérifier** avec `madge` ou un équivalent sur un build propre. Les dépendances qui méritent une attention particulière sont `lib/session` ↔ autorisation/roles, `lib/fields` ↔ actions/fields et les modules de formatage importés par les deux couches.

Le nommage est globalement lisible, mais plusieurs vocabulaires coexistent : `funder`/`organisation`, `edition`/`fiche`, `person`/`actor`, états chaîne en anglais et labels français. Ce n’est pas une préférence stylistique lorsque ces noms traversent Prisma, actions et UI : c’est une source de mapping implicite à documenter.

## 5. Ce qui fonctionne correctement

- Les règles métier importantes sont souvent accompagnées de commentaires et de fonctions nommées (`canWriteLayer`, `canDecideValidation`, `allocationCheck`).
- Le schéma Prisma contient des relations et index explicites, et les migrations sont versionnées.
- Les tests Playwright couvrent plusieurs parcours transverses et les tests unitaires de vocabulaire passent dans l’environnement isolé.
- Les composants riches et les formulaires ont des `data-testid`, ce qui facilite les tests de parcours.
- Le code utilise TypeScript et Prisma plutôt que des requêtes SQL construites à la main.

Ces points réduisent le coût d’une refactorisation, à condition de préserver les contrats observés avant de déplacer les responsabilités.

## 6. Plan d’amélioration recommandé

1. Geler les comportements attendus par tests de commandes et de permissions.
2. Retirer progressivement les états métier de `saveField`.
3. Créer un premier service de requêtes/commandes pour l’agrégat Edition.
4. Unifier le contrat d’erreur et la transaction des commandes.
5. Extraire l’administration et les contacts en view-models et sections.
6. Centraliser la configuration et séparer les traitements périodiques.
7. Migrer les représentations historiques et réduire les alias.

## TOP 10 des problèmes architecturaux à traiter

1. `saveField` comme second moteur métier et voie de contournement des invariants.
2. Contrôle d’accès dispersé entre pages, actions, exports et middleware.
3. Accès Prisma direct depuis les pages et composants serveur.
4. Server Actions trop larges, mélangeant commande, persistance et effets UI.
5. Transactions incomplètes et effets secondaires non idempotents.
6. Déclenchement de traitements périodiques depuis `layout.tsx`.
7. Gros fichiers d’administration, contacts et tâches.
8. Représentations historiques et nouvelles du même domaine.
9. Contrats d’erreur et typage des états trop permissifs.
10. Configuration répartie et comportements divergents selon l’environnement.

## Limites

Cet audit est statique et orienté maintenabilité. Il n’a pas mesuré la couverture réelle, la charge, le temps de compilation en CI, les cycles d’import avec un graphe dédié, ni l’usage de chaque route en production. Les qualifications “problème avéré” portent sur la structure observée ; “À vérifier” est conservé lorsque l’absence d’usage ou une dépendance circulaire ne peut pas être démontrée par le dépôt seul.
