# Pilote — prototype de l'outil de pilotage des projets (CRESS)

Prototype fonctionnel, données 100 % fictives. Next.js 15 · Prisma + SQLite · Tailwind + shadcn/ui.

1. `npm install` — installe les dépendances et génère le client Prisma.
2. `npx prisma migrate dev` — crée la base `prisma/prototype.db`.
3. `npm run seed` — charge les données de démonstration (15 personnes, 20 projets, 50 éditions).
4. `npm run dev` — ouvre http://localhost:3000 ; le sélecteur « Je suis… » en haut à droite change la personne et ses droits.
5. `npm run lint && npm run build` — vérifications ; `npm test` — recettes Playwright (le serveur de dev doit tourner, ou laissez Playwright le lancer).
6. `npm run screenshots` — une capture par écran dans `docs/screens/`.

Docs : `CLAUDE.md` (brief), `docs/charte.md`, `docs/decisions.md`, `docs/chiffrage.md`.
