import { defineConfig, devices } from "@playwright/test";

// Profil séparé : il ne réutilise ni le storageState ni le serveur de la suite E2E historique.
// SECURITY_DATABASE_URL doit pointer vers une base PostgreSQL locale dédiée et jetable.
const databaseUrl = process.env.SECURITY_DATABASE_URL;
const baseURL = process.env.SECURITY_BASE_URL ?? "http://localhost:3200";
if (!databaseUrl) throw new Error("SECURITY_DATABASE_URL est obligatoire pour les tests production-like.");

process.env.DATABASE_URL = databaseUrl;
process.env.PILOTE_ENV_PROFILE = "security-test";
process.env.PILOTE_DEMO = "0";
  // Désactivé uniquement pour la recette : les scénarios créent plusieurs sessions
  // en rafale ; le rate limiting de production reste actif hors de ce profil.
  process.env.AUTH_RATE_LIMIT = "0";
process.env.NEXT_PUBLIC_CLIENT = process.env.NEXT_PUBLIC_CLIENT ?? "cress";
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? `${baseURL}/api/auth`;
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? "security-test-only-secret-change-per-run-000000000000";
process.env.UPLOAD_DIR = process.env.SECURITY_UPLOAD_DIR ?? "./uploads-security";

export default defineConfig({
  testDir: "./tests/security",
  globalSetup: "./tests/security/global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "NEXT_DIST_DIR=.next-security npm run build && NEXT_DIST_DIR=.next-security npm run start -- -p 3200",
    url: `${baseURL}/connexion`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: String(databaseUrl),
      PILOTE_DEMO: "0",
      PILOTE_ENV_PROFILE: "security-test",
      AUTH_RATE_LIMIT: "0",
      BETTER_AUTH_URL: `${baseURL}/api/auth`,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "security-test-only-secret-change-per-run-000000000000",
      UPLOAD_DIR: process.env.SECURITY_UPLOAD_DIR ?? "./uploads-security",
      NEXT_PUBLIC_CLIENT: process.env.NEXT_PUBLIC_CLIENT ?? "cress",
    },
  },
});
