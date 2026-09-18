import { test } from "node:test";
import assert from "node:assert/strict";
import { cress } from "../../config/clients/cress";
import { tlst } from "../../config/clients/tlst";
import { CLIENT_KEYS, clientFor } from "../../config/clients/index";

test("chaque client a un nom, ses quatre images et ses huit mots", () => {
  for (const c of [cress, tlst]) {
    assert.ok(c.shortName && c.longName, c.key);
    for (const k of ["color", "white", "mark"] as const) assert.match(c.logos[k].src, /^\/clients\/[a-z]+\/[a-z-]+\.png$/, `${c.key} ${k}`);
    assert.match(c.logos.favicon, /^\/clients\/[a-z]+\/favicon\.png$/);
    for (const w of ["projet", "edition", "action", "pole", "codir", "raf", "direction", "pilote"] as const) {
      assert.ok(c.vocab[w].one && c.vocab[w].many, `${c.key} vocab.${w}`);
      assert.ok(["m", "f"].includes(c.vocab[w].gender));
    }
  }
});

test("la CRESS garde ses mots d'aujourd'hui", () => {
  assert.equal(cress.shortName, "CRESS");
  assert.equal(cress.longName, "CRESS Centre-Val de Loire");
  assert.equal(cress.orgGender, "f");
  assert.equal(cress.vocab.edition.one, "édition");
  assert.equal(cress.vocab.pole.one, "pôle");
  assert.equal(cress.vocab.codir.one, "CODIR");
  assert.equal(cress.settings.serverPathTemplate, "\\\\cress\\Partage\\Action\\{code}\\{annee}");
  assert.equal(cress.settings.billingEmail, "factures@cress-cvl.example");
  assert.equal(cress.modules, "veille,adherents,tresorerie,materiel");
});

test("TLST parle d'actions, d'étapes et d'équipe", () => {
  assert.equal(tlst.shortName, "TLST");
  assert.equal(tlst.orgGender, "m");
  assert.equal(tlst.vocab.edition.one, "action");
  assert.equal(tlst.vocab.action.one, "étape");
  assert.equal(tlst.vocab.pole.one, "équipe");
  assert.equal(tlst.vocab.pole.gender, "f");
});

test("clientFor choisit par clé et refuse l'inconnu", () => {
  assert.deepEqual([...CLIENT_KEYS], ["cress", "tlst"]);
  assert.equal(clientFor("cress"), cress);
  assert.equal(clientFor("tlst"), tlst);
  assert.equal(clientFor(undefined), cress);
  assert.throws(() => clientFor("acme"), /NEXT_PUBLIC_CLIENT/);
});
