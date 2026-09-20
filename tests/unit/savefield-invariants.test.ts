import assert from "node:assert/strict";
import { test } from "node:test";
import { FIELDS } from "../../lib/fields";

test("l'état du matériel passe par l'action métier et n'est plus éditable via saveField", () => {
  assert.equal(FIELDS.equipment.state, undefined);
  assert.ok(FIELDS.equipment.notes);
});
