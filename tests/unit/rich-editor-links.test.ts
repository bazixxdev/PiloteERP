import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("les liens Tiptap sont isolés de window.opener", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "components/common/rich-editor.tsx"), "utf8");
  assert.match(source, /rel: "noopener noreferrer"/);
  assert.match(source, /target: "_blank"/);
  assert.match(source, /replace\(\/\\srel/);
});
