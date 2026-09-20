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
