# Pilote — prototype de l'outil de pilotage des projets (CRESS)

Prototype fonctionnel, données 100 % fictives. Next.js 15 · Prisma + PostgreSQL · Tailwind + shadcn/ui.

1. Un PostgreSQL local (Homebrew `postgresql@18` sur le poste de Gaël, ou `docker compose up -d` avec le `docker-compose.yml` fourni). Une fois : `createdb pilote_dev && createdb pilote_test` avec un rôle `pilote` / `pilote` (`create role pilote login password 'pilote' createdb`). `.env` : `DATABASE_URL="postgresql://pilote:pilote@localhost:5432/pilote_dev"`, `UPLOAD_DIR="./uploads"`.
2. `npm install` — installe les dépendances et génère le client Prisma.
3. `npx prisma migrate deploy` puis `npm run seed` — applique le schéma et charge les données de démonstration (15 personnes, 22 projets, 52 éditions).
4. `npm run dev -- -p 3001` — ouvre http://localhost:3001 (3000 est pris par un autre projet sur le poste de Gaël) ; le menu utilisateur en haut à droite change la personne et ses droits (« Changer d'utilisateur »).
5. `npm run lint && npm run build` — vérifications ; `npm test` — 45 tests Playwright sur leur propre serveur (port `PW_PORT`, 3100 par défaut, `.next-test`) et **leur propre base** `pilote_test` (`TEST_DATABASE_URL`), migrée et reseedée à chaque suite : le serveur de dev 3001 n'est plus touché. Deux suites en parallèle : changer `PW_PORT` et `TEST_DATABASE_URL`.
6. `npm run screenshots` — une capture par écran dans `docs/screens/`.

Démo en ligne : https://cress.bazixx.fr (rideau `auth_basic`, voir `deploy/README.md`) ; mise à jour par `./deploy/deploy.sh` (Postgres du VPS : rôle, base et sauvegarde `pg_dump` gérés par le script).

Docs : `CLAUDE.md` (brief), `docs/charte.md`, `docs/decisions.md`, `docs/chiffrage.md`, `docs/integrations.md`, `docs/evolutions.md`. Tests : trois recettes, une simulation collective à six personas, le flux agenda, les pièces jointes, les conventions, le périmètre, la revue UX, les tâches, les financeurs, les remarques de fiche, le plan de charge, les versements, les appels à projets et les modules par installation, la matrice qui-finance-quoi et le lexique, le réalisé comptable importé. Les pièces déposées vont dans `uploads/` (hors git).
