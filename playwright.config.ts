import { defineConfig, devices } from "@playwright/test";

// Les recettes tournent sur leur propre serveur (port PW_PORT, 3100 par défaut, dossier .next-test) et sur leur propre base
// Postgres (TEST_DATABASE_URL, `pilote_test` par défaut) : jamais celle du serveur de dev 3001. La base de test est migrée
// puis reseedée avant la suite (tests/global-setup.ts).
// Stabilité (18/09) : la suite complète tourne sur un **serveur de production** (next build + next start) — en mode dev, la
// compilation à la première visite de chaque page dépassait les 5 s d'attente sous charge et faisait tomber des tests au
// hasard. PW_DEV=1 garde le serveur de dev (itération rapide sur un seul fichier, avec reuseExistingServer).
const PORT = Number(process.env.PW_PORT ?? 3100);
// Faux Brevo (tests/brevo-mock.mjs) : le serveur de test pointe dessus, la clé est fictive.
const BREVO_MOCK_PORT = PORT + 199;
const HELLOASSO_MOCK_PORT = PORT + 198;
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://pilote:pilote@localhost:5432/pilote_test";
process.env.DATABASE_URL = TEST_DATABASE_URL;
// Instance TLST (lot I) : même code, autre client, autre base (`createdb pilote_test_tlst` une fois), autre port, autre cache.
// Seul tests/habillage.spec.ts y tourne (projet « tlst ») ; `npx playwright test --project chromium` évite son build.
export const TLST_PORT = PORT + 1;
export const TLST_DATABASE_URL = process.env.TEST_DATABASE_URL_TLST ?? "postgresql://pilote:pilote@localhost:5432/pilote_test_tlst";

export default defineConfig({
  testDir: "./tests",
  // Les tests unitaires (tests/unit/*.test.ts, node:test) ne sont pas des recettes Playwright : npm run test:unit.
  testMatch: /.*\.spec\.ts$/,
  // La suite production-like tests/security/ a son propre harnais : npm run test:security.
  testIgnore: /tests\/security\//,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    locale: "fr-FR",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    // Session ouverte par le globalSetup (lot F) : les tests ne repassent pas par la page de connexion.
    storageState: "tests/.auth/state.json",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: [/habillage\.spec\.ts/, /tests\/security\//] },
    { name: "tlst", testMatch: /habillage\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${TLST_PORT}`, storageState: "tests/.auth/state-tlst.json" } },
  ],
  // Le serveur démarre avant le globalSetup : on migre la base de test dans la commande, et l'adresse de contrôle ne dépend pas
  // des données (un export sans jeton répond 401 sans toucher à la base : « le serveur est là »). Le seed vient ensuite.
  webServer: process.env.BASE_URL ? undefined : [
    {
      command: `node tests/brevo-mock.mjs`,
      url: `http://localhost:${BREVO_MOCK_PORT}/__state`,
      reuseExistingServer: true,
      timeout: 20_000,
      env: { BREVO_MOCK_PORT: String(BREVO_MOCK_PORT) },
    },
    {
      command: `node tests/helloasso-mock.mjs`,
      url: `http://localhost:${HELLOASSO_MOCK_PORT}/v5/ping`,
      reuseExistingServer: true,
      timeout: 20_000,
      env: { HELLOASSO_MOCK_PORT: String(HELLOASSO_MOCK_PORT) },
    },
    {
      command: process.env.PW_DEV ? `npx prisma migrate deploy && NEXT_DIST_DIR=.next-test npm run dev -- -p ${PORT}` : `npx prisma migrate deploy && NEXT_DIST_DIR=.next-test npx next build && NEXT_DIST_DIR=.next-test npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/matrice/export`,
      reuseExistingServer: true,
      timeout: 300_000,
      // Le serveur de production exige un secret d'auth : celui-ci ne sert qu'aux recettes locales.
      env: { DATABASE_URL: TEST_DATABASE_URL, UPLOAD_DIR: "./uploads-test", PILOTE_DEMO: "1", PILOTE_ENV_PROFILE: "test", AUTH_RATE_LIMIT: "0", BETTER_AUTH_SECRET: "secret-de-recette-locale-sans-valeur-0000000000000000", BETTER_AUTH_URL: `http://localhost:${PORT}/api/auth`, BREVO_API_KEY: "test-key", BREVO_API_BASE: `http://localhost:${BREVO_MOCK_PORT}/v3`, HELLOASSO_CLIENT_ID: "test-id", HELLOASSO_CLIENT_SECRET: "test-secret", HELLOASSO_ORG_SLUG: "cress-demo", HELLOASSO_API_BASE: `http://localhost:${HELLOASSO_MOCK_PORT}` },
    },
    {
      command: process.env.PW_DEV ? `npx prisma migrate deploy && NEXT_DIST_DIR=.next-test-tlst npm run dev -- -p ${TLST_PORT}` : `npx prisma migrate deploy && NEXT_DIST_DIR=.next-test-tlst npx next build && NEXT_DIST_DIR=.next-test-tlst npx next start -p ${TLST_PORT}`,
      url: `http://localhost:${TLST_PORT}/matrice/export`,
      reuseExistingServer: true,
      timeout: 300_000,
      // Instance TLST (lot I) : même recette, client tlst.
      env: { DATABASE_URL: TLST_DATABASE_URL, NEXT_PUBLIC_CLIENT: "tlst", UPLOAD_DIR: "./uploads-test-tlst", PILOTE_DEMO: "1", PILOTE_ENV_PROFILE: "test", AUTH_RATE_LIMIT: "0", BETTER_AUTH_SECRET: "secret-de-recette-locale-sans-valeur-0000000000000000", BETTER_AUTH_URL: `http://localhost:${TLST_PORT}/api/auth`, BREVO_API_KEY: "test-key", BREVO_API_BASE: `http://localhost:${BREVO_MOCK_PORT}/v3`, HELLOASSO_CLIENT_ID: "test-id", HELLOASSO_CLIENT_SECRET: "test-secret", HELLOASSO_ORG_SLUG: "tlst-demo", HELLOASSO_API_BASE: `http://localhost:${HELLOASSO_MOCK_PORT}` },
    },
  ],
});
