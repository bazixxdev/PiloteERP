# Retours sur la version livrée

## Compilation — lot du 13/09/2026

### A. Gestion des temps : navigation et nommage confus
- « Mes temps » montre en réalité au boss les temps de toute l'équipe (pas évident au premier abord) : le nom trompe sur le périmètre de l'écran.
- La clôture des temps est rangée dans un écran séparé nommé « Clôture » : pas clair pour le boss que c'est là que se gère la gestion des temps. Les deux écrans gagneraient à être réunis ou renommés.

**Traité le 13/09** — Une seule entrée « Temps » dans la barre latérale, avec trois onglets en haut de l'écran : **Ma saisie** (toujours), **Temps de l'équipe** (seulement pour qui a le droit de voir d'autres personnes, avec le sélecteur de personne et la mention « lecture seule ») et **Clôture mensuelle** (RAF et direction). L'entrée « Clôture » a disparu de la barre ; l'URL `/cloture` reste. Le titre dit « Ma saisie » ou « Temps de Prénom Nom », plus jamais « Mes temps » pour quelqu'un d'autre.

### B. Visibilité du détail des heures pour la RAF / la direction
- Impression que la RAF et la directrice ne voient pas le détail des heures déclarées (seulement les totaux ?). À vérifier / corriger.

**Vérifié et complété le 13/09** — Le détail existait (grille d'une autre personne via `/temps?personne=…`) mais rien n'y menait. Ajouté : un bouton **Détail** sur chaque ligne de la clôture (ouvre la grille de la personne, semaine par semaine, première semaine du mois), et le nom cliquable dans le tableau RH de chaque édition. Ce que voit qui reste réglé par la visibilité du temps (admin › Paramètres) : par défaut la personne, son responsable de pôle, la RAF et la direction.

### C. Relance sur les heures sans effet visible
- Le bouton « Relance » ne produit rien de visible dans l'outil. Un email part sans doute, mais aucune notification ni trace côté application : l'utilisateur ne sait pas si l'action a fonctionné.

**Traité le 13/09** — Il n'y avait pas de mail (hors périmètre du prototype) et la relance n'était qu'un badge local. Maintenant : la relance crée une **notification dans l'outil** pour la personne — **cloche** en haut à droite avec compteur, encart « notifications à lire » dans **Ma semaine**, lien direct vers sa grille — et laisse une **trace datée dans la clôture** (« Relancé·e le 13 sept. par Nadia Ferrand »), persistante. Le texte de la clôture précise : en V1, un mail part aussi. Test automatisé ajouté.

### D. Coûts et RH
- Granularité des coûts et imputation RH à revoir (point à préciser).

**Traité le 13/09** — Par édition, onglet Temps, bloc « Ressources humaines de l'édition » : par personne, jours **prévus** (charge, proposée par le pilote), jours **conventionnés** (référence financeur, RAF), jours **réalisés** (heures ÷ coefficient réglable), **% du disponible** et **ETP** affichés, jamais saisis. Aucun salaire ni coût journalier dans l'outil : la valorisation reste dans l'Excel de la RAF. Côté dépenses directes : objet Dépense, devis → engagement, facture rattachée → réalisé, disponible calculé sans double comptage. Détail dans `docs/decisions.md` (13/09).

### E. Retours sur le rhabillage V2 (13/09, à l'oral)
- Le bouton « Projeter » de l'écran CODIR doit être en haut à droite.
- « Mes temps » réapparu dans la barre latérale alors qu'on avait mis « Temps ».
- Le fil d'Ariane ne suit pas les onglets (Temps, et ailleurs).
- Comment s'affichent les éditions d'un projet au bout de 4, 5, 8 ans ?
- Erreurs 500 aléatoires sur certains onglets (Ma semaine…).

**Traité le 13/09** — (1) « Projeter » en haut à droite avec « Quitter le mode CODIR · Échap », filtre par pôle descendu sous l'en-tête. (2) « Temps » rétabli partout (barre latérale, fil d'Ariane, navigation mobile). (3) Fil d'Ariane lu dans l'URL : `Mon travail / Temps / Ma saisie · Temps de l'équipe · Clôture mensuelle`, `Projets / Projet / Année / Onglet`, `Réglages / Admin / Section`, `… / Projection` ; les écrans à simples filtres restent sur deux niveaux. (4) Choix de l'édition : puces jusqu'à trois éditions, sélecteur « N éditions · Édition 2028 · Proposée ▾ » au-delà ; le portefeuille ne montre que les éditions en cours ou validées. (5) Cause : deux serveurs Next (dev 3001 et tests Playwright 3100) écrivaient dans le même `.next` ; les tests tournent désormais sur `.next-test` (`NEXT_DIST_DIR`), et le fil d'Ariane est sous `Suspense` comme l'exige `useSearchParams`.

### F. Revue UI/UX du 13/09 (`CRESS/audit-ux/changements-recommandes.md`, 12 points)

**Traité le 13/09** — dans l'ordre conseillé par la revue.
1. *Objectifs de temps tronqués* — colonne « Objectif (h) » avec largeur réservée (120 px, champ ≥ 104 px), tableau qui défile plutôt que d'écraser les chiffres ; en lecture seule la valeur s'écrit en texte avec son unité (« 77 h »). Test : 77 h et 105 h lisibles sans cliquer.
2. *Budget 100 % au lieu de 101 %* — pourcentage jamais plafonné, barre seule limitée à 100 % ; « 101 % · Enveloppe dépassée de 160 € » dans Budget, la carte Reste, l'alerte de l'en-tête, la jauge du portefeuille et le CODIR ; le texte sous la jauge dit ce qui entre dans le calcul (réalisé + engagements restant à réaliser, sans double comptage).
3. *« Complet (non déclaré) » à 18/19* — plus de tolérance cachée (90 %) : colonnes « Saisies · jours » (avec « N jours attendus sans saisie »), « Déclaration · semaines », « État » (Partiel · 1 jour sans saisie / Saisies complètes · non déclaré / Déclaré complet / Verrouillé). Le bouton collectif ouvre la liste exacte des personnes qui seront verrouillées et de celles qui restent ouvertes. **Règle à confirmer avec la RAF** (voir decisions.md).
4. *Validation CA « Non renseigné »* — en lecture, une phrase : « Validé par le CA le 18 décembre 2025 » / « En attente du CA » (CODIR décidé, CA pas encore) / « Non renseigné » ; la case ne porte plus le texte du placeholder.
5. *Ma semaine* — trois rubriques « En retard », « Cette semaine » (jusqu'à dimanche), « Plus tard » repliée (« Voir les échéances à 90 jours (N) ») ; sur mobile, l'ordre est retard → semaine → validations → temps → plus tard ; message « Rien à faire cette semaine » quand tout est calme.
6. *Alertes du portefeuille hors champ* — la synthèse (alerte la plus grave en toutes lettres + « +N autres · retards ») s'affiche sous le nom du projet ; la colonne Alertes et la colonne Statut (répétition de « En cours ») disparaissent, « Récurrent » et « Dans l'objectif » aussi ; le tableau tient dans 1 280 px (1 036 px sans défilement) et passe en 13 px.
7. *Mode CODIR* — bloc « Ordre du jour » : alertes regroupées par édition, notées, 5 sujets au plus, chacun avec problème / décision attendue / responsable (pilote + garant) / échéance ; « Toutes les alertes » reste dessous (replié en projection) ; en projection les boutons « Consigner » des lignes secondaires et les métadonnées des décisions s'effacent.
8. *Navigation et compteurs* — barre latérale par profil (Mon travail / Toute la CRESS / Direction / Réglages) ; compteurs personnels seulement ; page Validations titrée « N à traiter par moi · N en attente dans mon pôle » et file « Mon pôle » / « Toute la CRESS » annoncée comme information, pas comme tâches.
9. *Fiche en consultation* — texte compact par couche, « Modifier cette couche » selon les droits (couche vide ouverte en saisie), équipe en liste de noms pour qui ne la modifie pas, historique replié ; Financements : financeur, montants, statut et prochain livrable d'abord, « Détail de gestion » replié (ouvert pour la RAF).
10. *Saisie mobile* — en-tête compact (titre, navigation de semaine sur une ligne avec cibles de 44 px, total sur une ligne, jours, saisies) : le premier champ commence vers 470 px au lieu de 602 ; onglet « Ma saisie » masqué sur mobile quand il est seul ; règles dans « Aide et règles de saisie » replié ; message « Premier jour incomplet : lundi » distinct du jour affiché.
11. *Demande de validation* — « Joindre le fichier » avant l'envoi (déposé sur la demande dès sa création) ou lien en alternative ; encart « Sera transmis à Claire Vasseur · direction — Niveau 3 : montant supérieur au seuil… » ; niveau et délai dans « Paramètres du circuit » ; récapitulatif avant l'envoi.
12. *Libellés et accessibilité* — chaque champ de la fiche a un `<label for>` ; les contrôles des tableaux portent un nom accessible avec le contexte de la ligne (« Objectif en heures, Atelier de lancement ») ; « Frise chronologique », « Fermer » ; références EF-xx et A06 retirées des écrans ; focus visible sur liens, résumés et zones à défilement. Zoom 200 % et lecteur d'écran : à vérifier sur poste réel (non fait ici).

Tests : 12 existants verts + `tests/revue-ux.spec.ts` (2 scénarios). Seuls les tests qui vérifiaient l'attribut `readonly` d'un champ passent par `data-readonly` (le champ en lecture est désormais du texte).

### G. Retours de Gaël en direct (13/09, soirée)

**Traités le 13/09** — chacun dans un commit dédié (`git log c901a63..HEAD`).
- Menu utilisateur « habituel » (compte, admin, changer d'utilisateur, déconnexion) → fait ; Admin retiré de la barre latérale.
- Pied de barre latérale et liste des pôles « ne servent à rien » → retirés.
- « Pourquoi un alternant a le mode CODIR ? » → bouton réservé aux rôles CODIR (le sidebar l'était déjà) ; aide clavier `?` limitée au profil.
- Conventions : « un tableau + une page serait plus approprié » → liste avec filtres et page par convention ; rattacher / détacher une édition depuis la convention aussi.
- « C'est quoi la date dans le tableau des personnes ? » → c'est le début de validité du rythme ; colonne renommée « Rythme · en vigueur depuis », formulaire « à partir du ».
- Écran café en doublon dans Ma semaine → retiré. Vue journée et to-do → go, faits (tâches privées, échéance vs créneaux, `@` édition, chip modifiable, créneau suivant proposé).
- Erreur « slotLabel from the server » → fonction déplacée dans `lib/format.ts`.
- Financeurs : « un champ, c'est limité » → contacts (option complète), liste et page Financeur, contact du dossier.
- « Conventions et financeurs dans un même onglet avec sous-menu, et Projets et éditions avec » → entrée « Projets et financements », trois onglets ; doublon Financeurs de l'admin retiré.
- « Décocher Actif fait tout planter » → cause : dernière direction désactivée + cookie périmé après reseed ; garde-fous et personne courante robuste.
- Fiches projets Word : « en quoi l'outil reproduit ça, où sont les commentaires de la directrice ? » → rubriques du gabarit, export Word, remarques par rubrique. Puis « pas les commentaires de Dumas, d'autres » → remarques inventées ; puis « mode feedback, ça parasite, et c'est un droit du CODIR » → mode relecture, droit CODIR entier.
- « Un plan de charge ? » → go, fait ; puis « aller dans chaque édition n'est pas pratique » → modifiable depuis la grille.
- Démo en ligne redéployée avec `--seed` sur demande (HEAD `bab1264` à ce moment-là ; le plan de charge n'est **pas** encore en ligne).

### H. Retour oral de Gaël après les entretiens du 14/09 (transcript, 29 min) — orientations, non traitées

Ce que Gaël retient de la journée (S12 Saraly, S13 Anne-Sophie, S14 Simon, S15 Sandrine) et ce qu'il veut voir bouger. Rien n'est codé : chaque ligne attend un go ou une précision. Les propositions Bazixx sont marquées [P].

**To-do**
- Besoin confirmé d'une to-do « très claire, très épurée », dans un **espace dédié** (pas seulement un panneau de Ma semaine).
- Une tâche se rattache de préférence à une **action** d'un projet (le niveau de travail, c'est l'action) ; mais il faut aussi des **listes / catégories sans projet** (Sandrine : vie statutaire, admin, demandes du jour).
- **Visibilité au choix de la personne** : une liste est privée ou rendue visible (à son responsable, à l'équipe). Dans un premier temps, **seul l'auteur écrit** dans ses listes.
- **Modules activables** par personne : to-do, prise de notes… « Simon n'a pas besoin de to-do, pourquoi l'embêter ? » → un réglage simple dans Mon compte.

**Fiche projet**
- Un moment de rédaction, puis la fiche devient un **support** (temps, documents, actions) : le texte rédigé n'a pas à rester en premier plan en permanence (replié une fois validé).
- **Cycle de validation, puis verrouillage.** Les modifications en cours d'année existent (souvent à l'initiative de la directrice) : il faut les **ritualiser** — pas de modification silencieuse ; demande de modification / avenant, notification au pilote et au garant, trace dans l'historique. [P] : « Proposer une modification » sur une couche validée → même mécanique que les remarques, avec acceptation par le pilote et consignation.
- **Éclater la fiche en objets qui vivent différemment** : objectifs généraux (stables, en intro), **indicateurs** (objet vivant, mis à jour au réel), **actions** (items avec tâches, jalons, saisie au fil de l'eau), **réalisations / livrables au sens large** (inscrits à un événement, publics touchés, livrable produit et envoyé) consignés au fil de l'eau ; puis resynthétisés dans le tableau de bord de l'édition et dans l'export bilan (des données, pas seulement un PDF).
- **Projet en devenir** : tout chargé de mission doit pouvoir créer une proposition de projet (idée → fiche → relecture → validation → CA), pas seulement la direction. Trois origines à permettre : feuille blanche, duplication, proposition.
- **Mémo rouge** : demander à la CRESS **toutes les fiches projet en cours** (on ne sait pas combien il y en a) pour comprendre la nature réelle des champs ; et vérifier si le document de 50 pages de Sandrine agrège **toutes** les fiches ou seulement celles d'un financement.

**Événements** — un « petit outil » possible pour l'organisation (qui fait quoi, matériel, salles, traiteur) ; attendre les tableaux que Sandrine envoie (Forum, matériel AG).

**Plan de charge** — définir son **cycle de vie** : est-ce validé à un moment (séminaire) ? figé ? remodifiable sous quelles conditions ?

**Temps** — Simon résume : sortir du temps de travail effectif pour aller vers **l'imputation liée au financement**. Idée : raisonner en **pourcentage de mon ETP** par projet sur la semaine (camembert dynamique : « 30 % FSE = X h »), pour casser le « combien d'heures par jour sur quoi ». Les heures supplémentaires ne sont pas à l'outil (préconisations à part, éventuellement sur l'outil RH existant). Sandrine : **question oubliée** — lui demander par mail si elle a besoin d'imputer du temps ; elle est micro-fractionnée, mais quand une action concerne un projet à fiche, elle doit pouvoir dire « temps en support de ce projet ».

**Agenda** — l'agenda reste le premier moyen de rendre compte du travail ; poser des codes / projets sur ses événements est utile ; **creuser l'interconnexion dans l'autre sens** (agenda → outil) pour remonter les temps. En attendant : **aide à la saisie hebdo à partir des traces laissées dans l'outil** (tâches faites, créneaux posés, événements rattachés à un projet) — « j'ai bossé sur ça cette semaine », même sans durée.

**Ergonomie** — **mode focus** épuré pour les moments d'attention (saisir mes temps en 10 minutes, rédiger la fiche), sans le reste de l'interface ; à répliquer là où ça a du sens.

**Notes** — tout le monde prend des petites notes de réunion dans OneNote : une **prise de notes** propre dans l'outil, rattachée à un projet ou transverse (réunion d'équipe), module optionnel. Une raison de plus d'ouvrir l'outil ; le chat Teams se vide.

**Demandes internes** — un ticketing interne simple, **unifié avec les validations** : types de demande (retour site, besoin de chiffres, achat / devis, travail à faire…), un tableau unique « où en est ma demande » côté demandeur et côté traitant, possibilité de **générer une tâche** depuis une demande.

**Devis et factures** — « vraiment dommage » de ne pas répondre au circuit scanner / tamponner / signer. Le devis doit être **soumis et mis en visibilité selon le montant**, validé par le **n+1** (pas forcément la directrice, qui voit tout) ; règles par montant. La pré-validation de Sandrine ne semble pas utile. **Signature électronique** (service tiers ou open source auto-hébergé) pour éviter l'impression. Dimension analytique du devis (achat / investissement / prestation) : plutôt à la RAF. Facture : le paiement se gère côté assistante / RAF, hors outil ; le pilote doit juste **savoir que la facture est payée** ; adresse de facturation écrite sur le devis, transfert par mail si elle arrive au pilote ; pas besoin du fichier facture dans l'outil ; question du **contrôle de service fait** à vérifier, sans usine à gaz.

**Documents** — Gaël n'est « pas clair » et demande une proposition nette. Constats : NAS local en VPN, suppression possible des fichiers des autres, sécurité inconnue ; uploader des pièces dans l'outil risque de **disperser encore** (Teams + outil + serveur + OneDrive) ; arrêter OneDrive ; distinguer documents de projet et documents internes (notes de service) ; à quel moment une GED « un peu aboutie » devient nécessaire si on uploade PDF/Word/Excel dans tous les sens ? Liens partageables pour éviter les pièces jointes : V2, pas prioritaire. Aspiration des mails (façon CRM) : trop lourd pour le sur mesure ; à mentionner comme critère SaaS éventuel.

**Contacts** — au-delà des contacts financeurs, des **contacts opérationnels par projet** (partenaires impliqués) pour la continuité de service ; V2, mais rend l'outil indispensable.

**Périmètre financier** — l'outil ne traite pas la finance ; il fournit les données du bilan financier. Il ne trace que le temps et les devis.

### I. Retours de Gaël sur la démo en ligne (14/09, nuit) — traités le 14/09

- **Demandes : « tout le monde ne doit pas voir les demandes de tout le monde »** — Traité le 14/09. `loadRequests(me)` filtre par périmètre (`canSeeRequest`, `canSeeValidation` dans `lib/requests.ts`) : je vois ce qui me concerne (demandeur, destinataire, mon pôle destinataire), les demandes rattachées à une édition que je pilote ; un responsable de pôle voit son pôle (demandeur, destinataire, projet) ; direction et RAF voient tout. Le troisième onglet s'appelle « Toute la CRESS » (direction, RAF), « Mon pôle » (responsable), « Mes projets » (pilote) et disparaît pour les contributeurs et l'assistante. Le badge de la barre latérale et les notifications étaient déjà personnels.
- **Notes : la colonne de gauche passait sous l'éditeur** — Traité le 14/09 (`min-w-0` sur la colonne et les cartes, grille `300px / minmax(0, 1fr)`, colonne collante et défilante).
- **Notes : « après 12 mois on va galérer à s'y retrouver »** — Traité le 14/09 : recherche plein texte (titre + corps, avec extrait), filtres projet / type / auteur, liste **groupée par mois**.
- **Notes : « tu peux pas proposer du wysiwyg ? »** — Traité le 14/09 : éditeur riche Tiptap (`components/common/rich-editor.tsx`) — titres, gras, italique, listes, **cases à cocher** pour les « à faire », citation, séparateur ; raccourcis Markdown (`# `, `- `, `[] `). Le corps est stocké en HTML ; les notes en texte brut sont converties en paragraphes à l'affichage (`bodyToHtml`). Lecture seule sans barre d'outils pour une note partagée. Corrigé au passage : deux champs quittés à la suite créaient deux notes.

- **Notes : « on peut partager nominativement ? »** — Traité le 15/09 : `NoteShare` (note × personne), bouton « Partager avec… » dans l'éditeur (liste des collègues avec recherche), en plus de la visibilité ; la personne nommée reçoit une notification en cloche et lit la note sans la modifier ; « Partagée avec vous » dans l'en-tête, « pour vous » dans la liste. Action `setNoteShares`.
- **Notes : « de la couleur, ça aide à ranger et c'est moins triste »** — Traité le 15/09 : `Note.color` (bleu, vert, ocre, corail, violet, gris — palette de la charte, jamais le rouge d'alerte), pastille dans l'éditeur (liseré en haut), pastille + filet dans la liste, filtre par couleur dans la colonne. Un repère choisi par l'auteur, pas un statut.

- **Notes en lecture : « des chevrons alors que je ne peux pas éditer, ça me gêne »** — Traité le 15/09 : en lecture, date, type et projet (lien vers la fiche) sont du texte.
- **« Tu ne reprends pas l'iconographie dans les titres des sections, et dans les menus »** — Traité le 15/09 : registre unique `components/shell/section-icons.tsx` (écran → icône) utilisé par la barre latérale, la navigation basse mobile (fini les symboles typographiques) et `PageHeader` (icône dans une pastille devant le titre) ; ajoutée aussi sur Ma semaine, la fiche d'édition, conventions et financeurs.
- **« Notes et tâches dans le menu du haut : les dernières, la liste complète, un petit ajout »** — Traité le 15/09 : `components/shell/quick-menus.tsx` — deux boutons dans la barre haute (selon les modules activés) : menu avec les 5 dernières notes (pastille de couleur) / 5 prochaines tâches à faire, « Toutes mes notes / tâches », et un « + » qui ouvre `/notes?note=nouvelle` ou `/taches?ajouter=1` (saisie focalisée). Corrigé au passage : le texte tapé juste après le titre d'une nouvelle note pouvait disparaître au moment où la note se créait (l'éditeur se remontait).

- **« Faut repasser sur la partie tâches en UX/UI »** — Traité le 15/09 (« applique tes préco », « Sans liste → À trier ») : `/taches` sur le modèle des notes — colonne de gauche (À faire / À trier / Terminées, mes listes avec couleur et compteur, partagées avec moi), une seule liste à droite, une seule zone d'ajout, lignes **groupées par échéance** (En retard / Aujourd'hui / Cette semaine / Plus tard / Sans date). **Ligne calme** : case, libellé, et à droite ce qui est renseigné (liste, projet, échéance, créneaux) ; les réglages vides n'apparaissent qu'au survol. Saisie : `@projet` + `!demain`, `!lundi`, `!23/09` pour l'échéance. En-tête de liste en texte, réglages (nom, couleur, projet, visibilité, suppression) dans un panneau. `TaskList.color` (palette des notes). Ma semaine et l'onglet Actions profitent du même composant.
- **« Comment on déplace une tâche de catégorie ? drag and drop ? »** — Traité le 15/09 : la pastille de liste sur chaque ligne est un menu « Ranger dans… » ; et une ligne se **glisse-dépose** sur une liste de la colonne de gauche (ou sur « À trier »), avec confirmation.

- **« Possible de fusionner demandes et validations, ou ça pose problème ? »** — Traité le 15/09 : une seule entrée « Demandes » dans le menu (badge = demandes à traiter + validations que je peux décider), Approuver / Refuser **en place** sur la ligne d'une validation dans `/demandes`, bon pour accord depuis la ligne approuvée. `/validations` reste (file par niveau, décisions récentes) hors menu, liée depuis Demandes pour le CODIR et depuis l'onglet Validations d'une édition. Ma semaine renvoie vers Demandes pour décider.
- **« Clôture mensuelle : appuyer sur les anomalies, le reste se zoome à la demande »** — Traité le 15/09 : deux blocs — **À traiter** (sans saisie, partiel, saisies complètes non déclarées ; lignes teintées) toujours visible avec le verrouillage collectif ; **En ordre** (déclaré, verrouillé) replié par défaut ; le mode d'emploi replié sous « Total du mois ».

## À chaud (notes brutes, non traitées)

_(vide)_
