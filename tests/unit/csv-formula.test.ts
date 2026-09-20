import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, csvRow } from "@/lib/csv";

test("neutralise les débuts de formule dans les cellules CSV", () => {
  for (const value of ["=1+1", "+1+1", "-1+1", "@SUM(A1:A2)", "\t=1+1", "\r\n=1+1"]) {
    assert.equal(csvCell(value).includes("'"), true, value);
  }
});

test("conserve les valeurs normales et échappe le CSV", () => {
  assert.equal(csvCell("texte"), "texte");
  assert.equal(csvCell(12), "12");
  assert.equal(csvCell("a;b"), '"a;b"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvRow(["ok", "=1+1"]), "ok;'=1+1");
});
