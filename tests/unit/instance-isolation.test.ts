import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("le template systemd utilise une identité distincte par instance", () => {
  const unit = readFileSync(new URL("../../deploy/systemd/pilote@.service", import.meta.url), "utf8");
  assert.match(unit, /User=pilote-%i/);
  assert.match(unit, /Group=pilote-%i/);
  assert.match(unit, /ProtectSystem=strict/);
  assert.match(unit, /ReadWritePaths=\/var\/www\/%i-pilote-data \/var\/www\/%i-pilote-medias/);
});

test("le déploiement refuse l'absence de l'utilisateur système attendu", () => {
  const script = readFileSync(new URL("../../deploy/deploy.sh", import.meta.url), "utf8");
  assert.match(script, /RUNTIME_USER="pilote-\$INSTANCE"/);
  assert.match(script, /id "\$RUNTIME_USER"/);
  assert.doesNotMatch(script, /chown -R www-data/);
});
