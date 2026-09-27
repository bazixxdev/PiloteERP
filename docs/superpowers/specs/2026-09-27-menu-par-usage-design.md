# Menu rangé par usage — préconisations

**Date** : 27/09/2026 · **Statut** : préconisations issues d'un échange avec Gaël, **rien de codé**. Les points marqués ✅ sont validés par Gaël. **Les points ouverts ont tous été tranchés par Gaël le 27/09 (§ 6)** ; les tableaux en tiennent compte.

**Mise à jour du 27/09 (après-midi)** : relu sur l'état réel du code de la branche `feat/actions-composantes` (plan « actions composantes », tâches 1 à 20). Ce qui a changé depuis le matin : « Ma délégation » n'existe plus (remplacée par « Mes {actions} », pour tout le monde, sans module) ; l'écran CODIR s'appelle déjà « Arbitrages » et le séminaire « Préparer {N+1} » ; la section Temps disparaît pour une personne qui ne suit pas son temps ; le module `delegation` est retiré de TLST ; le guide (`lib/lexique.ts`) cite des chemins de menu qu'il faudra réécrire. **À coder après la fusion de cette branche** (elle modifie `lib/navigation.ts`).

**Fichier concerné au premier chef** : `lib/navigation.ts` (`navTreeFor`, `locate`), puis `components/shell/sidebar.tsx`, `topbar.tsx`, `breadcrumb.tsx`, les pages dont des vues deviennent des onglets, et le guide (`lib/lexique.ts`, `app/aide/page.tsx`).

## 1. Le constat

Avec tous les modules, un compte CODIR + admin voit **12 sections et 35 entrées** (recompté sur le code du 27/09 après-midi : inchangé, « Mes {actions} » a pris la place de « Ma délégation »). Les choses du quotidien, de la semaine et de l'année sont étalées au même niveau ; plusieurs entrées ne sont que des vues d'une même liste ; « ce qui m'attend » est éclaté entre Demandes, Échéances et Notifications ; la section Direction regroupe des *personnes* (le CODIR), pas des usages.

## 2. Les règles (✅)

1. **Principe mixte** : la première section rassemble le **quotidien** (« ce que je fais aujourd'hui ») ; les suivantes sont rangées **par objet** (projets, argent, réseau, gestion).
2. **Une entrée de menu = un endroit où l'on va.** Une **vue** d'une même liste = un **onglet** dans la page. Un **document produit** = un **bouton**. Un **moment de l'année** = un bouton, ou une entrée affichée seulement en saison.
3. Pas de section définie par un groupe de personnes : les droits masquent des entrées, ils ne créent pas de section.

À inscrire dans `.agents/rules/` (règle d'interface, fichier à créer — il n'existe aujourd'hui que sécurité, données, tests, production) et dans l'index d'`AGENTS.md`, pour que les prochains modules s'y plient.

## 3. Le menu cible

*En italique : selon module d'instance, droit ou réglage de la personne.*

| Section | Entrées |
|---|---|
| **Mon travail** | Ma semaine · À traiter (badge) · Tâches · Notes · *Mon temps (si la personne suit son temps)* · Mes {actions} · *Mes frais (feuille de route)* |
| **Projets** | Tous les {projets} · Vue annuelle · Plan de charge · Échéances · *À décider ({CODIR})* · *Préparer {N+1} ({CODIR}, en saison)* |
| **Financements** | Dossiers · Qui finance quoi · *Appels à projets* |
| **Réseau** (ex-Annuaire) | Organisations · *Adhérents* · Contacts |
| **Ressources** (ex-« Gestion ») | *Trésorerie* · *Matériel et prêts* · *Temps de l'équipe* (onglet Clôture) · *Notes de frais (feuille de route)* |
| **Admin** | une seule entrée |

{actions}, {CODIR} : mots du vocabulaire de l'instance (`V.action`, `V.codir` — « coordination » chez TLST), jamais écrits en dur.

Hors menu : **Notifications** (la cloche du bandeau y mène déjà, `components/shell/notifications-bell.tsx`) ; **Aide** (déjà dans le menu d'aide du bandeau, `components/shell/help-menu.tsx`).

Résultat : **6 sections, 24 entrées au maximum**, feuille de route comprise (contre 12 / 35 aujourd'hui sans elle). Une personne sans droit CODIR ni admin : 5 sections, ≈ 18 entrées.

## 4. Correspondance entrée par entrée (actuel → cible)

| Aujourd'hui (section › entrée) | Devient | Statut |
|---|---|---|
| Mon travail › Ma semaine, Tâches, Notes | inchangés | ✅ |
| Mon travail › Mes {actions} (ex-« Ma délégation », remplacée le 26/09 : pour tout le monde, sans module ; liste « Personnes » pour la coordination et les responsables de pôle ; export Word « feuille de mission ») | inchangé (même place que la délégation, validée ✅) | ✅ |
| Demandes › Qu'on me fait / Que j'ai faites / {vue large} | Mon travail › **À traiter**, trois onglets ; les validations (`/validations`) y restent rattachées ; le badge des demandes passe sur l'entrée | ✅ |
| Échéances › Échéances | Projets › **Échéances** (radar collectif des livrables et jalons). Mes échéances personnelles restent dans Ma semaine | ✅ (27/09) |
| Échéances › Notifications | **hors menu**, accessible par la cloche | ✅ (27/09) |
| Temps › Ma répartition | Mon travail › **Mon temps**, masqué pour qui ne suit pas son temps (règle du 26/09, gardée) | ✅ |
| Temps › Temps de l'équipe | Ressources › **Temps de l'équipe**, selon les droits seulement (même pour qui ne suit pas son temps) | ✅ (27/09) |
| Temps › Clôture mensuelle | **onglet** de Temps de l'équipe (même personne, même moment : la RAF en fin de mois), selon les droits | ✅ (27/09) |
| Projets › Projets + Portefeuille / Mes projets | Projets › **Tous les {projets}** (plus de doublon avec le nom de la section), avec un onglet « Mes {projets} » (et « Portefeuille » pour le {CODIR}) ; le filtre financé / interne (26/09) reste un filtre de la liste | ✅ |
| Projets › Vue annuelle, Plan de charge | inchangés | ✅ |
| {Direction} › Arbitrages (`/codir`, renommé « Écran CODIR » → « Arbitrages » le 26/09) | Projets › **À décider**, {CODIR} seulement ; le nom « Arbitrages » ne parlait pas à Gaël. Renommer aussi le titre de la page `/codir` et les entrées du guide qui disent « Arbitrages » | ✅ |
| {Direction} › Préparer {N+1} (`/seminaire`) | Projets › **Préparer {N+1}**, {CODIR}, affiché de **septembre à janvier** ; hors saison, bouton sur Vue annuelle | ✅ ; en janvier, l'année qui commence (27/09) |
| {Direction} › Écran café (`/cafe`) | **bouton** « Projeter le café du lundi » en tête d'Échéances (même contenu : la quinzaine, les blocages, qui attend quoi) | ✅ bouton en tête d'Échéances (27/09) |
| Financements › Dossiers de financement + Financements obtenus | Financements › **Dossiers**, onglets « En cours » / « Obtenus » | ✅ |
| Financements › Qui finance quoi, Appels à projets | inchangés | ✅ |
| Annuaire › Organisations, Contacts | Réseau › inchangés | ✅ |
| Adhérents › Adhérents + Cotisations | Réseau › **Adhérents**, onglet « Cotisations » (une adhésion est une `Membership` sur une organisation ou un contact de l'annuaire : c'est une fiche du réseau avec un statut) | ✅ |
| Trésorerie › Plan de trésorerie | Ressources › **Trésorerie** | ✅ |
| Prêts › Prêts en cours / terminés / Inventaire | Ressources › **Matériel et prêts**, onglets | ✅ (27/09) |
| Admin › Personnes / Référentiels / Paramètres / Import-export | Admin, **une entrée**, sections en onglets (Paramètres porte aussi, depuis le 26/09, le circuit de validation des fiches) | ✅ |

Déjà des boutons, rien à changer : feuille de mission (Mes {actions}), export des {actions} financées (Qui finance quoi), plan opérationnel (Vue annuelle).

Les adresses ne changent pas (`/codir`, `/seminaire`, `/cafe`, `/echeances`, `/adherents?vue=cotisations`, `/mes-actions`…) : seuls le menu, les libellés et les onglets bougent. Aucune redirection nécessaire, sauf si une adresse est renommée plus tard. (`/delegation` redirige déjà vers `/mes-actions` depuis le 26/09.)

## 5. La feuille de route passe-t-elle ? (vérifié le 27/09)

Oui, sans ajouter d'entrée hors celles notées ci-dessus :

| Évolution prévue (source) | Où elle se range |
|---|---|
| Heures supplémentaires (`LOTS-TLST.md`) | Onglet « Pointage » de Mon temps ; récap paie dans Temps de l'équipe |
| Valorisation du bénévolat (`LOTS-TLST.md`) | Saisie dans Mon temps ; total des contributions en nature dans Temps de l'équipe. Attention : les bénévoles et membres du CA ont « suit son temps » décoché, donc pas de Mon temps — leur saisie de contribution devra passer par une autre porte (Mes {actions} ou une saisie par la coordination), à décider avec le chantier |
| Notes de frais natives (`LOTS-TLST.md`, à décider plus tard) | « Mes frais » dans Mon travail (module) ; validation dans À traiter ; export dans Ressources |
| Temps passé sur les réponses aux appels à projets (chantier 2, après le plan actions) | Saisie dans Mon temps (comme le reste) ; lecture sur le dossier et dans Appels à projets |
| Affecter une tâche à un collègue (chantier 3) | Dans Tâches ; ce qu'on m'a confié arrive dans À traiter |
| Rapport d'activité annuel, indicateurs consolidés (`evolutions.md` V1 / V2) | Bouton et onglet sur Vue annuelle, à côté du plan opérationnel |
| Bilan financeur pré-rempli (V1) | Bouton sur le dossier de financement |
| Ordre du jour déposé à l'avance (pièces TLST) | Une demande « point pour le {CODIR} », qui apparaît dans À décider |
| Admin › Apparence, vocabulaire modifiable, corbeille, journal des connexions, webhooks, export xlsx RAF | Onglets d'Admin |
| Rapprochement bancaire, réservation de matériel, fusion de contacts, temps depuis Outlook | Dans leur écran respectif |
| Accès invité partenaire (V2) | Menu réduit calculé par les droits (`navTreeFor` le permet déjà) |

## 6. Points tranchés par Gaël (27/09)

1. ✅ **Notifications** hors menu (cloche seule) ; **Échéances** dans Projets, avec le bouton « Projeter le café du lundi » en tête.
2. ✅ **Matériel et prêts** : la section « Gestion » est renommée **« Ressources »** (Trésorerie, Matériel et prêts, Temps de l'équipe), pour ne pas sonner back-office auprès de qui emprunte.
3. ✅ **Clôture** : onglet de Temps de l'équipe.
4. ✅ **Nom de l'entrée** : « Tous les {projets} » (onglets « Mes {projets} », « Portefeuille » pour le {CODIR}) ; plus de doublon section / entrée.
5. ✅ **Préparer {N+1}** : de septembre à décembre, l'année suivante ; en janvier, l'année qui commence. Une seule règle, lue par le menu et par `/seminaire`.
6. ✅ **Qui ne suit pas son temps** : Mon temps disparaît ; Temps de l'équipe et Clôture suivent seulement les droits.
7. **Instances** — vérifié le 27/09 : TLST a les modules veille, adhérents, trésorerie, matériel et budget (`delegation` retiré le 26/09 ; `budget` est une section de l'onglet Budget, pas une entrée de menu) : même menu que la CRESS. Les nouveaux libellés (« Réseau », « À traiter », « À décider », « Ressources », « Mon temps » ; « Tous les {projets} » via `V.projet`) ne contiennent aucun mot du vocabulaire client ; « {CODIR} » dans les annotations passe par `V.codir`. À confirmer par `npm run check:vocab` et le test d'habillage TLST au moment du code.

## 7. Travaux (ordre proposé)

0. Après la fusion de `feat/actions-composantes` (même fichier `lib/navigation.ts`), sur une branche à part.
1. Règle d'interface dans `.agents/rules/` (§ 2), indexée dans `AGENTS.md`.
2. `lib/navigation.ts` : nouvel arbre (`NavSection.id` : `travail`, `projets`, `financements`, `reseau`, `ressources`, `admin`), saisonnalité de Préparer (une seule fonction pour la saison et l'année préparée, partagée avec `/seminaire`), `also` pour les adresses rattachées (`/validations`, `/cafe`, `/notifications`, `/edition`, `/action`, `/financeurs`, `/materiel/pret`…) afin que `locate` garde l'entrée active ; `NavContext.tracksTime` ne masque plus que Mon temps (point 6).
3. Pages dont des vues deviennent des onglets : Demandes (À traiter), Dossiers (En cours / Obtenus), Adhérents (Cotisations), Matériel (en cours / terminés / inventaire), Temps de l'équipe (+ Clôture), Projets (Mes projets / Portefeuille), Admin.
4. Boutons : « Projeter le café du lundi », « Préparer {N+1} » hors saison sur Vue annuelle. Titre de `/codir` : « À décider ».
5. Fil d'Ariane (`components/shell/breadcrumb.tsx`) et `topbar.tsx` alignés sur les nouvelles sections.
6. Guide : les champs `where` de `lib/lexique.ts` citent les chemins actuels (« Annuaire › Contacts » ×4, « Temps › Ma répartition », « Temps › Clôture mensuelle », « Prêts », « Échéances », « Projets › Portefeuille », « {Direction} › Arbitrages », « {Direction} › Préparer », entrée « Arbitrages, écran café ») : tous réécrits ; `app/aide/page.tsx` et `docs/produit.md` mis à jour.
7. Tests : tests unitaires de `navTreeFor` / `locate` (arbre par profil : salarié·e, RAF, CODIR, admin, personne qui ne suit pas son temps ; saisonnalité, y compris janvier) ; revoir les tests Playwright qui cliquent dans le menu (`tests/helpers.ts`, `rail.spec.ts`, `rail-infobulle.spec.ts`, `perimetre.spec.ts`, `habillage.spec.ts`, `personnes.spec.ts` — case « suit son temps » —, `mes-actions.spec.ts` et ceux qui naviguent par libellé). `npm run check` avant commit, `check:full` avant déploiement.

## 8. Hors périmètre

Pas de changement d'adresses, de droits ni de données. Pas de nouveau module.
