# Pilote — prototype de l'outil de pilotage des projets (CRESS)

Prototype fonctionnel, données 100 % fictives. Next.js 15 · Prisma + SQLite · Tailwind + shadcn/ui.

1. `npm install` — installe les dépendances et génère le client Prisma.
2. `npx prisma migrate dev` — crée la base `prisma/prototype.db`.
3. `npm run seed` — charge les données de démonstration (15 personnes, 20 projets, 50 éditions).
4. `npm run dev -- -p 3001` — ouvre http://localhost:3001 (3000 est pris par un autre projet sur le poste de Gaël) ; le menu utilisateur en haut à droite change la personne et ses droits (« Changer d'utilisateur »).
5. `npm run lint && npm run build` — vérifications ; `npm test` — 36 tests Playwright sur leur propre serveur (port 3100, `.next-test`). **Ils reseedent `prisma/prototype.db`** : ne jamais lancer deux suites en même temps (même base, même serveur, même `test-results`).
6. `npm run screenshots` — une capture par écran dans `docs/screens/`.

Démo en ligne : https://cress.bazixx.fr (rideau `auth_basic`, voir `deploy/README.md`) ; mise à jour par `./deploy/deploy.sh`.

Docs : `CLAUDE.md` (brief), `docs/charte.md`, `docs/decisions.md`, `docs/chiffrage.md`, `docs/integrations.md`, `docs/evolutions.md`. Tests : trois recettes, une simulation collective à six personas, le flux agenda, les pièces jointes, les conventions, le périmètre, la revue UX, les tâches, les financeurs, les remarques de fiche, le plan de charge. Les pièces déposées vont dans `uploads/` (hors git).
