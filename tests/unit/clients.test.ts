import { test } from "node:test";
import assert from "node:assert/strict";
import { cress } from "../../config/clients/cress";
import { tlst } from "../../config/clients/tlst";
import { CLIENT_KEYS, clientFor } from "../../config/clients/index";

const VOCAB_KEYS = ["projet", "edition", "action", "pole", "codir", "raf", "direction", "pilote", "sponsor"] as const;

test("chaque client a un nom, ses quatre images et ses neuf mots", () => {
  for (const c of [cress, tlst]) {
    assert.ok(c.shortName && c.longName, c.key);
    for (const k of ["color", "white", "mark"] as const) assert.match(c.logos[k].src, /^\/clients\/[a-z]+\/[a-z-]+\.png$/, `${c.key} ${k}`);
    assert.match(c.logos.favicon, /^\/clients\/[a-z]+\/favicon\.png$/);
    for (const w of VOCAB_KEYS) {
      assert.ok(c.vocab[w].one && c.vocab[w].many, `${c.key} vocab.${w}`);
      assert.ok(["m", "f"].includes(c.vocab[w].gender));
    }
  }
});

// La valeur des mots eux-mêmes (« année », « pôle »…) est vérifiée par tests/unit/vocab-tests.test.ts et composée dans les
// recettes via tests/vocab.ts : ici, seule la forme (nom court, chemins, modules — pas du vocabulaire) est du ressort de ce test.
test("la CRESS a son nom, son genre et ses chemins", () => {
  assert.equal(cress.shortName, "CRESS");
  assert.equal(cress.longName, "CRESS Centre-Val de Loire");
  assert.equal(cress.orgGender, "f");
  assert.equal(cress.settings.serverPathTemplate, "\\\\cress\\Partage\\Action\\{code}\\{annee}");
  assert.equal(cress.settings.billingEmail, "factures@cress-cvl.example");
  assert.equal(cress.modules, "veille,adherents,tresorerie,materiel");
});

test("TLST a son nom et son genre", () => {
  assert.equal(tlst.shortName, "TLST");
  assert.equal(tlst.orgGender, "m");
});

test("clientFor choisit par clé et refuse l'inconnu", () => {
  assert.deepEqual([...CLIENT_KEYS], ["cress", "tlst"]);
  assert.equal(clientFor("cress"), cress);
  assert.equal(clientFor("tlst"), tlst);
  assert.equal(clientFor(undefined), cress);
  assert.throws(() => clientFor("acme"), /NEXT_PUBLIC_CLIENT/);
});
