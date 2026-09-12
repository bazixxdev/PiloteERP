# Évolutions retenues, en attente ou écartées

Tenu à jour au fil des échanges avec la CRESS. Ce qui est **fait** est dans le prototype ; ce qui est **V1** entre dans le chiffrage du scénario sur mesure ; ce qui est **V2** attend une décision ou six mois d'usage.

## Fait dans le prototype (au-delà du brief initial, sur go)

| Date | Évolution | Pourquoi |
|---|---|---|
| 12/09/2026 | Documents : chemin serveur à copier + liens web, dossier de référence par convention (`\\cress\Partage\Action\{code}\{annee}`) | Fichiers sur le NAS en VPN, OneDrive « rien sauf par erreur », canaux Teams par projet (S4.34-47, S8.36-38) |
| 12/09/2026 | Flux agenda iCal personnel et équipe (`/api/agenda/{jeton}.ics`), abonnement depuis Outlook | L'agenda Outlook est l'outil d'organisation n°1, il ne donne pas la vue projet (S8.17-18, S8.28, S8.40) ; format standard sans dépendance Microsoft |
| 12/09/2026 | Simulation collective à six personas en test automatisé | Les interactions entre rôles méritent un test à part |

## V1 (janvier 2027) — retenu, à chiffrer

| Évolution | Condition | Réf. |
|---|---|---|
| Pièces jointes légères dans l'outil pour les validations (devis, justificatifs) | — ; recommandé parce que le NAS a des droits ouverts et des suppressions accidentelles (S4.38-39) | EF-J1, EF-F1 |
| Connexion par compte Microsoft (Entra ID), MFA, journal des connexions | Question 4 (Microsoft) | ENF-10, EF-K4 |
| Mails de rappel (J-30/J-7) et relances de temps | Cron + envoi (Graph ou SMTP) | EF-C2, EF-D5 |
| Export `.xlsx` formaté pour la RAF ; import budget engagé/réalisé par CSV | Format de l'Excel de la RAF | ENF-8, EF-E1b |
| Corbeille et restauration | — | EF-K1 |
| Postgres hébergé UE, sauvegardes | Choix d'hébergeur | ENF-3, ENF-7 |

## V2 — attend une décision ou l'usage

| Évolution | Ce qui bloque | Réf. |
|---|---|---|
| Saisie assistée des temps depuis les créneaux Outlook (sens agenda → outil) | Question 4 (Microsoft), question 5 (compteur d'heures), question 12 (CSE) ; doit rester une proposition relue par la personne, jamais un import (S4.97) | EF-D6 |
| Relais du fil de discussion vers le canal Teams du projet | Choix d'usage Teams vs fil dans l'outil | EF-J2 |
| Navigation dans le dossier SharePoint depuis l'édition | Bascule des fichiers du NAS vers SharePoint | EF-J1 |
| Accès invité partenaire par projet | Question 8 | EF-K5 |
| Formulaire d'entrée des demandes internes | — | EF-J3 |
| Indicateurs consolidés CRESS pour la revue trimestrielle | Usage de six mois | EF-G7 |

## Écarté

| Évolution | Pourquoi |
|---|---|
| Planning hebdomadaire dans l'outil (remplacer l'agenda) | L'agenda Outlook reste l'agenda ; tâches optionnelles en V1 (cahier des charges 2.4) |
| Gestion documentaire, copie des fichiers | EF-J4 |
| Comptabilité, clés de répartition, compteur d'heures | EF-E4, partie 5 du cahier des charges |
| Liaison Dolibarr | Instance obsolète, écart assumé (ENF-8) |
