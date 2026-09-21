# Pilote (PiloteERP)

Outil de pilotage de projets pour une petite structure associative (CRESS), décliné par instance (CRESS, TLST). Interface en français, données 100 % fictives dans le dépôt. Audité et durci en septembre 2026 (`docs/audit/`, `docs/remediation/`) : les règles ci-dessous en sont tirées et des sentinelles (`tests/unit/guardrails.test.ts`) cassent quand on les contourne.

## Stack

- Next.js 15 (App Router, Server Actions), TypeScript strict, Prisma 6 + PostgreSQL 16, Better Auth (e-mail / mot de passe), Tailwind + shadcn/ui, dayjs `fr`.
- Vocabulaire et habillage par client dans `config/clients/` ; jamais un mot métier en dur dans ce qui s'affiche (`lib/vocab.ts`, `npm run check:vocab`).
- Deux instances de production sur `bazixx-vps`, déployées par `deploy/deploy.sh`.

## Commandes

- `npm run dev -- -p 3001` — serveur de dev (base `pilote_dev`, `.env` local).
- `npm run check` — vocab + unitaires + lint + tsc (≈ 1 min) : **avant chaque commit**.
- `npm run check:full` — check + build + recette (`npm test`) + sécurité (`npm run test:security`) : lancé automatiquement par `deploy.sh`, qui refuse de déployer s'il est rouge.
- `npx prisma migrate dev --name x` puis `npx prisma generate` — schéma.
- `./deploy/deploy.sh cress|tlst` — le seul chemin vers la production.

## Rules

Les règles détaillées vivent dans `.agents/rules/`. Lire le fichier concerné avant d'agir :

- **Sécurité et autorisation** - [.agents/rules/securite-autorisation.md](.agents/rules/securite-autorisation.md) - garde par ressource, `saveField` réservé aux champs triviaux, exports par jeton ou permission, contenu et secrets.
- **Données et migrations** - [.agents/rules/donnees-migrations.md](.agents/rules/donnees-migrations.md) - expand/contract, cascades, transactions, archivage, rejeu sur dump.
- **Tests et recette** - [.agents/rules/tests-recette.md](.agents/rules/tests-recette.md) - les trois suites, tests indépendants du jour, artefacts hors git, sentinelles.
- **Production et déploiement** - [.agents/rules/production-deploiement.md](.agents/rules/production-deploiement.md) - `deploy.sh` seul, fail-fast de configuration, sauvegarde/restauration, rotations.

## Universal Rules

- **CRITICAL** — authentification ≠ autorisation : chaque action et route vérifie le droit sur la ressource visée, avant de lire ou d'écrire ; l'UI et le middleware ne sont pas des gardes.
- **CRITICAL** — une seule implémentation par règle métier ; une mutation indirecte (proposition, import, reconduction, cascade, `saveField`) obéit aux mêmes permissions et invariants que la mutation directe.
- **NEVER** affaiblir une garde, un test ou une contrainte pour faire passer autre chose ; **NEVER** changer un comportement qui n'est pas demandé ; **NEVER** de nouvelle dépendance sans justification écrite dans le commit.
- **NEVER** de donnée réelle, de nom réel, de secret dans le dépôt.
- **ALWAYS** un test de non-régression par bug, un test négatif par feature qui touche aux données, `npm run check` vert avant de committer.
- Petits diffs, un sujet par commit, message court en français qui dit le *pourquoi* ; les décisions de conception non tranchées vont dans `docs/decisions.md`.
- S'arrêter et demander avant : suppression de données, migration qui perd des colonnes, action sur le serveur, `prisma migrate reset` (consentement explicite requis).

## Avant de modifier du code

1. Expliquer le problème et nommer les fichiers touchés ; 2. proposer la solution minimale ; 3. nommer les risques de régression ; puis 4. `npm run check`, relire le diff, signaler ce qui reste incertain.
