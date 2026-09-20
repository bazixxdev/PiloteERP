import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("les vhosts Pilote utilisent le format de logs sans secret", () => {
  for (const host of ["cress.bazixx.fr", "tlst.bazixx.fr"]) {
    const conf = fs.readFileSync(path.join(root, "deploy/nginx", `${host}.conf`), "utf8");
    assert.match(conf, /access_log .* pilote_safe;/);
    for (const line of conf.split("\n").filter((line) => line.trim().startsWith("access_log"))) {
      assert.match(line, / pilote_safe;/);
    }
  }
});

test("le format de logs ne contient ni query string ni referer", () => {
  const format = fs.readFileSync(path.join(root, "deploy/nginx/pilote-log-format.conf"), "utf8");
  assert.match(format, /\$uri/);
  assert.doesNotMatch(format, /\$request\"/);
  assert.doesNotMatch(format, /\$request_uri|\$args|\$query_string|\$http_referer/);
});
