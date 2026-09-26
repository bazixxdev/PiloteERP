import assert from "node:assert/strict";
import { test } from "node:test";
import { safeInternalRedirect } from "@/lib/redirect";

const BASE = "/outilcli/cress/pilote";

test("n'accepte que les redirections internes normalisées", () => {
  for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/\\\\evil.example", "javascript:alert(1)", "data:text/html,x", "\t/\\evil.example"]) {
    assert.equal(safeInternalRedirect(value), "/portefeuille", value);
    assert.equal(safeInternalRedirect(value, BASE), "/portefeuille", value);
  }
  assert.equal(safeInternalRedirect("/edition/123?x=1#budget"), "/edition/123?x=1#budget");
});

// Régression du 26/09 : sous un sous-chemin, la destination ne doit jamais le contenir (router.push l'ajoute) ;
// sinon l'adresse devient /outilcli/tlst/pilote/outilcli/tlst/pilote/portefeuille (404).
test("sous un sous-chemin, la destination est rendue sans lui, qu'elle arrive avec ou sans", () => {
  assert.equal(safeInternalRedirect("/portefeuille", BASE), "/portefeuille"); // ?suite= posé par le middleware
  assert.equal(safeInternalRedirect(`${BASE}/edition/123?x=1`, BASE), "/edition/123?x=1");
  assert.equal(safeInternalRedirect(undefined, BASE), "/portefeuille");
  assert.equal(safeInternalRedirect(`${BASE}//evil.example`, BASE), "/portefeuille");
  assert.ok(!safeInternalRedirect(undefined, BASE).startsWith(BASE));
});
