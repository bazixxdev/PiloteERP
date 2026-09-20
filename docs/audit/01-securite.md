# Audit de sécurité approfondi — PiloteERP

**Référence auditée :** `bazixxdev/PiloteERP`, branche `main`, commit `3a0a6144474edb1aa1c7554ac68ea545251e74c4`. Tests réalisés le 19 septembre 2026 ; rapport finalisé le 20 septembre 2026. La référence n'a pas été actualisée pendant l'audit.

**Périmètre :** code, migrations, dépendances verrouillées, historique accessible, configurations et scripts du dépôt ; essais sur une instance exclusivement locale. Ce rapport prolonge [la cartographie](00-cartographie.md). **Aucune correction du code applicatif n'a été effectuée.**

## 1. Avis avant mise en production

**Avis défavorable pour une mise en production avec des données réelles en l'état.** Une session de contributeur suffit à lire les liens de réinitialisation d'autres utilisateurs, puis à prendre le contrôle d'un compte administrateur. Cette chaîne a été reproduite de bout en bout sur des comptes fictifs, en mode production, avec `PILOTE_DEMO=0`.

D'autres défauts indépendants permettent de télécharger des exports sans session, de lire une note privée par une autre page, de contourner les niveaux de validation financière, de modifier une enveloppe sans la permission budgétaire et d'ajouter une pièce à une validation tierce déjà approuvée. Ces constats ne reposent pas seulement sur l'absence apparente d'un garde : les voies normalement refusées ont été comparées aux voies de contournement et les effets vérifiés en base.

Des protections sont effectives : sessions Better Auth vérifiées côté serveur, mots de passe hachés, révocation des sessions lors d'une désactivation, rejet des origines hostiles sur les opérations testées, limitation des tentatives de connexion, contrôles de propriétaire sur plusieurs modules et liste blanche des champs éditables. Leur application inégale entre pages, exports et actions est le problème architectural principal.

La configuration de déploiement ajoute des risques : mode démonstration activé par défaut, utilisateur Unix commun aux instances, écoute Next non réellement limitée par la variable `HOSTNAME`, secrets porteurs dans les URL et garanties de sauvegarde insuffisantes. **L'état réel du serveur, du pare-feu, des permissions et des secrets est À confirmer** : aucun accès à l'infrastructure n'a été réalisé.

Ce rapport est un audit applicatif approfondi avec tests ciblés ; il ne constitue ni une certification d'absence de faille, ni un audit de charge, ni un test d'intrusion de l'infrastructure de production.

## 2. Méthode, environnement et niveaux de preuve

### 2.1 Isolation et opérations réalisées

Le travail a été effectué dans un clone indépendant :

```text
/private/tmp/piloteerp-audit-20260919.bVSGif/repo
```

Les outils, preuves et données de recette sont dans le répertoire parent. La copie de travail de l'utilisateur et ses bases n'ont pas servi à exécuter l'application. Les exécutables Node et dépendances ont été copiés en lecture depuis des installations existantes puis utilisés dans l'espace isolé ; les versions directes ont été comparées au verrou du snapshot.

Les processus de recette ont été confinés avec `sandbox-exec` : pas de lecture de `/Users` ni `/Volumes`, écritures limitées à l'espace d'audit, réseau limité aux ports de boucle locale de recette et au socket PostgreSQL privé. Aucun secret ou jeu de données de production n'a été copié. Aucun appel aux services Brevo, HelloAsso, Pennylane ou au VPS n'a été exécuté. La consultation publique des avis de sécurité est distincte de ces tests.

| Élément | Configuration et résultat |
|---|---|
| Runtime d'audit | Node 26.8.2, npm 11.19.1 ; version de production réelle **À confirmer** |
| Application | Next 15.5.25, React/React DOM 19.1.0, Better Auth 1.7.5, Prisma 6.19.3 |
| Base | Cluster PostgreSQL privé, socket sous l'espace d'audit, port logique 55489, aucune écoute TCP |
| Identité DB applicative | `pilote_security`, sans SUPERUSER, CREATEDB ni CREATEROLE |
| Reconstruction | `createdb`, `prisma generate`, `prisma migrate deploy` : 17 migrations ; `npm run seed` puis fixtures fictives |
| Mode d'exécution | `next build` puis `next start --hostname 127.0.0.1 --port 19031`, `PILOTE_DEMO=0`, quotas d'authentification actifs |
| Identités de test | Contributeurs de pôles différents, membre d'équipe, pilote, direction, RAF, personne ensuite désactivée |
| Build et tests existants | Build production réussi, contrôles TypeScript/lint du build réussis ; `npm run test:unit` : 7/7 |
| Navigateurs | Chromium Playwright local ; destinations frontend interceptées, aucune navigation externe |
| Arrêt | Serveur de recette et PostgreSQL privé arrêtés après les tests ; non redémarrés pour rédiger ce rapport |

La récupération Google Fonts a été remplacée par le mécanisme de mock prévu par Next, via une variable d'environnement et un fichier hors dépôt. Cela évite tout trafic externe et affecte uniquement les ressources de police de la recette. Aucun module applicatif ni contrôle d'accès n'a été remplacé.

Les 44 fichiers Playwright existants ont été pris en compte dans la cartographie ; **la suite E2E complète n'a pas été exécutée dans cette phase**. Sa configuration active le mode démo et désactive les quotas ; elle ne constitue donc pas, seule, une preuve de séparation des droits en production. Les tests de sécurité ci-dessous utilisent de vraies sessions distinctes, sans impersonation de démonstration.

### 2.2 Interprétation des statuts

- **CONFIRMÉ** : fait établi par reproduction ou par un chemin de code complet et déterministe. La nature de la preuve est indiquée. Pour une dépendance, cela peut confirmer la version affectée sans confirmer une exploitation du produit.
- **PROBABLE** : chemin crédible, mais un effet ou une condition nécessaire n'a pas été reproduit.
- **À VÉRIFIER** : preuve insuffisante ou paramètre extérieur au dépôt. La formulation **« À confirmer »** précise les inconnues. Ces points ne sont pas présentés comme des compromissions avérées.

Les sévérités sont contextuelles : **CRITIQUE** pour la prise de contrôle administrateur ; **ÉLEVÉ** pour une rupture importante de confidentialité, d'intégrité ou de séparation ; **MOYEN** pour un impact plus limité ou conditionnel ; **FAIBLE** pour une divulgation technique limitée. Les mesures préconisées restent des recommandations : aucune n'a été appliquée.

### 2.3 Sources des preuves

Les résultats expurgés sont conservés hors dépôt dans `security-evidence/core.json`, `extra.json`, `final-checks.json` et `unit-tests.log`. Les tests et résultats frontend sont dans `security-tests/frontend-*.mjs` et `frontend-*-results.json`. Les scénarios essentiels sont repris ci-dessous pour que le rapport reste compréhensible sans ces fichiers.

Les appels Server Actions ont été effectués via le protocole HTTP normal, avec les références d'action du build et une origine concordante. Les fixtures en base servent à établir les préconditions ; les décisions, mutations et contrôles observés sont ensuite exercés par HTTP. Aucune désactivation des gardes applicatifs n'a été utilisée.

Les sessions, mots de passe et jetons de recette ne figurent pas dans ce rapport. Les identifiants d'actions varient à chaque build et ne sont pas des secrets d'autorisation.

## 3. Registre des constats

| ID | Sévérité | Statut principal | Constat |
|---|---|---|---|
| SEC-01 | CRITIQUE | CONFIRMÉ — HTTP | Prise de compte via la boîte de réinitialisation lisible par un contributeur |
| SEC-02 | ÉLEVÉ | CONFIRMÉ — HTTP | Exports de fiches et plan opérationnel sans authentification effective |
| SEC-03 | ÉLEVÉ | CONFIRMÉ — HTTP | Exports globaux et jeton permanent accessibles aux rôles ordinaires |
| SEC-04 | ÉLEVÉ | CONFIRMÉ — HTTP | Notes privées divulguées par la fiche convention |
| SEC-05 | ÉLEVÉ | CONFIRMÉ — HTTP/DB | Niveau de validation falsifiable, y compris zéro |
| SEC-06 | ÉLEVÉ | CONFIRMÉ — HTTP/DB | Modification budgétaire par proposition sans permission budgétaire |
| SEC-07 | ÉLEVÉ | CONFIRMÉ — HTTP/DB | Pièce jointe rattachable à une validation tierce incompatible |
| SEC-08 | MOYEN | CONFIRMÉ — HTTP/DB | Flux ICS maintenu après désactivation |
| SEC-09 | MOYEN | CONFIRMÉ — HTTP | Anciennes sessions conservées après reset du mot de passe |
| SEC-10 | MOYEN | CONFIRMÉ — HTTP/DB | Suppression de contacts tiers et perte de références d'adhésion |
| SEC-11 | MOYEN | CONFIRMÉ — HTTP/DB | Copie de temps dans un mois clôturé |
| SEC-12 | MOYEN | CONFIRMÉ — HTTP/DB | Ancienne tâche conservant des droits sur une demande réattribuée |
| SEC-13 | MOYEN | CONFIRMÉ — fonction réelle/parseur | Formules non neutralisées dans les exports CSV |
| SEC-14 | MOYEN | CONFIRMÉ — navigateur/composant | Réécriture de l'onglet d'origine par un lien de note |
| SEC-15 | MOYEN | CONFIRMÉ — navigateur, conditionnel | Redirection hors origine après connexion sans basePath |
| SEC-16 | FAIBLE | CONFIRMÉ — HTTP | Messages Prisma renvoyés au client |
| SEC-17 | MOYEN | CONFIRMÉ — HTTP | Lecture anonyme du disponible budgétaire par Server Action |
| SEC-18 | ÉLEVÉ | CONFIRMÉ — version/chemin | SheetJS vulnérable sur les imports |
| SEC-19 | MOYEN | CONFIRMÉ — version | PostCSS vulnérable imbriqué dans Next |
| SEC-20 | ÉLEVÉ | CONFIRMÉ — configuration | Déploiement en mode démo par défaut |
| SEC-21 | ÉLEVÉ | CONFIRMÉ — configuration | Instances clientes sous la même identité système |
| SEC-22 | ÉLEVÉ | CONFIRMÉ — configuration/CLI | Limitation loopback non appliquée par le lancement fourni |
| SEC-23 | MOYEN | CONFIRMÉ — configuration/code | Jetons journalisables et traçabilité de sécurité incomplète |
| SEC-24 | MOYEN | CONFIRMÉ — code conditionnel | Toute URL HTTP assimilée à la recette locale |
| SEC-25 | MOYEN | CONFIRMÉ — configuration dev | PostgreSQL Compose publié largement avec identifiants fixes |
| SEC-26 | MOYEN | CONFIRMÉ — script | Déploiement sans garanties suffisantes sur secrets et sauvegarde |
| SEC-27 | MOYEN | CONFIRMÉ — HTTP/DB | Champs génériques contournant les invariants spécialisés |
| SEC-28 | MOYEN | CONFIRMÉ — HTTP/DB | Suppression indirecte d'un paiement reçu par cascade |
| SEC-29 | MOYEN | PROBABLE — lecture | Décisions concurrentes de proposition non sérialisées |

### SEC-01 — Prise de compte par lecture des liens de réinitialisation

**Sévérité : CRITIQUE. Statut : CONFIRMÉ, reproduction HTTP de bout en bout.**

**Fichiers/lignes :** `app/admin/page.tsx:51-52,67-72,281-289` ; `lib/auth.ts:33-44` ; gardes des opérations d'administration dans `app/actions/accounts.ts:16-19,71-78`.

**Description et scénario :** `canAdmin(me)` produit un booléen d'édition `rw`, mais n'interdit pas la lecture de la section Comptes. La requête charge les courriers non remis, puis leur lien est rendu même quand `rw=false`. Un contributeur connecté connaît ou lit l'adresse d'un administrateur, demande publiquement sa réinitialisation, lit le nouveau lien dans `/admin?section=comptes` et choisit un mot de passe pour ce compte. Les invitations préparées dans cette même boîte ont la même exposition lorsqu'elles sont présentes.

**Impact :** prise de contrôle de comptes de direction/RAF, accès et modification de l'ensemble des données selon leurs permissions. L'attaquant a besoin d'un compte ordinaire, pas d'un accès à la messagerie du destinataire.

**Preuve :** `core.json/outboxLeak` : section accessible, lien de reset présent ; `resetAccountTakeover` : reset HTTP 200 puis authentification avec le nouveau mot de passe de l'administrateur réussie. Le test utilise une demande publique de reset, pas l'action administrative protégée. L'URL sensible n'est pas reproduite ici.

**Neutralisations vérifiées :** `sendResetLink` est correctement refusée au contributeur ; le jeton est à usage unique (second emploi : 400) et limité à une heure par configuration. Ces protections ne neutralisent pas sa lecture pendant sa validité. Les cookies HttpOnly et la protection CSRF ne protègent pas une lecture explicitement autorisée à tort par le serveur. Le rideau Basic Nginx limite les personnes atteignant l'application mais ne sépare pas les rôles internes.

**Correctif recommandé :** contrôler `admin.manage` avant tout chargement de comptes, courriers et liens ; exclure ces données des réponses HTML/RSC non autorisées. Préférer une remise sécurisée au destinataire avec usage unique et traçabilité. Réexaminer la rotation des liens encore valides après correction.

**Test de non-régression à créer :** sessions contributeur/pilote/direction distinctes ; demande de reset et invitation fictives ; vérifier l'absence du lien et du corps du courrier dans HTML, RSC et réponses d'actions pour les non-administrateurs, puis vérifier le parcours légitime.

### SEC-02 — Exports accessibles sans session avec un jeton invalide

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ, HTTP.**

**Fichiers/lignes :** `middleware.ts:8-14` ; `app/plan-operationnel/export/route.ts:12-18` ; `app/edition/[id]/export/route.ts:11-16`.

**Description et scénario :** le middleware laisse passer les chemins terminant par `/export` dès qu'un paramètre `jeton` non vide existe. Ces deux handlers ne vérifient ensuite ni session ni jeton. Un visiteur atteignant Next demande le plan annuel avec `?jeton=x`, puis une fiche s'il en connaît l'identifiant.

**Impact :** divulgation des fiches, données de pilotage et contenus inclus dans les exports. Le plan opérationnel ne nécessite pas de deviner l'identifiant d'une édition.

**Preuve :** sans cookie, `GET /plan-operationnel/export` retourne 401 ; avec `?jeton=x`, 200 et un document Word. `GET /edition/<fixture>/export?jeton=x` retourne 200 et du Markdown. Même jeton invalide sur `/admin/export` : 401, contrôle témoin.

**Neutralisations vérifiées :** garde middleware présent mais optimiste ; ces handlers ne passent pas par `exportAllowed`. La protection Basic du proxy peut limiter l'exposition externe : son activation et l'accessibilité directe de Next sont **À confirmer**. Le défaut applicatif est indépendant de cette condition réseau.

**Correctif recommandé :** authentifier et autoriser dans chaque handler ; appliquer une politique commune aux exports, avec jeton effectivement vérifié si ce mode est conservé.

**Test de non-régression à créer :** absence de cookie, cookie factice/expiré, jeton vide/invalide/révoqué/valide ; tester formats Markdown et Word et plan annuel. Les cas non autorisés doivent être rejetés avant requête métier et génération du document.

### SEC-03 — Exports globaux et secret porteur accessibles aux rôles ordinaires

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ, HTTP.**

**Fichiers/lignes :** `lib/export-auth.ts:5-12` ; `app/admin/export/route.ts:14-38` ; `app/admin/page.tsx:334-349` ; `app/cloture/export/route.ts` et `app/matrice/export/route.ts`, appels de `exportAllowed`.

**Description et scénario :** la branche session vérifie seulement l'existence de `session.user`, sans permission d'export ni périmètre métier. La section Données affiche également `settings.apiToken` à un contributeur. Celui-ci peut copier ce secret et l'utiliser indépendamment de sa session.

**Impact :** extraction globale des neuf ensembles exportés : personnes, projets, éditions, actions, financements, livrables, temps avec commentaires, dépenses et validations. Il ne s'agit pas d'un dump de toutes les tables : les hashes de mots de passe ne figurent pas dans cet export. Le jeton global n'est pas attaché à l'utilisateur et échappe à sa révocation de session.

**Preuve :** contributeur : export JSON global 200, clôture 200, matrice 200 ; trésorerie 403 en témoin. Jeton présent dans la page Données et export anonyme avec ce jeton : 200 (`core.json/apiTokenLeak`).

**Neutralisations vérifiées :** jeton invalide refusé par ce helper ; sessions factices refusées ; désactivation normale supprime les sessions. Aucune de ces protections ne retire un jeton partagé déjà copié. La lecture large des projets peut être intentionnelle ; la politique exacte des exports individuels de temps et des données financières est **À confirmer**. L'exposition du secret porteur à un rôle ordinaire est démontrée.

**Correctif recommandé :** définir une permission d'export et le périmètre de chaque jeu ; résoudre une personne active ; masquer le secret aux rôles non habilités ; remplacer le secret global par des accès révocables, limités en portée et attribués à un usage.

**Test de non-régression à créer :** matrice rôles × exports × périmètres ; départ d'un utilisateur ; invalidation d'une clé ; absence de secrets dans HTML/RSC des comptes ordinaires.

### SEC-04 — Note privée divulguée par la fiche convention

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ, HTTP.**

**Fichiers/lignes :** `app/conventions/[id]/page.tsx:27-31,124,176` ; `app/conventions/[id]/lifecycle.tsx:67` et rendu des notes ; comparaison avec `lib/notes.ts:83-99`.

**Description et scénario :** la fiche convention charge toutes les `notesLinked`, sans appliquer `canReadNote`, puis les transmet à `DossierWorkspace`. Un utilisateur qui peut lire le dossier reçoit le corps d'une note privée liée, même s'il n'en est ni l'auteur ni un destinataire.

**Impact :** rupture de confidentialité de notes explicitement privées ; le masquage d'une entrée de navigation n'empêche pas la divulgation dans HTML/RSC.

**Preuve :** note privée fictive de l'acteur pilote, liée à une convention : le marqueur `AUDIT_PRIVATE_DOSSIER_SENTINEL` est absent de `/notes?note=<id>` pour un contributeur d'un autre pôle, mais présent dans `/conventions/<id>`.

**Neutralisations vérifiées :** les lecteurs centraux `loadNotes/loadNote` et les actions de modification vérifient correctement la visibilité ou l'auteur. Le chemin Convention les contourne ; le mode lecture seule ne filtre pas le contenu.

**Correctif recommandé :** appliquer la politique de visibilité avant la sérialisation des notes et utiliser le même service de lecture dans tous les contextes.

**Test de non-régression à créer :** note privée/pôle/tous/partage nominatif, auteur et tiers de chaque pôle, consultation directe et via dossier/édition ; rechercher une sentinelle dans le corps des réponses, pas seulement dans le DOM affiché.

### SEC-05 — Niveau de validation fourni par le demandeur, y compris zéro

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ, HTTP et vérification DB.**

**Fichiers/lignes :** `app/actions/edition.ts:91-112,146-157` ; `lib/rights.ts:123-138`.

**Description et scénario :** `requestValidation` calcule un niveau puis le remplace par `input.requiredLevel` sans bornage. Le décideur est comparé à ce niveau falsifié. Un demandeur distinct soumet une dépense importante avec niveau zéro sur un projet piloté par un contributeur de niveau zéro ; ce pilote peut approuver.

**Impact :** dépense engagée sans le niveau de validation nécessaire. La création effective d'un engagement est démontrée, sans affirmer qu'un paiement bancaire externe est déclenché.

**Preuve :** même montant fictif de 999 999 : calcul normal niveau 3, approbation par contributeur refusée ; demande avec `requiredLevel=0`, approbation acceptée, statut `approved`, enregistrement Expense créé (`core.json`).

**Neutralisations vérifiées :** session active, droits depuis la base, refus de l'autoapprobation et mise à jour conditionnelle contre une double décision. Le test emploie deux personnes distinctes. Le commentaire autorise une modification manuelle du niveau : l'étendue souhaitée de cette dérogation est **À confirmer** ; accepter zéro contredit explicitement le rôle « informée, pas valideuse ».

**Correctif recommandé :** imposer un niveau serveur entre 1 et 3, exclure tout décideur de niveau zéro ; recalculer les seuils côté serveur et réserver les dérogations à une permission explicite avec justification.

**Test de non-régression à créer :** niveaux 0, négatif, inférieur au calcul, supérieur à 3, non entier ; décideurs de chaque niveau ; autoapprobation ; vérifier l'absence d'Expense après refus.

### SEC-06 — Budget modifié par proposition sans permission budgétaire

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ, HTTP/DB.**

**Fichiers/lignes :** `app/actions/proposals.ts:13-22,35-52` ; `lib/fields.ts:47-48` ; `app/actions/fields.ts:23-32` ; `lib/rights.ts:41-42`.

**Description et scénario :** les propositions acceptent les champs de la couche budget. Un membre propose un changement d'enveloppe ; le pilote accepte avec son droit de décision sur la fiche, sans vérification de `fiche.budget`.

**Impact :** modification de l'enveloppe, et potentiellement du réalisé via le champ autorisé, en dehors de la séparation financière prévue.

**Preuve :** `saveField(edition, budgetEnvelope)` refusé au pilote ; proposition du membre acceptée par ce même pilote ; enveloppe devenue 123 456 en base.

**Neutralisations vérifiées :** liste blanche des champs, appartenance à l'équipe, auteur distinct du décideur, transaction et historique. Ces contrôles exigent deux acteurs dans ce scénario mais ne rétablissent pas la permission financière.

**Correctif recommandé :** appliquer à la décision les droits de la couche concernée ; borner le dispositif de proposition aux champs et états prévus.

**Test de non-régression à créer :** refus d'acceptation d'une proposition budgétaire par un pilote sans permission, acceptation par un rôle habilité, conservation de la valeur après refus ; tester `budgetEnvelope` et `spent`.

### SEC-07 — Rattachement de pièces à des objets tiers incompatibles

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ, HTTP multipart et DB.**

**Fichiers/lignes :** `app/actions/attachments.ts:27-46` ; `prisma/schema.prisma:993-1006` ; `app/demandes/page.tsx:32,68` ; `app/validations/[id]/bon-pour-accord/page.tsx:27`.

**Description et scénario :** les droits portent sur `editionId`, mais `validationId`, `fundingLineId` et `deliverableId` sont enregistrés indépendamment. Un pilote de l'édition A joint un fichier à A avec l'identifiant d'une validation B appartenant à un tiers et à une autre édition.

**Impact :** pollution des justificatifs d'un dossier tiers, y compris après approbation ; incohérence entre l'édition déclarée de la pièce et sa cible. Le nom de la pièce peut entrer dans le bon pour accord de B.

**Preuve :** upload texte inoffensif accepté ; pièce créée sur A et validation B déjà `approved`, demandeur différent du déposant ; bon pour accord de B contenant le nom du fichier (`extra.json`).

**Neutralisations vérifiées :** session, taille, MIME déclaré, stockage aléatoire et FK valides. Aucune FK ne prouve la cohérence des parents. La possibilité de joindre sa propre demande sur une édition tierce peut être voulue : ce n'est pas le scénario retenu.

**Correctif recommandé :** résoudre la cible la plus spécifique côté serveur, vérifier ses droits et son état, en déduire l'édition ; rejeter les rattachements contradictoires avant écriture disque.

**Test de non-régression à créer :** matrice de parents compatibles/incompatibles, validation d'autrui pending/approved, ligne/livrable étrangers, absence de fichier et de ligne DB orphelins après rejet.

### SEC-08 — Flux ICS encore actif après désactivation

**Sévérité : MOYEN. Statut : CONFIRMÉ, HTTP/DB.**

**Fichiers/lignes :** `app/api/agenda/[token]/route.ts:15-17` ; `lib/ics.ts:60-73` ; `app/actions/fields.ts:111-120`.

**Description et scénario :** le jeton personnel ICS identifie une Person sans contrôle de `active`. La désactivation retire les sessions, mais ni le jeton ni l'accès au flux. Un ancien salarié conserve l'abonnement enregistré dans son agenda.

**Impact :** lecture persistante de tâches, créneaux et échéances inclus dans ce flux, avec mises à jour après départ ; portée dépendant du rôle et des rattachements conservés.

**Preuve :** après désactivation par action normale : zéro session et export avec ancien cookie 401 ; même URL ICS 200. Une tâche sentinelle ajoutée ensuite à la personne désactivée apparaît dans le flux (`extra.json`, `final-checks.json`).

**Neutralisations vérifiées :** jetons aléatoires et fonctions de rotation existent ; elles ne sont pas déclenchées par cette désactivation. Le jeton équipe partagé nécessite aussi une politique de départ.

**Correctif recommandé :** refuser les personnes inactives et révoquer/renouveler les accès porteurs lors du départ ; traiter séparément le partage du flux équipe.

**Test de non-régression à créer :** abonnement actif puis désactivation, réactivation, rotation, départ ; ancienne URL inutilisable et aucune nouvelle donnée exposée.

### SEC-09 — Reset du mot de passe sans révocation des sessions

**Sévérité : MOYEN. Statut : CONFIRMÉ, HTTP.**

**Fichiers/lignes :** `lib/auth.ts:33-45` ; Better Auth installé `node_modules/better-auth/dist/api/routes/password.mjs:171` ; comparaison `app/actions/accounts.ts:102-119`.

**Description et scénario :** la configuration n'active pas `revokeSessionsOnPasswordReset`. Après récupération d'un compte supposé compromis, une session déjà dérobée continue à fonctionner.

**Impact :** maintien d'un accès malgré changement de mot de passe par le parcours de récupération. L'impact suppose une session préexistante possédée par un tiers.

**Preuve :** ouverture d'une session RAF, reset réussi (200), puis appel de `/tresorerie/export` avec l'ancien cookie toujours accepté (200), dans `final-checks.json/resetLeavesSession`.

**Neutralisations vérifiées :** token de reset à usage unique, expiration configurée ; action « Déconnecter partout » et changement depuis Mon compte révoquent les sessions selon leur logique. Ces opérations distinctes ne sont pas automatiquement exécutées par le reset public.

**Correctif recommandé :** révoquer les sessions à la réinitialisation, avec parcours de reconnexion explicite et notification de sécurité.

**Test de non-régression à créer :** deux sessions antérieures, reset, contrôle des deux cookies, nouvelle connexion acceptée ; conserver un test distinct du changement authentifié.

### SEC-10 — Suppression de contacts tiers avec créateur absent

**Sévérité : MOYEN. Statut : CONFIRMÉ, HTTP/DB.**

**Fichiers/lignes :** `app/actions/contacts.ts:45-51,358-359` ; `app/actions/funders.ts:38-50` ; `prisma/schema.prisma:802,1256`.

**Description et scénario :** la suppression unitaire ne contrôle le créateur que lorsqu'il est renseigné. Or la création via financeur peut le laisser nul. Un contributeur tiers supprime ce contact ; les usages adhésion/prêt ne sont pas protégés comme ceux de financement.

**Impact :** perte d'un contact et de son rattachement à des données métier historiques. L'annuaire partagé autorise certaines éditions, mais cela ne démontre pas que la suppression d'un contact utilisé doive être ouverte.

**Preuve :** contact fictif à créateur nul et adhésion existante ; suppression par contributeur acceptée ; contact absent et `Membership.contactId=null` en base.

**Neutralisations vérifiées :** créateur tiers connu protégé, usages de financement comptés ; la suppression groupée protège aussi les adhésions. `deleteFunderContact` a un droit financier mais ne centralise pas ces protections.

**Correctif recommandé :** politique de suppression unique, gestion explicite des créateurs historiques absents, contrôle de tous les usages et archivage si nécessaire.

**Test de non-régression à créer :** contacts issus de chaque création/import, créateur connu/nul, utilisateur tiers, adhésion/prêt/financement associés ; cohérence entre suppressions unitaires et groupées.

### SEC-11 — Copie de temps dans un mois clôturé

**Sévérité : MOYEN. Statut : CONFIRMÉ, HTTP/DB.**

**Fichiers/lignes :** `app/actions/time.ts:50-65` ; comparaison `:16-22,113-115`.

**Description et scénario :** `copyPreviousWeek` contrôle uniquement le mois du lundi cible. Une semaine à cheval sur deux mois peut donc écrire dans le second mois verrouillé.

**Impact :** altération de temps clôturés sans autorisation de déverrouillage RAF ; la copie ne retire pas non plus la déclaration de complétude comme le fait `saveTime`.

**Preuve :** août 2026 ouvert, septembre verrouillé, saisie au 26 août ; copie vers la semaine du 31 août crée une entrée le 2 septembre. Écriture directe le 2 septembre refusée ; copie retourne `copied:1`.

**Neutralisations vérifiées :** restriction à ses propres temps, exclusion de dates futures et doublons. `saveWeekSplit` vérifie chaque journée ; la copie ne réutilise pas ce contrôle.

**Correctif recommandé :** vérifier tous les mois touchés et protéger l'opération contre un verrouillage concurrent ; invalider la complétude après mutation.

**Test de non-régression à créer :** semaines à cheval sur deux mois/années, second mois seul verrouillé, zéro écriture interdite, cohérence MonthLock/TimeEntry/WeekDeclaration.

### SEC-12 — Ancien destinataire conservant un droit via sa tâche

**Sévérité : MOYEN. Statut : CONFIRMÉ, HTTP/DB.**

**Fichiers/lignes :** `app/actions/requests.ts:49-76` ; `app/actions/tasks.ts:13-17,55-59` ; comparaison `requests.ts:38-39`.

**Description et scénario :** A prend une demande, ce qui crée une tâche à son nom. Le demandeur réattribue la demande à B. La tâche d'A demeure liée ; la cocher modifie directement la demande sans revérifier son destinataire courant.

**Impact :** clôture ou réouverture d'une demande après perte des droits et notification trompeuse du demandeur.

**Preuve :** réattribution A→B acceptée ; `setRequestStatus` par A refusée ; `updateTask(done=true)` par A acceptée ; demande devenue `done`.

**Neutralisations vérifiées :** propriétaire de la tâche vérifié ; garde correct sur la voie directe de la demande. Le défaut réside dans la mutation indirecte du second objet.

**Correctif recommandé :** revérifier `canTreatRequest` lors de la synchronisation et définir le devenir des tâches lors d'une réattribution ou d'un départ, de façon atomique.

**Test de non-régression à créer :** réattribution, suppression du destinataire, départ, clôture/réouverture via les deux interfaces ; ancien destinataire privé de la mutation indirecte.

### SEC-13 — Formules exportées dans les cellules CSV

**Sévérité : MOYEN. Statut : CONFIRMÉ pour le CSV et son interprétation comme formule ; effets selon tableur À confirmer.**

**Fichiers/lignes :** `lib/contacts.ts:142-153` ; `app/admin/export/route.ts:7-11`.

**Description et scénario :** l'échappement protège les séparateurs CSV, mais pas les préfixes de formule. Un membre édite une valeur textuelle de l'annuaire ou fait importer un contact puis un autre utilisateur ouvre l'export dans un tableur.

**Impact :** contenu interprété comme formule, calcul ou lien trompeur ; des effets supplémentaires dépendent du tableur et de ses protections. Aucune exécution de commande ni exfiltration réelle par Excel n'est affirmée.

**Preuve :** appel de la vraie fonction `listToCsv` avec une valeur inoffensive `=1+1` ; cellule exportée sans neutralisation et relue par SheetJS comme formule `f:"1+1"` (`frontend-pure-results.json`).

**Neutralisations vérifiées :** droits de lecture des listes et guillemets CSV présents ; les guillemets ne forcent pas une cellule au type texte.

**Correctif recommandé :** stratégie d'export imposant le type texte aux valeurs non fiables ; centraliser le traitement des préfixes de formule et caractères de contrôle pour tous les CSV.

**Test de non-régression à créer :** préfixes `=`, `+`, `-`, `@`, tabulation et retour chariot, valeurs légitimes, ouverture dans les tableurs officiellement pris en charge.

### SEC-14 — Lien de note permettant la réécriture de l'onglet ERP

**Sévérité : MOYEN. Statut : CONFIRMÉ dans le composant Tiptap installé, navigateur.**

**Fichiers/lignes :** `components/common/rich-editor.tsx:15-18` ; `app/actions/notes.ts:14-21` ; `node_modules/@tiptap/extension-link/src/link.ts:322-359` ; `src/helpers/clickHandler.ts:58-64` de cette extension.

**Description et scénario :** un lien HTML de note avec `target="_blank" rel="opener"` conserve cette relation. De plus, le clic en mode éditable passe par un `window.open` sans option `noopener`. Après clic sur un lien externe, sa page peut remplacer la navigation de l'onglet ERP d'origine.

**Impact :** hameçonnage par remplacement d'un onglet de confiance. La politique de même origine interdit la lecture directe de son contenu ; aucun vol direct de cookie n'est démontré.

**Preuve :** composants réels assemblés avec les options du projet, navigation entièrement interceptée : témoin en lecture seule sans `opener` sûr ; variante `rel=opener` et mode éditable avec lien par défaut : `window.opener` présent, onglet parent navigué vers une page de test. Les résultats et le harnais sont conservés.

**Neutralisations vérifiées :** URI `javascript:`/data rejetées par Tiptap et handlers HTML filtrés ; cela ne neutralise pas une destination HTTPS ordinaire. Pas de COOP dans les configurations examinées ; éventuel en-tête ajouté par l'infrastructure **À confirmer**. Test de composant, pas parcours complet de publication de note.

**Correctif recommandé :** forcer `noopener noreferrer`, retirer toute valeur `opener`, contrôler le comportement `openOnClick`/mise à jour de l'extension ; envisager COOP compatible avec les besoins.

**Test de non-régression à créer :** liens de notes partagées en lecture/édition ; vérifier `opener===null` et stabilité de l'onglet parent pour contenu importé ou enregistré par action.

### SEC-15 — Redirection hors origine après connexion

**Sévérité : MOYEN. Statut : CONFIRMÉ dans le navigateur, conditionnel au déploiement sans basePath.**

**Fichiers/lignes :** `app/connexion/page.tsx:7-14` ; `app/connexion/login-form.tsx:19-23`.

La validation `startsWith("/") && !startsWith("//")` accepte une valeur contenant un antislash ou une tabulation. La navigation du navigateur la normalise en URL externe. Le test avec `/\\127.0.0.1:19039/audit-destination` a quitté l'origine après une connexion simulée. Avec un `basePath` correctement appliqué, l'exemple testé reste interne ; la configuration réelle est **À confirmer**.

Impact : hameçonnage après connexion, sans lecture directe du cookie. Correctif : résoudre avec `new URL(next, origin)`, exiger la même origine et un chemin interne normalisé. Tester antislash, contrôles, encodages et basePath vide/non vide.

### SEC-16 — Messages d'erreur Prisma renvoyés au client

**Sévérité : FAIBLE. Statut : CONFIRMÉ HTTP.**

**Fichiers/lignes :** `app/actions/fields.ts:150-160` ; `app/actions/attachments.ts:49-51`.

Les `catch` renvoient directement `err.message`. Une mise à jour vers un identifiant inexistant révèle le nom de l'opération Prisma et la nature de l'erreur. La réponse est utile pour le diagnostic mais inutilement bavarde en production. Remplacer par un message stable et journaliser côté serveur avec identifiant de corrélation. Tester erreurs de contrainte, validation et panne DB sans fuite de schéma, chemin ou requête.

### SEC-17 — Seuils budgétaires lisibles par Server Action non authentifiée

**Sévérité : MOYEN. Statut : PROBABLE, accès anonyme direct à l'action non démontré.**

**Fichiers/lignes :** `app/actions/edition.ts:123-142` ; `lib/session.ts:51-53`.

`explainRequiredLevel` et `computeRequiredLevel` ne chargent pas `getCurrentPerson` et lisent les réglages globaux. Avec une requête Server Action portant un cookie factice, la réponse révèle le niveau et le reste d'enveloppe ; l'appel sans cookie n'a pas fourni de donnée exploitable dans le protocole testé. Le contrôle HTTP exact des routes d'action est donc **À confirmer**. Authentifier l'action et appliquer le périmètre de l'édition. Tester absence, cookie invalide, personne inactive et édition d'un autre pôle.

### SEC-18 — SheetJS affecté sur les chemins d'import

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ pour la version et le chemin ; exploitation produit PROBABLE.**

**Fichiers/lignes :** `package.json:45`, `package-lock.json:13936` (`xlsx 0.18.5`) ; `app/actions/contacts.ts:191-196` ; `lib/pennylane.ts:38-46`.

La version est antérieure aux correctifs publiés pour [CVE-2023-30533/GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (prototype pollution, `<0.19.3`) et [CVE-2024-22363/GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) (ReDoS, `<0.20.2`). Les fichiers de contacts et grands livres sont lus par `XLSX.read`. Les droits d'import et la limite de 6 Mo des Server Actions ne neutralisent pas le coût du parseur. Aucun fichier offensif n'a été exécuté ; prise de contrôle non démontrée. Remplacer par une distribution maintenue ou un parseur isolé, avec limites de temps/mémoire/cellules. Tester corpus hostile, prototypes inchangés et disponibilité d'une requête concurrente.

### SEC-19 — PostCSS vulnérable embarqué sous Next

**Sévérité : MOYEN. Statut : CONFIRMÉ pour la dépendance, exploitabilité applicative À confirmer.**

**Fichiers/lignes :** `package-lock.json:10658` (`next/node_modules/postcss 8.4.31`) ; résolution racine `8.5.28` à `:11395`.

Les avis récents couvrent des versions antérieures à 8.5.10–8.5.22, notamment sorties CSS non échappées, lecture de source maps et traversée de chemins. Aucun chemin d'entrée CSS contrôlé par un utilisateur Pilote n'a été identifié ; le risque vise surtout la chaîne de build et ses entrées. Mettre à jour Next/résolution après compatibilité vérifiée et contrôler les source maps. Tester installation propre, build et absence de lecture de fichiers via CSS non fiable.

### SEC-20 — Mode démonstration activé par défaut au déploiement

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ dans le script ; état des instances À confirmer.**

**Fichiers/lignes :** `deploy/deploy.sh:71-86` ; `prisma/seeds/common.ts:2,109-121` ; `lib/session.ts:29-41`.

Le script ajoute `PILOTE_DEMO=1` si absent et peut lancer le seed. En ce mode, une session valide peut choisir une autre Person active ; le seed prévoit un mot de passe de démonstration constant si aucun remplacement n'est fourni. Si ce chemin a été utilisé avec des données réelles, la séparation des rôles est annulée. L'état réel est **À confirmer**. Refuser le mode démo lorsque `NODE_ENV=production`, séparer bootstrap et fixtures, interdire les mots de passe communs. Tester démarrage production et présence de comptes de recette.

### SEC-21 — Pas d'isolation Unix entre instances

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ dans la configuration ; installation réelle À confirmer.**

**Fichiers/lignes :** `deploy/systemd/pilote@.service:9-10` ; `deploy/deploy.sh:99-100` ; `deploy/instances/cress.env` et `tlst.env`.

CRESS et TLST tournent sous `www-data` et le déploiement attribue récursivement code, données et médias à cet utilisateur, sans `ProtectSystem`, `ReadWritePaths`, `NoNewPrivileges` ni séparation de réseau. Après une compromission initiale d'une instance, les secrets et fichiers de l'autre sont accessibles au même compte Unix. Cela amplifie une compromission ; ce n'est pas une preuve d'exécution de code. Utiliser un utilisateur, des permissions et un confinement par instance ; tester lecture/écriture croisée et code livré en lecture seule.

### SEC-22 — Faux bind loopback via `HOSTNAME`

**Sévérité : ÉLEVÉ. Statut : CONFIRMÉ pour le lancement fourni ; accessibilité réseau À confirmer.**

**Fichiers/lignes :** `deploy/systemd/pilote@.service:15-16` ; `package.json:8`.

Le service définit `HOSTNAME=127.0.0.1` mais lance `next start` sans `--hostname`. Dans Next 15.5.25, cette commande utilise par défaut l'écoute réseau générale ; la variable ne suffit pas pour ce chemin. Si les ports sont accessibles, le proxy TLS, la réécriture de l'IP et ses contrôles peuvent être contournés, notamment pour le rate limit. L'instance d'audit était explicitement liée à loopback ; elle ne valide pas l'infrastructure. Passer `--hostname 127.0.0.1`, filtrer les ports et tester l'écoute depuis un réseau de recette.

### SEC-23 — Jetons présents dans les URL et audit de sécurité incomplet

**Sévérité : MOYEN. Statut : CONFIRMÉ dans les fichiers ; présence dans les logs réels À confirmer.**

**Fichiers/lignes :** `deploy/nginx/cress.bazixx.fr.conf:13,43-48` ; équivalent TLST ; `app/api/agenda/[token]/route.ts:15-17` ; `middleware.ts:8-14`.

Les tokens ICS et export sont porteurs et placés dans le chemin ou la query string. Les configurations Nginx utilisent `access_log` sans format d'occultation ; le format combiné inclut la requête. Un lecteur des logs peut donc récupérer un secret encore valide. Les changements de rôle, changement d'acteur et rotation ICS n'ont pas de journal de sécurité structuré. Masquer les paramètres sensibles, réduire la durée de vie et tracer auteur/cible/résultat. Tester que des tokens synthétiques n'apparaissent dans aucun log et qu'une révocation est auditée.

### SEC-24 — HTTP assimilé à une recette locale

**Sévérité : MOYEN. Statut : CONFIRMÉ dans le code ; paramétrage réel À confirmer.**

**Fichiers/lignes :** `lib/auth.ts:17-18,58-68`.

Toute `BETTER_AUTH_URL` commençant par `http://` désactive les cookies Secure et peut permettre `AUTH_RATE_LIMIT=0` dans certaines conditions. Cela est cohérent pour les recettes locales mais dangereux si une URL de production HTTP est déployée par erreur. Imposer HTTPS et une liste explicite d'environnements de test ; tester la matrice URL/NODE_ENV/quota et les attributs de cookie.

### SEC-25 — PostgreSQL de développement publié avec identifiants fixes

**Sévérité : MOYEN. Statut : CONFIRMÉ dans Compose ; usage réel À confirmer.**

**Fichiers/lignes :** `docker-compose.yml:3-11`.

Le service publie `5432:5432` sans bind loopback et utilise `pilote/pilote`. C'est une configuration de développement, pas une preuve d'exposition de production. Elle devient dangereuse si les données réelles sont utilisées avec ce Compose ou si le port est accessible au réseau. Lier à `127.0.0.1`, générer des identifiants et utiliser un compte applicatif non superutilisateur. Tester publication effective et accès depuis un réseau voisin.

### SEC-26 — Déploiement sans garantie suffisante de secret, backup et rollback

**Sévérité : MOYEN. Statut : CONFIRMÉ dans le script ; identité d'exécution et état réel À confirmer.**

**Fichiers/lignes :** `deploy/deploy.sh:57-88,99-115`.

Le `.env` est copié dans la nouvelle version ; le script ne force pas les permissions de toutes les copies. L'échec de `pg_dump` est ignoré, puis les migrations précèdent le build et le rollback restaure le code sans restaurer la base. Aucune baisse de privilèges n'est imposée pour les opérations d'installation/build ; l'exécution root n'est pas démontrée par le dépôt. Rendre le backup bloquant et vérifié, gérer les migrations backward-compatible, isoler le build des secrets et tester panne de dump/migration et reprise.

### SEC-27 — Champs génériques contournant des invariants métier

**Sévérité : MOYEN. Statut : CONFIRMÉ par comparaison et HTTP.**

**Fichiers/lignes :** `lib/fields.ts:61-86` ; `app/actions/fields.ts:150-154` ; contrôles spécialisés `app/actions/equipment.ts:39-46`, `members.ts:57-73`, `dossiers.ts:56-74`.

La whitelist autorise des mises à jour génériques de champs comme l'état du matériel ou le statut d'adhésion. Les actions spécialisées vérifient pourtant des invariants : un matériel prêt ne doit pas être retiré, un paiement reçu ne doit pas être supprimé, certaines transitions doivent être tracées. Test : `retireEquipment` refuse un matériel prêt, mais `saveField(equipment,state,retired)` réussit et laisse un prêt actif. Centraliser les transitions métier et faire appeler les mêmes invariants par les deux voies. Tester chaque champ par action spécialisée et générique.

### SEC-28 — Paiement reçu supprimé indirectement par cascade

**Sévérité : MOYEN. Statut : CONFIRMÉ HTTP/DB.**

**Fichiers/lignes :** `app/actions/edition.ts:293-300` ; `app/actions/payments.ts:45-51` ; `prisma/schema.prisma:621-628`.

La suppression directe refuse un paiement reçu. La détection d'une ligne « vide » omet cependant les paiements ; `FundingLine` est supprimée et la relation Prisma `onDelete: Cascade` supprime le paiement reçu. Le test a observé le paiement absent après détachement. Inclure les paiements dans le calcul d'usage ou interdire toute suppression lorsque des paiements existent ; tester paiements reçus/non reçus et conventions.

### SEC-29 — Décisions concurrentes de proposition non sérialisées

**Sévérité : MOYEN. Statut : PROBABLE.**

**Fichiers/lignes :** `app/actions/proposals.ts:35-52`.

Le statut `pending` est contrôlé avant la transaction, puis la mise à jour de la proposition n'est pas conditionnée par `status: pending`. Deux décisions concurrentes peuvent toutes deux appliquer ou journaliser une décision alors qu'une seule devrait gagner. Aucune course n'a été déclenchée dans l'environnement arrêté. Utiliser une mise à jour conditionnelle ou un verrou transactionnel et tester deux décisions simultanées avec valeurs différentes.

## 4. Couverture des familles de risques

| Famille | Conclusion auditée |
|---|---|
| Authentification/session | Better Auth avec cookie opaque, HttpOnly et SameSite=Lax ; sessions désactivées correctement ; reset ne révoque pas les sessions (SEC-09). Cookie JWT non utilisé dans le parcours testé. Secret/URL de production **À confirmer**. |
| Autorisation/rôles | Gardes nombreuses et parfois correctes, mais lectures admin, exports, reset, actions indirectes et couches génériques incohérents (SEC-01 à 07, 12, 27). |
| IDOR/objet par objet | Pièces multi-parents, notes convention et contacts démontrés ; téléchargement de pièce exige une session mais pas un périmètre métier supplémentaire : politique de partage **À confirmer**. |
| CSRF/CORS | Origine étrangère sur Server Action rejetée sans mutation ; Auth API répond 403 et aucun `Access-Control-Allow-Origin` hostile n'est émis. En-têtes proxy réels **À confirmer**. |
| XSS/HTML | Dix charges script/événement/URL dangereuse bloquées par Tiptap/React ; contenu HTML reste un format riche contrôlé ; tabnabbing confirmé (SEC-14). CSP/COOP d'infrastructure **À confirmer**. |
| SQL/NoSQL/commande | Prisma paramétré, aucun appel SQL brut ou `child_process` alimenté par une entrée utilisateur trouvé dans les chemins examinés. Triggers/DB externe **À confirmer**. |
| SSRF | URL Pennylane est construite par le connecteur, pas fournie directement par l'utilisateur dans le chemin identifié. Un faux fetch localhost a été possible dans le harnais ; validation de réponse et allowlist fournisseur restent **À confirmer**. |
| Upload/path traversal | MIME, taille 5 Mo, nom de stockage aléatoire sous `UPLOAD_DIR` ; nom d'origine n'est pas utilisé comme chemin. Cohérence de rattachement défaillante (SEC-07), contenu réellement analysé **À confirmer**. |
| Secrets | Aucun secret de production identifiable dans 2 573 blobs atteignables ; ancien `.env` avec identifiants de développement loopback retrouvé dans l'historique et retiré. Recherche heuristique : absence de secret non prouvée. |
| Dépendances | `xlsx` affecté sur des imports (SEC-18) ; PostCSS imbriqué affecté (SEC-19) ; Next 15.5.25 et Better Auth 1.7.5 hors des avis ciblés examinés. Pas de statut global « toutes sûres » : aucun `npm audit` exhaustif. |
| Rate limiting/brute force | 5 échecs/minute puis 429 sur la même IP synthétique ; quota mémoire et confiance aux headers si accès direct : déploiement à confirmer. Énumération reset : réponses à comparer sur instance réelle. |
| Logs/erreurs | P2025 exposé (SEC-16), jetons URL journalisables (SEC-23), audit de sécurité incomplet. Rétention/format effectifs **À confirmer**. |
| Isolation organisations/clients | Pas de RLS multi-tenant identifiée ; séparation semble par instances/bases et permissions applicatives. Isolation Unix défaillante dans la configuration fournie (SEC-21). Modèle d'organisation métier exact **À confirmer**. |

## 5. Priorités de remédiation recommandées

Avant toute exposition de données réelles :

1. Fermer la lecture de la boîte de réinitialisation et des comptes aux administrateurs autorisés ; révoquer les sessions au reset ; auditer/rotater les liens déjà émis.
2. Fermer les exports au niveau de chaque handler et appliquer une permission/périmètre ; ne jamais rendre le `apiToken` aux rôles ordinaires.
3. Recalculer et borner le niveau de validation ; aligner propositions et écritures budgétaires ; vérifier la cohérence des parents de pièces.
4. Filtrer les notes par visibilité dans chaque page ; révoquer ICS à la désactivation ; corriger les invariants indirects (temps, matériel, paiements, tâches, contacts).
5. Désactiver le mode démo par défaut, isoler les instances Unix, binder explicitement Next à loopback et vérifier ports/proxy/headers sur la machine réelle.
6. Remplacer ou isoler SheetJS, résoudre PostCSS, neutraliser les cellules CSV, supprimer les erreurs Prisma et masquer les jetons dans les logs.

Ces actions sont une feuille de route d'audit ; elles n'ont pas été appliquées dans cette phase.

## 6. Questions restant ouvertes

Les points suivants exigent une décision métier ou un accès d'infrastructure avant de conclure :

- Les exports de clôture, matrice et plan opérationnel doivent-ils être accessibles à tout contributeur connecté, ou seulement à certains rôles/pôles ?
- Une dérogation manuelle au niveau de validation est-elle voulue ? Si oui, qui peut la justifier et le niveau zéro peut-il décider ?
- Les contacts, dossiers, pièces et temps sont-ils strictement cloisonnés par organisation/pôle ou partagés par conception ?
- Quelle est la politique de révocation d'un flux ICS lors d'un départ et pour le flux d'équipe ?
- Le mode `PILOTE_DEMO` a-t-il déjà été neutralisé dans chaque instance réelle ? Quels ports Next sont accessibles depuis le réseau ?
- Les permissions Unix, systemd, Nginx, TLS, Basic Auth, rotation et rétention des logs correspondent-elles aux fichiers fournis ?
- Les secrets historiques de développement ont-ils été changés et les branches/tags non accessibles à l'audit ont-ils été scannés ?
- Quelle distribution maintenue de SheetJS ou quel parseur de remplacement est retenu ? Les imports acceptent-ils des fichiers fournis par des tiers non fiables ?
- Faut-il conserver l'HTML riche dans les notes, et quelles règles de liens externes (opener, domaines, COOP/CSP) sont attendues ?
- Quel niveau de tests de concurrence, de charge, de restauration et de reprise est exigé avant mise en production ?

## 7. Limites et conclusion

L'audit démontre plusieurs chaînes exploitables dans une instance reconstruite localement et fictive. Il n'a pas inspecté le VPS, le pare-feu, les secrets hors dépôt, les logs réels, les sauvegardes ou les branches non fournies. Les résultats de configuration sont donc séparés des résultats runtime et portent explicitement leur statut. Le code applicatif n'a pas été corrigé, committé ou poussé.

La mise en production doit rester bloquée jusqu'à fermeture au minimum de SEC-01 à SEC-07, puis re-test des parcours d'administration, exports, validations financières et séparation d'instances.
