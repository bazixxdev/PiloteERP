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
