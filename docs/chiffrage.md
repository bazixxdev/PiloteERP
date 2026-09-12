# Chiffrage — temps passé sur le prototype et projection « sur mesure »

Établi le 12/09/2026 à la fin du lot 4. Deux colonnes distinctes, à ne pas confondre :

1. **Temps réellement passé** sur ce prototype, construit en une session avec Claude Code (horodatage des commits), brief et charte fournis, sans réunion ni recette client.
2. **Projection pour une V1 sur mesure exploitable en production** (janvier 2027), en jours-homme d'une petite équipe (1 développeur + 0,3 chef de projet), réalisée sans assistance IA intensive. Ordre de grandeur pour la comparaison du 28/09 ; à affiner après les réponses aux questions ouvertes du cahier des charges.

| Lot | Contenu | Temps passé (prototype) | Projection V1 production |
|---|---|---|---|
| 1 | Schéma, migrations, seed, admin (référentiels, personnes, projets, paramètres, import/export), portefeuille, vue édition (8 onglets, droits par couche, historique, exports) | 31 min | 12 à 15 j |
| 2 | Saisie hebdomadaire des temps, clôture mensuelle (verrouillage, relances, exports), ma semaine, écran café, journal des rappels | 8 min | 8 à 10 j |
| 3 | Validations (niveaux, seuils, file par valideur, engagé automatique), vue annuelle et par pôle, séminaire (création en lot, contrôle de charge), reconduction N+1 | 4 min | 6 à 8 j |
| 4 | Finitions, raccourcis, responsive simple, tests Playwright des trois recettes, captures, documentation | 17 min | 4 à 5 j |
| — | **Total prototype** | **≈ 1 h de session** (plus ≈ 30 min de cadrage : lecture du cahier des charges, charte, décisions) | — |

## Ce que la projection V1 ajoute au prototype

Ces postes n'existent pas dans le prototype et pèsent autant que les écrans eux-mêmes :

| Poste | Jours |
|---|---|
| Authentification par compte Microsoft (ENF-10), MFA, journal des connexions, procédure de départ (EF-K3, K4) | 4 à 5 j |
| Base Postgres hébergée en UE, sauvegardes, environnement de recette et de production, mises à jour (ENF-3, ENF-7) | 3 à 4 j |
| Notifications par mail (rappels J-30/J-7, relances de temps, validations) et lecture de l'agenda Outlook (ENF-8) | 4 à 6 j |
| Export Word fidèle des bilans, exports Excel formatés pour la RAF | 2 à 3 j |
| Corbeille et restauration, droits fins par projet, accès invité (EF-K1, K5 si retenu) | 3 à 4 j |
| Recettes avec la CRESS (1er/12, 9-11/12, 15/12, 12/01), corrections, notice courte (EF-L1) | 5 à 6 j |
| Réserve pour les questions ouvertes (vocabulaire, seuils, visibilité du temps, DLA) | 3 j |

**Total V1 sur mesure : 55 à 70 jours-homme**, soit, à un tarif associatif de 500 à 650 € HT/jour, **28 000 à 45 000 € HT** de réalisation, plus l'hébergement (≈ 30 à 60 € HT/mois pour 15 comptes) et une maintenance annuelle de 10 à 15 % du montant initial. À comparer aux SaaS sur 24 mois (ENF-6 : 20 à 30 € par utilisateur et par mois, soit 7 200 à 10 800 € de licences pour 15 comptes, plus la mise en place).

## Note sur le cahier des charges « application v1-byGPT » (13/09)

Ce document décrit un produit plus complet (cycle de vie à 9 statuts, livrables à 7 états, circuits configurables, relevés d'indicateurs, champs personnalisés, corbeille, revue photographiée). Réalisé tel quel, il représente **100 à 140 jours-homme**, soit 50 000 à 90 000 € HT : le double du scénario ci-dessus. Le chiffrage V1 retient ses corrections de fond (convention partagée, budget sans double comptage, rythmes historisés, déclaration de complétude, idempotence, passation) et reporte le reste en V2 — voir `evolutions.md`.

## Hypothèses et limites

- Le temps « prototype » mesure une session d'assistant de code avec un brief très précis ; il n'est pas transposable tel quel à un développement classique. Il montre surtout que le modèle et les écrans sont clairs : la plupart du coût V1 est ailleurs (auth, hébergement, mails, recettes).
- Le stack retenu (Next.js, Prisma, Postgres) est courant : la reprise par un autre prestataire est possible (ENF-9), le code et les données s'exportent (ENF-5).
- Aucun coût de licence logicielle ; les bibliothèques utilisées sont open source (MIT).
