import { test } from "node:test";
import assert from "node:assert/strict";
import { preparedYear, prepareInSeason } from "../../lib/season";

const d = (iso: string) => new Date(`${iso}T12:00:00`);

test("l'année préparée : l'année suivante de septembre à décembre, l'année qui commence en janvier", () => {
  assert.equal(preparedYear(d("2026-09-01")), 2027);
  assert.equal(preparedYear(d("2026-12-31")), 2027);
  assert.equal(preparedYear(d("2027-01-01")), 2027);
  assert.equal(preparedYear(d("2027-01-31")), 2027);
  assert.equal(preparedYear(d("2027-02-01")), 2028);
  assert.equal(preparedYear(d("2027-06-15")), 2028);
});

test("la saison de Préparer : de septembre à janvier", () => {
  assert.equal(prepareInSeason(d("2026-08-31")), false);
  assert.equal(prepareInSeason(d("2026-09-01")), true);
  assert.equal(prepareInSeason(d("2026-12-15")), true);
  assert.equal(prepareInSeason(d("2027-01-31")), true);
  assert.equal(prepareInSeason(d("2027-02-01")), false);
});
