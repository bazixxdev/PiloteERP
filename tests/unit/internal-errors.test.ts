import assert from "node:assert/strict";
import { test } from "node:test";
import { reportInternalError } from "@/lib/errors";

test("les erreurs techniques ont un contrat client stable", () => {
  const result = reportInternalError("test", new Error("Prisma P2025: User secret_table not found"));
  assert.equal(result.code, "INTERNAL_ERROR");
  assert.equal(result.error, "Une erreur interne est survenue. Réessayez plus tard.");
  assert.doesNotMatch(result.error, /Prisma|P2025|secret_table/);
});
