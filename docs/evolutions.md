# Évolutions retenues, en attente ou écartées

Tenu à jour au fil des échanges avec la CRESS. Ce qui est **fait** est dans le prototype ; ce qui est **V1** entre dans le chiffrage du scénario sur mesure ; ce qui est **V2** attend une décision ou six mois d'usage.

## Fait dans le prototype (au-delà du brief initial, sur go)

| Date | Évolution | Pourquoi |
|---|---|---|
| 12/09/2026 | Documents : chemin serveur à copier + liens web, dossier de référence par convention (`\\cress\Partage\Action\{code}\{annee}`) | Fichiers sur le NAS en VPN, OneDrive « rien sauf par erreur », canaux Teams par projet (S4.34-47, S8.36-38) |
| 12/09/2026 | Flux agenda iCal personnel et équipe (`/api/agenda/{jeton}.ics`), abonnement depuis Outlook | L'agenda Outlook est l'outil d'organisation n°1, il ne donne pas la vue projet (S8.17-18, S8.28, S8.40) ; format standard sans dépendance Microsoft |
| 12/09/2026 | Simulation collective à six personas en test automatisé | Les interactions entre rôles méritent un test à part |
| 12/09/2026 | Pièces jointes typées (devis, convention, notification, justificatif, bilan remis, compte rendu) sur l'édition, la ligne de financement, le livrable, la validation ; 5 Mo ; téléchargement réservé aux connectés | NAS aux droits ouverts, suppressions vécues (S4.38-39) ; le valideur ouvre le devis en un clic |
| 13/09/2026 | Notifications dans l'outil (cloche, Ma semaine) : relances de temps tracées ; navigation Temps unifiée (ma saisie / équipe / clôture) ; « Détail » des heures pour la RAF | Retours à chaud A, B, C |
| 13/09/2026 | Écran CODIR dédié : points à décider par nature, décision consignée sur l'édition (instance, suite, échéance), projection, repère 20 min | EF-H2, EF-F4 ; retour « le mode CODIR ne fait rien de spécial » |
| 13/09/2026 | Retours du CDC v1-byGPT appliqués : budget sans double comptage (dépenses, engagements restants, disponible), « en retard » calculé, déclaration de semaine complète, décision idempotente, charge planifiée ≠ jours conventionnés, café sans nom | Corrections justes du CDC GPT §9, §11, §12, §13, §14, §16 |
| 13/09/2026 | Rythmes de travail historisés (option A / B, temps partiel, alternance ; semaine paire / impaire ; périodes d'effet), heures attendues par jour, saisie au 0,25 h | Accord d'entreprise (S3.66, S3.A.5) ; le rythme d'une personne change dans l'année |
| 13/09/2026 | RH par édition : jours prévus / conventionnés / réalisés par personne, % et ETP affichés, coefficient heures→jours réglable | Question de Gaël sur la granularité RH ; EF-B3, EF-E4 |
| 12/09/2026 | Connexions « gratuites » : adresse de l'édition pour un onglet Teams ; jeton d'API et adresses prêtes pour Excel (*Données → À partir du web*) ; flux iCal public des actions cochées « Public » pour le site | Canaux Teams par projet (S8.36) ; l'Excel de la RAF reste la référence (EF-C5, EF-E4) ; refonte du site en 2026 |

## V1 (janvier 2027) — retenu, à chiffrer

| Évolution | Condition | Réf. |
|---|---|---|
| Connexion par compte Microsoft (Entra ID), MFA, journal des connexions | Question 4 (Microsoft) | ENF-10, EF-K4 |
| Mails de rappel (J-30/J-7) et relances de temps | Cron + envoi (Graph ou SMTP) | EF-C2, EF-D5 |
| Export `.xlsx` formaté pour la RAF ; import budget engagé/réalisé par CSV | Format de l'Excel de la RAF | ENF-8, EF-E1b |
| **Convention partagée** : objet unique par convention (FSE 2026-2028, CPO DLA) avec affectations par édition et contrôle « affectations ≤ montant notifié » | Remplace la ligne de financement par édition + drapeau pluriannuel | EF-C3 (CDC GPT §10) |
| Base HT/TTC unique par édition, rectification datée d'un réalisé confirmé | Arbitrage A06 | EF-E1 (CDC GPT §12) |
| « Préparer un départ » (réaffectation des responsabilités), désactivation sans effacer l'historique | — | EF-K3 (CDC GPT §20) |
| Notifications avec clé de dédoublonnage et reprise après panne | Va avec les mails de rappel | EF-C2 (CDC GPT §19) |
| « Non renseigné / À arbitrer / Sans objet » distincts de zéro sur les moyens | — | EF-B2 (CDC GPT §8) |
| Bilan financeur pré-rempli par ligne de financement (.docx : texte, indicateurs imposés, jours, dépenses) | Modèles attendus par chaque financeur | EF-B4, EF-I3 |
| Rapport d'activité annuel assemblé par mission, avec chiffres clés | — | EF-B4, EF-G7 |
| Webhooks sortants (validation, statut, livrable J-7) vers Power Automate ou tout automate | — ; donne l'autonomie au référent sans intégration par service | ENF-12, EF-C2 |
| Corbeille et restauration | — | EF-K1 |
| Postgres hébergé UE, sauvegardes ; stockage objet (S3 compatible) pour les pièces jointes | Choix d'hébergeur | ENF-3, ENF-7 |

## V2 — attend une décision ou l'usage

| Évolution | Ce qui bloque | Réf. |
|---|---|---|
| Saisie assistée des temps depuis les créneaux Outlook (sens agenda → outil) | Question 4 (Microsoft), question 5 (compteur d'heures), question 12 (CSE) ; doit rester une proposition relue par la personne, jamais un import (S4.97) | EF-D6 |
| Relais du fil de discussion vers le canal Teams du projet | Choix d'usage Teams vs fil dans l'outil | EF-J2 |
| Navigation dans le dossier SharePoint depuis l'édition | Bascule des fichiers du NAS vers SharePoint | EF-J1 |
| Accès invité partenaire par projet | Question 8 | EF-K5 |
| Mes actions dans Microsoft To Do / Planner | Question 4 ; double saisie de l'état | EF-G2 |
| Formulaire d'entrée des demandes internes | — | EF-J3 |
| Indicateurs consolidés CRESS pour la revue trimestrielle, revue photographiée | Usage de six mois | EF-G7 (CDC GPT §16) |
| Cycle de vie complet d'édition (9 statuts, suspension, réouverture), 7 états de livrable avec relecture, circuits de validation configurables avec délégations, relevés d'indicateurs (somme / cumul / ratio), constructeur de champs, corbeille relationnelle | Trop lourd pour une V1 « simple à prendre en main » (7/12, S8.43) ; à ouvrir selon l'usage | CDC GPT §7, §10, §13, §17, §20 |

## Écarté

| Évolution | Pourquoi |
|---|---|
| Planning hebdomadaire dans l'outil (remplacer l'agenda) | L'agenda Outlook reste l'agenda ; tâches optionnelles en V1 (cahier des charges 2.4) |
| Gestion documentaire, copie des fichiers | EF-J4 |
| Comptabilité, clés de répartition, compteur d'heures | EF-E4, partie 5 du cahier des charges |
| Liaison Dolibarr | Instance obsolète, écart assumé (ENF-8) ; un export CSV des congés suffirait un jour |
| Signature électronique des devis, journal des envois newsletter/LinkedIn, plateformes financeurs | Le flux de validation interne suffit ; pas d'API exploitable côté financeurs |
