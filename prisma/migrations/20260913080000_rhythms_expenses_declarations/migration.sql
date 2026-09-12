-- Rythmes de travail historisés, charge planifiée, dépenses directes, déclarations de semaine complète
CREATE TABLE "Rhythm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hoursEven" TEXT NOT NULL,
    "hoursOdd" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "Rhythm_code_key" ON "Rhythm"("code");
CREATE TABLE "PersonRhythmPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "rhythmId" TEXT NOT NULL,
    "from" DATETIME NOT NULL,
    "to" DATETIME,
    CONSTRAINT "PersonRhythmPeriod_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonRhythmPeriod_rhythmId_fkey" FOREIGN KEY ("rhythmId") REFERENCES "Rhythm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "WeekDeclaration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "declaredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeekDeclaration_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WeekDeclaration_personId_week_key" ON "WeekDeclaration"("personId", "week");
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "supplier" TEXT,
    "committed" REAL NOT NULL DEFAULT 0,
    "spent" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reference" TEXT,
    "validationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "ValidationRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Expense_validationId_key" ON "Expense"("validationId");
ALTER TABLE "EditionPersonDays" ADD COLUMN "plannedDays" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN "hoursPerDay" REAL NOT NULL DEFAULT 7;
-- « En retard » devient une alerte calculée, plus un état
UPDATE "Action" SET "state" = 'doing' WHERE "state" = 'late';
DELETE FROM "RefValue" WHERE "family" = 'action_state' AND "code" = 'late';
