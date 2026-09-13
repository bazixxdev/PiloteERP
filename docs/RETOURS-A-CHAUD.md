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

## À chaud (notes brutes, non traitées)

_(vide)_
