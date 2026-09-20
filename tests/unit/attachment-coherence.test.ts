import test from "node:test";
import assert from "node:assert/strict";
import { attachmentParentsAreConsistent } from "@/lib/attachment-coherence";

test("les parents d'une pièce doivent appartenir à la même édition", () => {
  assert.equal(attachmentParentsAreConsistent({ editionId: "A", validationEditionId: "A" }), true);
  assert.equal(attachmentParentsAreConsistent({ editionId: "A", validationEditionId: "B" }), false);
  assert.equal(attachmentParentsAreConsistent({ editionId: "A", fundingLineEditionId: "B" }), false);
  assert.equal(attachmentParentsAreConsistent({ editionId: "A", deliverableEditionId: "A", conventionLinked: false }), false);
});
