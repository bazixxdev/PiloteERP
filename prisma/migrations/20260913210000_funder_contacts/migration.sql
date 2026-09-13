-- Contacts des financeurs ; contact du dossier sur les lignes de financement et les conventions
ALTER TABLE "Funder" ADD COLUMN "notes" TEXT;
CREATE TABLE "FunderContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funderId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FunderContact_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FunderContact_funderId_idx" ON "FunderContact"("funderId");
ALTER TABLE "FundingLine" ADD COLUMN "contactId" TEXT REFERENCES "FunderContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Convention" ADD COLUMN "contactId" TEXT REFERENCES "FunderContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
