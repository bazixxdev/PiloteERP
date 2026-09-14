-- Lot 2 « La fiche et son cycle » : motif des remarques, occurrences d'action, jours de fonctionnement, plan de charge figé,
-- propositions de modification, réalisations.
ALTER TABLE "FieldRemark" ADD COLUMN "reason" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "Action" ADD COLUMN "description" TEXT;
ALTER TABLE "Action" ADD COLUMN "venue" TEXT;
ALTER TABLE "Action" ADD COLUMN "participants" TEXT;
ALTER TABLE "Settings" ADD COLUMN "operatingDaysPerMonth" REAL NOT NULL DEFAULT 0;

CREATE TABLE "LoadFreeze" (
    "year" INTEGER NOT NULL PRIMARY KEY,
    "frozenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frozenById" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "LoadFreeze_frozenById_fkey" FOREIGN KEY ("frozenById") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ChangeProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "proposed" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeProposal_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangeProposal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChangeProposal_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ChangeProposal_editionId_status_idx" ON "ChangeProposal"("editionId", "status");

CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "actionId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "label" TEXT NOT NULL,
    "value" REAL,
    "unit" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Achievement_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Achievement_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Achievement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Achievement_editionId_date_idx" ON "Achievement"("editionId", "date");
