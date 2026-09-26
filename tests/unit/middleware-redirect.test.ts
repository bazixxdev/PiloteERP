import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

// Régression du 26/09 : derrière Nginx, Next écoute sur 127.0.0.1 ; la redirection vers la connexion doit rester relative
// (jamais https://localhost:…), avec le sous-chemin de l'instance et la page demandée.
test("sans session, la redirection vers la connexion est relative et garde le sous-chemin", () => {
  const req = new NextRequest("https://localhost:3002/outilcli/cress/pilote/portefeuille?vue=1", { nextConfig: { basePath: "/outilcli/cress/pilote" } });
  const res = middleware(req);
  assert.equal(res.status, 307);
  const location = res.headers.get("location") ?? "";
  assert.ok(location.startsWith("/outilcli/cress/pilote/connexion"), location);
  assert.ok(!location.includes("localhost"), location);
  assert.ok(location.includes(encodeURIComponent("/portefeuille?vue=1")), location);
});

test("sans session et sans sous-chemin (poste local), même règle", () => {
  const res = middleware(new NextRequest("http://127.0.0.1:3001/temps"));
  assert.equal(res.headers.get("location"), `/connexion?suite=${encodeURIComponent("/temps")}`);
});
