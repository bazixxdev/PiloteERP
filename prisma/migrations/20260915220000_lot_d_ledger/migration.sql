-- Lot D : réalisé comptable (snapshot du grand livre analytique), correspondances de codes, journal des imports.
ALTER TABLE "Settings" ADD COLUMN "realizedSource" TEXT NOT NULL DEFAULT 'raf';
ALTER TABLE "Settings" ADD COLUMN "pennylaneAxes" TEXT NOT NULL DEFAULT '';

CREATE TABLE "LedgerLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "analyticCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountLabel" TEXT,
    "year" INTEGER NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "detail" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "LedgerLine_source_analyticCode_accountNumber_year_key" ON "LedgerLine"("source", "analyticCode", "accountNumber", "year");
CREATE INDEX "LedgerLine_analyticCode_year_idx" ON "LedgerLine"("analyticCode", "year");

CREATE TABLE "AnalyticTag" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "LedgerImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "fileName" TEXT,
    "lines" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "byId" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
