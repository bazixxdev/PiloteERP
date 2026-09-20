import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("la décision réclame atomiquement la proposition pending", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/actions/proposals.ts"), "utf8");
  const claim = source.indexOf('tx.changeProposal.updateMany({ where: { id, status: "pending" }');
  const effect = source.indexOf('tx.edition.findUnique', claim);
  assert.ok(claim >= 0);
  assert.ok(effect > claim);
  assert.match(source, /PROPOSAL_ALREADY_DECIDED/);
});
