-- Conventions partagées (pluriannuelles, multi-projets) ; les lignes de financement deviennent leurs affectations
CREATE TABLE "Convention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funderId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "scheme" TEXT,
    "label" TEXT,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'to_submit',
    "amountRequested" REAL,
    "amountNotified" REAL,
    "submittedAt" DATETIME,
    "notifiedAt" DATETIME,
    "signedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Convention_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Convention_reference_key" ON "Convention"("reference");
ALTER TABLE "FundingLine" ADD COLUMN "conventionId" TEXT REFERENCES "Convention" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
