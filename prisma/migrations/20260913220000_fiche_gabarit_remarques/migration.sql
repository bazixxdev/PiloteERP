-- Fiche projet alignée sur le gabarit Word : rubriques manquantes ; remarques par rubrique (comme les commentaires Word)
ALTER TABLE "Edition" ADD COLUMN "snessLink" TEXT;
ALTER TABLE "Edition" ADD COLUMN "otherTexts" TEXT;
ALTER TABLE "Edition" ADD COLUMN "sponsorId" TEXT REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Edition" ADD COLUMN "quantitativeObjectives" TEXT;
ALTER TABLE "Edition" ADD COLUMN "content" TEXT;
ALTER TABLE "Edition" ADD COLUMN "audience" TEXT;
ALTER TABLE "Edition" ADD COLUMN "deliveryDate" DATETIME;
CREATE TABLE "FieldRemark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    CONSTRAINT "FieldRemark_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FieldRemark_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FieldRemark_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "FieldRemark_editionId_resolvedAt_idx" ON "FieldRemark"("editionId", "resolvedAt");
