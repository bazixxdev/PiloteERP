-- Lot 0 : modules activés par installation. Lot B : appels à projets (veille).
ALTER TABLE "Settings" ADD COLUMN "modules" TEXT NOT NULL DEFAULT 'veille';

CREATE TABLE "Call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scheme" TEXT,
    "deadline" DATETIME,
    "rolling" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "amountHint" TEXT,
    "link" TEXT,
    "note" TEXT,
    "teamStatus" TEXT,
    "statusById" TEXT,
    "statusAt" DATETIME,
    "conventionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Call_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Call_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Call_conventionId_key" ON "Call"("conventionId");
CREATE INDEX "Call_funderId_idx" ON "Call"("funderId");
CREATE INDEX "Call_deadline_idx" ON "Call"("deadline");
CREATE INDEX "Call_teamStatus_idx" ON "Call"("teamStatus");
