import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

// Régression du 26/09 : derrière Nginx, Next écoute sur 127.0.0.1 ; la redirection vers la connexion doit viser l'hôte
// public transmis par Nginx (jamais https://localhost:…), avec le sous-chemin de l'instance et la page demandée.
test("sans session, la redirection vise l'hôte public et garde le sous-chemin", () => {
  const req = new NextRequest("https://localhost:3002/outilcli/cress/pilote/portefeuille?vue=1", {
    nextConfig: { basePath: "/outilcli/cress/pilote" },
    headers: { host: "cress.bazixx.fr", "x-forwarded-proto": "https" },
  });
  const res = middleware(req);
  assert.equal(res.status, 307);
  const location = new URL(res.headers.get("location") ?? "");
  assert.equal(location.origin, "https://cress.bazixx.fr");
  assert.equal(location.pathname, "/outilcli/cress/pilote/connexion");
  assert.equal(location.searchParams.get("suite"), "/portefeuille?vue=1");
});

test("sur le poste (pas de proxy), l'hôte de la requête est gardé", () => {
  const res = middleware(new NextRequest("http://localhost:3100/temps", { headers: { host: "localhost:3100" } }));
  assert.equal(res.headers.get("location"), `http://localhost:3100/connexion?suite=${encodeURIComponent("/temps")}`);
});
