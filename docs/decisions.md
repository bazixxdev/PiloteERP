# Décisions de conception

Une ligne par décision : date, décision, raison.

- 12/09/2026 — Barre latérale bleu profond avec texte clair, contenu sur fond crème. Raison : « bleu pour la navigation » dans la charte, contraste net avec le contenu.
- 12/09/2026 — Police locale « Avenir Next / Segoe UI » sans chargement distant. Raison : la maquette doit rester autonome.
- 12/09/2026 — La personne courante est stockée dans un cookie `pilote_person` ; par défaut la direction. Raison : sélecteur « Je suis… » sans authentification.
- 12/09/2026 — Les listes de statuts sont des tables (`RefValue` par famille) avec un code stable en anglais et un libellé modifiable en français. Raison : ENF-12, sans multiplier les tables.
- 12/09/2026 — L'historique des modifications (EF-B6) est un journal simple `ChangeLog` (édition, champ, avant, après, auteur, date). Raison : suffisant pour une vérification, pas de versionnage complet.
- 12/09/2026 — Les rappels (EF-C2) sont calculés à l'affichage depuis les livrables et jalons, pas stockés. Raison : pas de tâche planifiée dans un prototype ; `/rappels` les journalise à la volée.
- 12/09/2026 — Reconduction en N+1 : si une édition N+1 existe déjà, l'action est refusée avec un message. Raison : éviter les doublons sans corbeille.
- 12/09/2026 — Le contrôle de charge du séminaire compte les jours vendus de toutes les éditions de l'année cible (statut ≠ bilan fait). Raison : EF-B3b, calcul simple.
- 12/09/2026 — Export .docx basique via la bibliothèque `docx` (titres, paragraphes, tableau d'indicateurs). Raison : hors périmètre d'un export Word fidèle.
- 12/09/2026 — Aucune suppression depuis l'interface (actions, lignes, livrables, personnes) : on passe une action à « fait », une personne en « inactif ». Raison : EF-K1 (pas de suppression sans corbeille) ; la corbeille est hors périmètre du prototype.
- 12/09/2026 — La grille de temps propose les projets de l'équipe de la personne, ses propres actions non terminées et ses codes hors projet ; les autres actions du projet apparaissent seulement si un temps y est déjà saisi. Raison : rester sous la minute de saisie, sans lister 8 actions par projet.
- 12/09/2026 — Le temps « consommé » d'une édition = temps saisi sur le projet pendant l'année de l'édition (avec ou sans action). Raison : une édition n'a pas de dates de début et de fin.
- 12/09/2026 — Les relances de temps de la clôture sont simulées (badge « Relancé·e » sans persistance). Raison : brief, pas de mail dans le prototype.
- 12/09/2026 — Raccourcis clavier « g puis lettre » et « ? » pour l'aide, ⌘K pour la recherche. Raison : référence Linear, sans conflit avec les champs de saisie.
- 12/09/2026 — Vue par pôle (EF-G6) = la vue annuelle filtrée sur un pôle, avec un bloc « éditions du pôle et alertes » au-dessus. Raison : un écran de moins à maintenir, même données.
- 12/09/2026 — Le séminaire réutilise la reconduction unitaire pour chaque projet ; « ajuster » crée l'édition en statut « re-challengée », « arrêter » consigne la décision sur l'édition N sans rien créer. Raison : une seule logique de copie (EF-A2) pour l'unitaire et le lot (EF-A5).
- 12/09/2026 — Barre latérale réduite aux icônes sous 1024 px (responsive simple, sans version mobile). Raison : consultation sur tablette possible, mobile hors périmètre.
