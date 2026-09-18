import { defineConfig, devices } from "@playwright/test";

// Les recettes tournent sur leur propre serveur de dev (port PW_PORT, 3100 par défaut, dossier .next-test) et sur leur propre
// base Postgres (TEST_DATABASE_URL, `pilote_test` par défaut) : jamais celle du serveur de dev 3001. La base de test est
// migrée puis reseedée avant la suite (tests/global-setup.ts).
const PORT = Number(process.env.PW_PORT ?? 3100);
// Faux Brevo (tests/brevo-mock.mjs) : le serveur de test pointe dessus, la clé est fictive.
const BREVO_MOCK_PORT = PORT + 199;
const HELLOASSO_MOCK_PORT = PORT + 198;
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://pilote:pilote@localhost:5432/pilote_test";
process.env.DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
      command: `npx prisma migrate deploy && NEXT_DIST_DIR=.next-test npm run dev -- -p ${PORT}`,
      url: `http://localhost:${PORT}/matrice/export`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { DATABASE_URL: TEST_DATABASE_URL, UPLOAD_DIR: "./uploads-test", PILOTE_DEMO: "1", AUTH_RATE_LIMIT: "0", BREVO_API_KEY: "test-key", BREVO_API_BASE: `http://localhost:${BREVO_MOCK_PORT}/v3`, HELLOASSO_CLIENT_ID: "test-id", HELLOASSO_CLIENT_SECRET: "test-secret", HELLOASSO_ORG_SLUG: "cress-demo", HELLOASSO_API_BASE: `http://localhost:${HELLOASSO_MOCK_PORT}` },
    },
  ],
});
