import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const script = readFileSync(new URL("../../deploy/deploy.sh", import.meta.url), "utf8");

test("le backup PostgreSQL est bloquant et vérifié", () => {
  assert.match(script, /pg_dump -Fc/);
  assert.match(script, /pg_restore --list/);
  assert.match(script, /\[ -s "\$TMP_DUMP" \]/);
  assert.doesNotMatch(script, /pg_dump[^\n]*\|\| true/);
});

test("le build précède la migration dans le déploiement", () => {
  assert.ok(script.indexOf('echo "→ build"') < script.indexOf('echo "→ migrations"'));
});

test("le déploiement conserve les garde-fous de production", () => {
  assert.match(script, /NODE_ENV=production/);
  assert.match(script, /PILOTE_DEMO=0/);
  assert.match(script, /AUTH_RATE_LIMIT=10/);
  assert.match(script, /BETTER_AUTH_URL=.*https/);
  assert.match(script, /PILOTE_ENV_PROFILE=\(local\|test\|security-test\)/);
});

test("le déploiement conserve le code root-owned et les données par instance", () => {
  assert.match(script, /chown -R root:root "\$DIR"/);
  assert.match(script, /chown "\$RUNTIME_USER:\$RUNTIME_USER" "\$DIR\/\.env"/);
  assert.match(script, /chown -R "\$RUNTIME_USER:\$RUNTIME_USER" "\$DATA" "\$MEDIAS"/);
  assert.doesNotMatch(script, /chown -R "\$RUNTIME_USER:\$RUNTIME_USER" "\$DIR" "\$DATA" "\$MEDIAS"/);
});

test("le déploiement refuse une unité systemd non durcie", () => {
  assert.match(script, /User=pilote-%i/);
  assert.match(script, /NoNewPrivileges=true/);
  assert.match(script, /ProtectSystem=strict/);
  assert.match(script, /ReadWritePaths=\/var\/www\/%i-pilote-data \/var\/www\/%i-pilote-medias/);
});

test("le déploiement ne supprime pas brutalement l'ancienne release", () => {
  assert.doesNotMatch(script, /rm -rf/);
  assert.match(script, /\.previous/);
});

test("le déploiement refuse un working tree dirty et capture le commit construit", () => {
  assert.match(script, /git -C "\$LOCAL" rev-parse HEAD/);
  assert.match(script, /git -C "\$LOCAL" status --porcelain/);
  assert.match(script, /working tree Git dirty/);
  assert.match(script, /GIT_COMMIT/);
  assert.match(script, /GIT_SHORT/);
});

test("la release possède un manifeste non sensible et traçable", () => {
  assert.match(script, /\.release\.json/);
  assert.match(script, /"instance"/);
  assert.match(script, /"commit"/);
  assert.match(script, /"commit_short"/);
  assert.match(script, /"deployed_at"/);
  assert.match(script, /"release"/);
  assert.match(script, /"previous_release"/);
  assert.match(script, /date -u/);
  assert.match(script, /chmod 444 "\$NEW\/\.release\.json"/);
  assert.match(script, /rollback de/);
  assert.doesNotMatch(script, /DATABASE_URL.*\.release\.json/);
  assert.doesNotMatch(script, /BETTER_AUTH_SECRET.*\.release\.json/);
});

test("le déploiement vérifie l'adresse de l'API d'auth et que la connexion répond", () => {
  assert.match(script, /grep -qx "BETTER_AUTH_URL=\\"\$PUBLIC_URL\/api\/auth\\""/);
  assert.match(script, /api\/auth\/sign-in\/email/);
  assert.match(script, /401 attendu/);
});

