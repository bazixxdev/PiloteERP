# Intégrations avec les services tiers — état et points d'accroche

Le brief (partie 6) met hors périmètre du prototype : authentification réelle, Outlook, Teams, mails, application mobile. Rien de tout cela n'est branché. Ce document dit, pour chaque service attendu par le cahier des charges, ce qui existe déjà dans le code, où l'intégration se greffe, et l'effort estimé pour la V1. Aucune de ces intégrations ne sera développée sans un go explicite (consigne 8 du brief).

| Service | Exigence | État dans le prototype | Point d'accroche | Effort V1 |
|---|---|---|---|---|
| **Compte Microsoft (Entra ID)** | ENF-10, EF-K4 (MFA) | Sélecteur « Je suis… » sur cookie (`lib/session.ts`, `app/actions/session.ts`) | Remplacer `getCurrentPerson()` par une session Auth.js (fournisseur Microsoft Entra), rapprochée d'une `Person` par e-mail. Tout le reste du code lit déjà la personne via cette seule fonction ; les droits (`lib/rights.ts`) ne changent pas. MFA et journal des connexions sont fournis par Entra. | 3 à 4 j |
| **Mails de rappel et de relance** | EF-C2, EF-D5, EF-F2 | Rappels calculés à l'affichage (`lib/alerts.ts` → `computeReminders`), relance de temps simulée (`/cloture`), page `/rappels` | Une tâche planifiée quotidienne (cron) qui appelle `computeReminders` et les retardataires de `lib/agenda.ts`, puis envoie via Microsoft Graph `sendMail` (même tenant que l'auth) ou SMTP. Une table `Notification` pour ne pas renvoyer deux fois. | 3 à 4 j |
| **Agenda Outlook — lecture** | ENF-8 (I) | Aucun | Flux iCal des jalons et livrables (`/api/agenda.ics`, calculé depuis `Action.milestoneDate` et `Deliverable.dueDate`) auquel chacun s'abonne dans Outlook ; ou création d'événements via Graph. | 1 à 2 j |
| **Agenda Outlook — saisie assistée des temps** | EF-D6 (V2) | Grille de saisie (`app/temps/grid.tsx`) | Lecture de `calendarView` via Graph pour proposer les créneaux de la semaine avec un projet pré-choisi par mot-clé ; la grille accepte déjà une valeur proposée. | 4 à 5 j (V2) |
| **Serveur de fichiers (NAS)** | EF-J1, EF-J4 | Chemin serveur par convention et bouton « Copier le chemin » (`lib/docs.ts`, onglet Documents) | Rien à brancher tant que les fichiers restent sur le NAS ; si la CRESS passe à SharePoint, le gabarit de chemin devient une URL https et les mêmes entrées s'ouvrent en un clic. | 0 j |
| **Teams** | EF-J2 (S), ENF-8 (V2) | Liens web vers le canal du projet (`DocLink`) ; fil de discussion par édition (`Comment`) | Soit se contenter du lien vers le canal (déjà fait), soit poster chaque commentaire dans le canal via un webhook entrant Teams (10 lignes dans `addComment`). | 0,5 à 1 j |
| **Excel de la RAF — export** | ENF-8 (I), EF-D5 | CSV mensuels par projet et par personne (`/cloture/export`), CSV par table et JSON complet (`/admin/export`) | Passer au `.xlsx` formaté (feuilles, totaux) avec SheetJS si la RAF le demande ; colonnes déjà alignées sur son suivi (heures, jours, code analytique). | 1 j |
| **Excel de la RAF — import budget** | EF-E1b (V2) | Champs `budgetEnvelope`, `committed`, `spent` saisis à la main | Import CSV « code analytique ; engagé ; réalisé » dans `app/actions/admin.ts` (le parseur CSV existe déjà pour personnes, financeurs, projets). | 1 j |
| **Dolibarr** | ENF-8 | Non relié, écart assumé dans le cahier des charges | — | — |
| **Postgres hébergé UE** | ENF-3, ENF-7 | SQLite (`prisma/prototype.db`) | Changer `provider` dans `prisma/schema.prisma` et `DATABASE_URL` ; aucun type propre à SQLite n'est utilisé, aucune ligne de code métier ne change. | 0,5 j + hébergement |
| **API documentée** | ENF-5 | Routes d'export JSON/CSV sans authentification | Ajouter un jeton d'API sur `/admin/export` et documenter les champs (OpenAPI court). | 1 j |
| **Sauvegardes et réversibilité** | EF-K4, ENF-5 | Export complet JSON à tout moment | Sauvegarde quotidienne de la base côté hébergeur ; l'export JSON reste le format de sortie. | inclus hébergement |

## Ce qui rend ces greffes simples

- Une seule fonction donne la personne courante ; une seule fonction dit qui voit quoi ; les rappels sont une fonction pure sur les données. Aucun écran n'a à changer pour brancher l'auth, les mails ou l'agenda.
- Les exports existent déjà en CSV et JSON : le pont avec l'Excel de la RAF est un format à ajuster, pas une fonctionnalité à écrire.
- Les libellés et listes de valeurs sont en base : le vocabulaire tranché le 28/09 se règle dans l'admin.

## Ce qui reste à décider avant de brancher quoi que ce soit

Questions 4 (Microsoft, porte de sortie), 9 (charte IA), 12 (visibilité du temps, avis du CSE) du cahier des charges. Le choix Entra ID engage la CRESS sur Microsoft pour l'identité ; une alternative (mot de passe + MFA par application) coûte à peu près le même effort.
