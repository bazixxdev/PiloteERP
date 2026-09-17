import { defineConfig, devices } from "@playwright/test";

// Les recettes tournent sur leur propre serveur de dev (port PW_PORT, 3100 par défaut, dossier .next-test) et sur leur propre
// base Postgres (TEST_DATABASE_URL, `pilote_test` par défaut) : jamais celle du serveur de dev 3001. La base de test est
// migrée puis reseedée avant la suite (tests/global-setup.ts).
const PORT = Number(process.env.PW_PORT ?? 3100);
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
  webServer: process.env.BASE_URL ? undefined : {
    command: `npx prisma migrate deploy && NEXT_DIST_DIR=.next-test npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/matrice/export`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { DATABASE_URL: TEST_DATABASE_URL, UPLOAD_DIR: "./uploads-test", PILOTE_DEMO: "1", AUTH_RATE_LIMIT: "0" },
  },
});
