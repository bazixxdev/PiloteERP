import { test } from "node:test";
import assert from "node:assert/strict";
import type { Word } from "../../config/clients/types";
import { cap, le, un, du, de, au, ce, mon, tout, adj, pl, ppe, elide } from "../../lib/vocab";

const edition: Word = { one: "édition", many: "éditions", gender: "f" };
const action: Word = { one: "action", many: "actions", gender: "f" };
const pole: Word = { one: "pôle", many: "pôles", gender: "m" };
const equipe: Word = { one: "équipe", many: "équipes", gender: "f" };
const coord: Word = { one: "coordination", many: "coordinations", gender: "f" };
const cress: Word = { one: "CRESS", many: "CRESS", gender: "f" };
const tlst: Word = { one: "TLST", many: "TLST", gender: "m" };
const codir: Word = { one: "CODIR", many: "CODIR", gender: "m" };

test("élision devant une voyelle ou un h muet", () => {
  assert.equal(elide("édition"), true);
  assert.equal(elide("action"), true);
  assert.equal(elide("pôle"), false);
  assert.equal(elide("équipe"), true);
  assert.equal(elide("habilitation"), true);
  assert.equal(elide("CRESS"), false);
});

test("articles", () => {
  assert.equal(le(edition), "l'édition");
  assert.equal(le(pole), "le pôle");
  assert.equal(le(equipe), "l'équipe");
  assert.equal(le(cress), "la CRESS");
  assert.equal(le(tlst), "le TLST");
  assert.equal(un(edition), "une édition");
  assert.equal(un(pole), "un pôle");
  assert.equal(du(edition), "de l'édition");
  assert.equal(du(pole), "du pôle");
  assert.equal(du(cress), "de la CRESS");
  assert.equal(de(edition), "d'édition");
  assert.equal(de(pole), "de pôle");
  assert.equal(au(pole), "au pôle");
  assert.equal(au(edition), "à l'édition");
  assert.equal(au(cress), "à la CRESS");
  assert.equal(ce(pole), "ce pôle");
  assert.equal(ce(edition), "cette édition");
  assert.equal(ce(action), "cette action");
  assert.equal(mon(pole), "mon pôle");
  assert.equal(mon(equipe), "mon équipe");
  assert.equal(mon(coord), "ma coordination");
});

test("tout, capitale, accord, pluriel", () => {
  assert.equal(tout(cress), "toute la CRESS");
  assert.equal(tout(tlst), "tout le TLST");
  assert.equal(cap(tout(cress)), "Toute la CRESS");
  assert.equal(cap(edition), "Édition");
  assert.equal(cap(le(edition)), "L'édition");
  assert.equal(adj(pole, "nouveau", "nouvelle"), "nouveau pôle");
  assert.equal(adj(equipe, "nouveau", "nouvelle"), "nouvelle équipe");
  assert.equal(ppe(edition, "validé"), "édition validée");
  assert.equal(ppe(pole, "validé"), "pôle validé");
  assert.equal(pl(edition), "éditions");
  assert.equal(cap(pl(codir)), "CODIR");
});
