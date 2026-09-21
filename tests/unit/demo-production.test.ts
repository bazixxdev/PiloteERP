import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const env = { ...process.env, BETTER_AUTH_SECRET: "test-secret", DATABASE_URL: "postgresql://pilote:pilote@localhost:5432/pilote_test_harness" };

test("la production refuse explicitement PILOTE_DEMO=1", () => {
  const r = spawnSync("npx", ["tsx", "-e", "import './lib/auth'"], { env: { ...env, NODE_ENV: "production", PILOTE_DEMO: "1" }, encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}\n${r.stderr}`, /PILOTE_DEMO=1 est interdit en production/);
});

test("la production avec PILOTE_DEMO=0 ne passe pas en mode démo", () => {
  const r = spawnSync("npx", ["tsx", "-e", "import { DEMO_MODE } from './lib/auth'; if (DEMO_MODE) process.exit(2)"], { env: { ...env, NODE_ENV: "production", PILOTE_DEMO: "0", BETTER_AUTH_URL: "https://example.com/api/auth", AUTH_RATE_LIMIT: "5" }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("la production refuse une URL HTTP non locale", () => {
  const r = spawnSync("npx", ["tsx", "-e", "import './lib/auth'"], { env: { ...env, NODE_ENV: "production", PILOTE_DEMO: "0", BETTER_AUTH_URL: "http://example.com/api/auth", AUTH_RATE_LIMIT: "5" }, encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}\n${r.stderr}`, /BETTER_AUTH_URL doit utiliser HTTPS/);
});

test("la production refuse AUTH_RATE_LIMIT=0", () => {
  const r = spawnSync("npx", ["tsx", "-e", "import './lib/auth'"], { env: { ...env, NODE_ENV: "production", PILOTE_DEMO: "0", BETTER_AUTH_URL: "https://example.com/api/auth", AUTH_RATE_LIMIT: "0" }, encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}\n${r.stderr}`, /AUTH_RATE_LIMIT=0 est interdit/);
});

test("le profil security-test autorise HTTP loopback et rate limit désactivé", () => {
  const r = spawnSync("npx", ["tsx", "-e", "import './lib/auth'"], { env: { ...env, NODE_ENV: "production", PILOTE_DEMO: "0", PILOTE_ENV_PROFILE: "security-test", BETTER_AUTH_URL: "http://127.0.0.1:3200/api/auth", AUTH_RATE_LIMIT: "0" }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("un profil de recette explicite en loopback garde PILOTE_DEMO=1 (suite Playwright historique)", () => {
  const r = spawnSync("npx", ["tsx", "-e", "import { DEMO_MODE } from './lib/auth'; if (!DEMO_MODE) process.exit(2)"], { env: { ...env, NODE_ENV: "production", PILOTE_DEMO: "1", PILOTE_ENV_PROFILE: "test", BETTER_AUTH_URL: "http://localhost:3100/api/auth", AUTH_RATE_LIMIT: "0" }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("un profil de recette sur une URL publique refuse quand même PILOTE_DEMO=1", () => {
  const r = spawnSync("npx", ["tsx", "-e", "import './lib/auth'"], { env: { ...env, NODE_ENV: "production", PILOTE_DEMO: "1", PILOTE_ENV_PROFILE: "test", BETTER_AUTH_URL: "https://example.com/api/auth", AUTH_RATE_LIMIT: "5" }, encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}\n${r.stderr}`, /PILOTE_DEMO=1 est interdit en production/);
});
