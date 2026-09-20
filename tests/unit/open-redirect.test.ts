import assert from "node:assert/strict";
import { test } from "node:test";
import { safeInternalRedirect } from "@/lib/redirect";

test("n'accepte que les redirections internes normalisées", () => {
  for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/\\\\evil.example", "javascript:alert(1)", "data:text/html,x", "\t/\\evil.example"]) {
    assert.equal(safeInternalRedirect(value), "/portefeuille", value);
  }
  assert.equal(safeInternalRedirect("/edition/123?x=1#budget"), "/edition/123?x=1#budget");
  assert.equal(safeInternalRedirect("/outilcli/cress/pilote/edition/123", "/outilcli/cress/pilote"), "/outilcli/cress/pilote/edition/123");
});
