# Brief Claude Code — prototype « Pilote » (outil de pilotage des projets, CRESS)

Version 0.1 du 12/09/2026. Dérivé de `CRESS_cahier_des_charges_outil_v1_client.md` (les références EF-xx / ENF-xx renvoient à ce document). Ce fichier peut être copié tel quel en `CLAUDE.md` à la racine du dépôt. Aucune donnée réelle, aucun nom de personne réelle ne doit entrer dans le dépôt : tout est fictif.

## 1. Ce qu'on construit, et pourquoi

Un prototype fonctionnel, pas un produit. Il sert à deux choses : montrer à une direction associative (12-15 salariés, trois pôles, projets récurrents financés chaque année par plusieurs financeurs) ce que donne le fonctionnement cible dans un écran, et chiffrer honnêtement un scénario « sur mesure » face à des SaaS. Il doit donc être beau, rapide à prendre en main, et couvrir les exigences I du cahier des charges, sans plus.

Références d'ergonomie : Monday (tableaux colorés par statut, édition en ligne, vues tableau / timeline / kanban sur les mêmes données, barre latérale sobre), Linear (densité, raccourcis, rapidité). Interface en français. Pas d'IA. Sauvegarde automatique à chaque champ.

## 2. Stack (décidée, ne pas rediscuter)

- Next.js 15, App Router, TypeScript strict, Server Actions pour les écritures.
- Prisma + SQLite (fichier `prototype.db`), migrations versionnées. Le schéma doit rester portable vers Postgres sans changement de code métier.
- Tailwind + shadcn/ui ; icônes lucide ; dayjs avec locale fr ; recharts pour les jauges.
- Pas d'authentification réelle : un sélecteur « Je suis… » en haut à droite qui change la personne courante (et donc son rôle et ses droits). Suffisant pour la démo, à remplacer plus tard par une vraie auth (compte Microsoft, ENF-10).
- Tests : Playwright sur les trois recettes de la partie 8. `npm run lint && npm run build` verts à la fin de chaque lot.
- Un seul dépôt, un `README.md` de dix lignes (lancer, seeder, tester).

## 3. Modèle de données (partie 2 du cahier des charges)

Tout en français dans l'interface, en anglais dans le code. Les listes de valeurs sont des tables de référentiel modifiables dans l'admin, pas des enums codées en dur (ENF-12).

- `Person` : name, pole, role (pilot | contributor | pole_lead | director | raf | assistant), workRhythm (option_a | option_b | part_time | apprentice), availableDays (par an), timeCodes[] (codes de temps utiles à son poste), active.
- `Pole` : name, lead (Person).
- `Project` (permanent) : name, analyticCode, pole, pilot, guarantor (pole lead), mission (référentiel « missions du plan opérationnel »), strategicAxis (nullable), recurring, createdAt. Pas de date de fin.
- `Edition` (une par an et par projet) : year, status (rechallenged | proposed | validated | in_progress | closed), decisionDate, plus quatre groupes de champs :
  - couche 1 `strategic` : stakes, axis, sressMeasure, yearPriorities, expectedOutcome — écrite par director.
  - couche 2 `means` : plannedFunders (texte), directExpenseEnvelope (€), soldDays (par personne : table `EditionPersonDays` avec soldDays / availableDays), fte, imposedIndicators — écrite par raf et director.
  - couche 3 `proposal` : operationalObjectives, calendar, partners, method, governance, ownIndicators, timeNeed, budgetNeed, team (Person[]) — écrite par pilot.
  - couche 4 `validation` : codirDecision (renew | adjust | stop), codirDate, boardValidated, boardDate.
  - au fil de l'année : venues, equipment, evidenceToKeep, evaluation, report (texte long, exportable).
  - budget (lu par le pilote, écrit par raf) : envelope, committed, spent, remaining (calculé).
- `Action` : edition, name, owner, milestoneDate, timeTarget (heures), state (todo | doing | done | late), fundingLine (nullable), order.
- `FundingLine` : edition, funder (référentiel), scheme, status (to_submit | submitted | notified | contracted | justified), amountRequested, amountGranted, submittedAt, answeredAt, contractedAt, analyticCode, allocationKeyRef (texte, référence seulement), multiYear, notes.
- `Deliverable` : fundingLine, label, dueDate, done, doneAt. Sert aux rappels.
- `TimeEntry` : person, project, action (nullable), date, hours (décimal, pas 0,25), comment, locked. Contrainte : pas de sous-catégorie, jamais.
- `MonthLock` : person, month, lockedBy, lockedAt.
- `ValidationRequest` : edition, action (nullable), kind (quote | expense | sending | scope_change | funder_milestone), requester, amount, attachmentUrl, requiredLevel (1 | 2 | 3), status (pending | approved | refused), decidedBy, decidedAt, targetDelayDays.
- `Settings` (une ligne) : validationThresholdLevel1 (€), validationThresholdLevel2 (€), reminderDaysBefore (défaut [30, 7]), envelopeAlertPercent (défaut 80), deliverableAlertDays (défaut 30), timeVisibility (self | self_pole_lead_raf | codir | all ; défaut self_pole_lead_raf), horizonDays (défaut 90).
- `DocLink` : edition, label, url. `Comment` : edition, author, body, createdAt.
- Référentiels : `Funder`, `Mission`, `TimeCode`, `Status` libellés.

Règles :
- Reconduction (EF-A2) : action « Reconduire en N+1 » sur une édition : copie couches 1 à 3, actions (dates +1 an, état todo), lignes de financement (statut to_submit, montants vidés), équipe ; vide couche 4, budget, temps, bilan. Doit prendre moins de 10 secondes et proposer une relecture avant de créer.
- Une édition démarre sans attendre la notification ; drapeau `conditionalStart` (EF-A4).
- Le devis approuvé s'ajoute à `committed` (EF-E2). Aucun calcul comptable au-delà (EF-E4).
- Niveau requis d'une validation = calculé depuis le montant, les seuils et l'enveloppe restante ; modifiable à la main (EF-F2).
- Verrouillage mensuel : une fois verrouillé, `TimeEntry` en lecture seule pour la personne ; la RAF peut déverrouiller (EF-D5, EF-D7).
- Visibilité du temps par personne selon `Settings.timeVisibility` (EF-K6) ; le temps agrégé par projet / action reste visible par tous les rôles pilotes.
- Droits (EF-K1, EF-B1b) : director et raf écrivent couches 1-2 et budget ; pilot écrit couche 3, actions, bilan ; pole_lead valide niveau 2 ; contributor écrit ses actions et ses temps ; assistant lit. Les documents CODIR (champ `codirOnly` sur `DocLink`) sont invisibles hors CODIR.

## 4. Écrans, dans l'ordre de développement

Chaque écran a une URL, un état vide propre, et fonctionne au clavier. Barre latérale : Portefeuille, Ma semaine, Mes temps, Vue annuelle, Validations, Écran café, Admin.

1. `/portefeuille` — vue CODIR (EF-G1, EF-H2). Tableau des éditions en cours : projet, pôle, pilote, statut (pastille couleur), prochain jalon, livrable financeur le plus proche, enveloppe (jauge), temps consommé / objectif, validations en attente. Filtres pôle / statut / alerte. Un bouton « Mode CODIR » n'affiche que les lignes en alerte et les validations en attente, plein écran.
2. `/edition/[id]` — la vue édition (EF-G4, EF-B1, EF-B2). En-tête : projet, année, statut, pilote, garant, boutons « Reconduire en N+1 » et « Demander une validation ». Corps en onglets : Fiche (les quatre couches empilées, chaque couche avec son propriétaire affiché et grisée si non remplie : « à remplir par la direction »), Actions (tableau éditable en ligne + timeline simple, EF-G5), Financements (lignes + livrables + rappels), Temps (consommé / objectif par action), Budget (enveloppe, engagé, réalisé, reste), Validations, Documents et discussion, Bilan (texte + indicateurs, bouton Exporter en .md/.docx).
3. `/ma-semaine` — vue personne (EF-G2) : mes actions à échéance, mes jalons, mes validations à traiter, mes temps non saisis, tous projets. Le café du lundi se projette depuis `/cafe` : même contenu pour toute l'équipe, sur quinze jours, en grand (EF-H1).
4. `/temps` — saisie hebdomadaire (EF-D1 à D4, D7) : grille semaine × projets/actions de la personne (codes filtrés par poste), saisie à l'heure, total du jour et de la semaine face au rythme attendu (informatif, jamais de solde), objectif de temps visible au survol, commentaire optionnel. Doit se remplir en moins d'une minute : touches Tab / flèches, valeurs mémorisées de la semaine précédente proposées.
5. `/annuel` — vue annuelle par personne (EF-G3, EF-B3) : un tableau personnes × mois avec les éditions et actions, et une colonne jours vendus / jours disponibles ; vue par pôle pour la réunion de pôle (EF-G6).
6. `/validations` — file par valideur avec l'âge de la demande et le délai cible (EF-F1, EF-F3) ; approbation en un clic avec commentaire ; le devis approuvé remonte dans le budget de l'édition.
7. `/cloture` — pour la RAF (EF-D5) : mois par mois, qui a saisi, qui manque, relance (simulée : un badge), verrouillage, export CSV par projet et par personne.
8. `/admin` — référentiels, seuils, visibilité du temps, personnes, rythmes, jours disponibles (ENF-12) ; import / export CSV complet (ENF-5).
9. `/seminaire` — création en série des éditions N+1 (EF-A5, EF-H4) : liste des projets, case à cocher reconduire / ajuster / arrêter, création en lot, puis contrôle de charge : total jours vendus par personne contre disponibles, en rouge si dépassé (EF-B3b, calcul simple).

## 5. Données de démonstration (seed)

Tout fictif, cohérent, en français.
- 3 pôles ; 15 personnes avec des prénoms inventés, rôles répartis (1 direction, 1 RAF, 1 assistante, 2 responsables de pôle, 8 chargés de mission, 2 alternants), rythmes mélangés.
- 20 projets tirés de la liste du cahier des charges partie 6 (noms de projets, pas de personnes), sur 4 missions ; 2 éditions chacun (2026 en cours, 2027 proposée pour la moitié), 3 à 8 actions par édition, 2 à 4 lignes de financement par édition (aucun projet mono-financeur), livrables avec des échéances dans les 90 jours pour que les alertes s'allument.
- 8 semaines de temps saisis pour 10 personnes, 2 personnes en retard, un mois verrouillé.
- 6 validations en attente d'âges différents, 3 approuvées.
- Financeurs : Région, État, FSE, ADEME, Banque des Territoires, DREETS, Cap'Asso, ESS France, cotisations.

## 6. Hors périmètre du prototype

Authentification réelle, Outlook et Teams, export Word fidèle (un .md et un .docx basique suffisent), application mobile (responsive simple seulement), comptabilité, gestion documentaire, IA, notifications par mail (les rappels s'affichent dans l'interface et dans un journal `/rappels`), multi-organisation.

## 7. Lots et recettes

- Lot 1 : schéma, seed, admin, portefeuille, vue édition (fiche + actions + financements). Recette : la direction crée une édition, le pilote la complète, le portefeuille l'affiche avec ses alertes.
- Lot 2 : temps, clôture, ma semaine, écran café. Recette : chaque personne saisit une semaine en moins d'une minute, la RAF verrouille un mois et exporte.
- Lot 3 : validations, budget, vue annuelle, séminaire, reconduction. Recette : un devis demandé, validé au bon niveau, engagé sur l'édition ; les éditions 2027 créées en lot avec le contrôle de charge.
- Lot 4 : finitions ergonomiques, états vides, raccourcis, tests Playwright des trois recettes, README, chiffrage du temps passé par lot (servira au scénario « sur mesure »).

Après chaque lot : `npm run lint && npm run build`, tests verts, commit avec message court en français, puis une capture d'écran par écran dans `docs/screens/`.

## 8. Consignes de travail

- Français partout dans l'interface, vouvoiement neutre (« Saisir vos temps »), pas de jargon technique visible.
- Ne jamais inventer de personnes réelles, de logos, de données comptables réelles.
- S'arrêter et demander avant toute suppression de données, changement de schéma qui perd des colonnes, ou réécriture d'un écran validé.
- Une décision de design non tranchée ici se prend par défaut au plus simple, et se note dans `docs/decisions.md` (une ligne par décision, date, raison).
- Pas de fonctionnalité au-delà de la partie 4 sans l'écrire d'abord dans `docs/decisions.md` et attendre le go.

## 9. Correspondance exigences → écrans

| Exigence | Écran |
|---|---|
| EF-A1, A2, A3, A4, A5 | édition, séminaire |
| EF-B1, B1b, B2, B4, B6 | édition (onglet Fiche, historique simple des modifications) |
| EF-B3, B3b, EF-G3 | annuel, séminaire |
| EF-C1 à C5 | édition (Financements), portefeuille (alertes), rappels |
| EF-D1 à D5, D7, D8 | temps, clôture, admin (règles de saisie affichées) |
| EF-E1 à E4 | édition (Budget), validations |
| EF-F1 à F4 | validations, édition (Validations, décisions) |
| EF-G1, G2, G4, G5, G6 | portefeuille, ma semaine, édition, annuel |
| EF-H1, H2, H3 | café, portefeuille mode CODIR, portefeuille filtré trimestre |
| EF-I1 à I3 | édition (Fiche, Bilan) |
| EF-J1, J2 | édition (Documents et discussion) |
| EF-K1 à K6 | sélecteur de rôle, admin |
| EF-L2, L3 | édition (lecture), admin (modèles) |
| ENF-1, 4, 5, 12 | partout, admin |
