import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("les Server Actions de calcul vérifient le périmètre avant le budget", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/actions/edition.ts"), "utf8");
  const guard = source.indexOf("async function assertEditionReadable");
  const explain = source.indexOf("export async function explainRequiredLevel");
  assert.ok(guard >= 0 && explain > guard);
  assert.ok(source.indexOf("await assertEditionReadable(editionId)", explain) > explain);
  assert.ok(source.indexOf("const settings = await getSettings()", explain) > source.indexOf("await assertEditionReadable(editionId)", explain));
});
