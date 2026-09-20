import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("la commande de production force Next sur loopback", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { scripts: { start: string } };
  assert.match(pkg.scripts.start, /next start --hostname 127\.0\.0\.1/);
});

test("les deux proxy Nginx des instances ciblent loopback", () => {
  for (const file of ["../../deploy/nginx/cress.bazixx.fr.conf", "../../deploy/nginx/tlst.bazixx.fr.conf"]) {
    const conf = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(conf, /proxy_pass\s+http:\/\/(?:0\.0\.0\.0|\[::\])/);
    assert.match(conf, /proxy_pass\s+http:\/\/127\.0\.0\.1:/);
  }
});
