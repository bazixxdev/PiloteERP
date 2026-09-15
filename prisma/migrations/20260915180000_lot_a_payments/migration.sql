-- Lot A : versements attendus / reçus sur une ligne de financement ou une convention.
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fundingLineId" TEXT,
    "conventionId" TEXT,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "expectedAt" DATETIME NOT NULL,
    "receivedAt" DATETIME,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_fundingLineId_fkey" FOREIGN KEY ("fundingLineId") REFERENCES "FundingLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Payment_fundingLineId_idx" ON "Payment"("fundingLineId");
CREATE INDEX "Payment_conventionId_idx" ON "Payment"("conventionId");
CREATE INDEX "Payment_expectedAt_idx" ON "Payment"("expectedAt");
