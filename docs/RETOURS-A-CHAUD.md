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

## À chaud (notes brutes, non traitées)

_(vide)_
