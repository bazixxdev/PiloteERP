-- CreateTable
CREATE TABLE "Pole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "leadId" TEXT,
    CONSTRAINT "Pole_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "poleId" TEXT,
    "role" TEXT NOT NULL,
    "workRhythm" TEXT NOT NULL,
    "availableDays" INTEGER NOT NULL DEFAULT 200,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Person_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "PersonTimeCode" (
    "personId" TEXT NOT NULL,
    "timeCodeId" TEXT NOT NULL,

    PRIMARY KEY ("personId", "timeCodeId"),
    CONSTRAINT "PersonTimeCode_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonTimeCode_timeCodeId_fkey" FOREIGN KEY ("timeCodeId") REFERENCES "TimeCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Funder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RefValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "family" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "analyticCode" TEXT NOT NULL,
    "poleId" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "guarantorId" TEXT,
    "missionId" TEXT NOT NULL,
    "strategicAxis" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_guarantorId_fkey" FOREIGN KEY ("guarantorId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "decisionDate" DATETIME,
    "conditionalStart" BOOLEAN NOT NULL DEFAULT false,
    "stakes" TEXT,
    "axis" TEXT,
    "sressMeasure" TEXT,
    "yearPriorities" TEXT,
    "expectedOutcome" TEXT,
    "plannedFunders" TEXT,
    "directExpenseEnvelope" REAL,
    "fte" REAL,
    "imposedIndicators" TEXT,
    "operationalObjectives" TEXT,
    "calendar" TEXT,
    "partners" TEXT,
    "method" TEXT,
    "governance" TEXT,
    "ownIndicators" TEXT,
    "timeNeed" TEXT,
    "budgetNeed" TEXT,
    "codirDecision" TEXT,
    "codirDate" DATETIME,
    "boardValidated" BOOLEAN NOT NULL DEFAULT false,
    "boardDate" DATETIME,
    "venues" TEXT,
    "equipment" TEXT,
    "evidenceToKeep" TEXT,
    "evaluation" TEXT,
    "report" TEXT,
    "budgetEnvelope" REAL,
    "committed" REAL NOT NULL DEFAULT 0,
    "spent" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Edition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EditionTeam" (
    "editionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    PRIMARY KEY ("editionId", "personId"),
    CONSTRAINT "EditionTeam_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EditionTeam_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EditionPersonDays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "soldDays" REAL NOT NULL DEFAULT 0,
    "availableDays" REAL,
    CONSTRAINT "EditionPersonDays_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EditionPersonDays_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "milestoneDate" DATETIME,
    "timeTarget" REAL,
    "state" TEXT NOT NULL DEFAULT 'todo',
    "fundingLineId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Action_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Action_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Action_fundingLineId_fkey" FOREIGN KEY ("fundingLineId") REFERENCES "FundingLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FundingLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "funderId" TEXT NOT NULL,
    "scheme" TEXT,
    "status" TEXT NOT NULL DEFAULT 'to_submit',
    "amountRequested" REAL,
    "amountGranted" REAL,
    "submittedAt" DATETIME,
    "answeredAt" DATETIME,
    "contractedAt" DATETIME,
    "analyticCode" TEXT,
    "allocationKeyRef" TEXT,
    "multiYear" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "FundingLine_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FundingLine_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fundingLineId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    CONSTRAINT "Deliverable_fundingLineId_fkey" FOREIGN KEY ("fundingLineId") REFERENCES "FundingLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "projectId" TEXT,
    "actionId" TEXT,
    "timeCodeId" TEXT,
    "date" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "comment" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TimeEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_timeCodeId_fkey" FOREIGN KEY ("timeCodeId") REFERENCES "TimeCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "lockedById" TEXT NOT NULL,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthLock_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "actionId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "amount" REAL,
    "attachmentUrl" TEXT,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deciderId" TEXT,
    "decidedAt" DATETIME,
    "decisionComment" TEXT,
    "targetDelayDays" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationRequest_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ValidationRequest_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ValidationRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ValidationRequest_deciderId_fkey" FOREIGN KEY ("deciderId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "validationThresholdLevel1" REAL NOT NULL DEFAULT 500,
    "validationThresholdLevel2" REAL NOT NULL DEFAULT 3000,
    "reminderDaysBefore" TEXT NOT NULL DEFAULT '30,7',
    "envelopeAlertPercent" INTEGER NOT NULL DEFAULT 80,
    "deliverableAlertDays" INTEGER NOT NULL DEFAULT 30,
    "timeVisibility" TEXT NOT NULL DEFAULT 'self_pole_lead_raf',
    "horizonDays" INTEGER NOT NULL DEFAULT 90,
    "timeRules" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "DocLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "codirOnly" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DocLink_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeLog_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangeLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "target" TEXT,
    "actual" TEXT,
    "imposed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Indicator_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TimeCode_code_key" ON "TimeCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Funder_name_key" ON "Funder"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RefValue_family_code_key" ON "RefValue"("family", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_projectId_year_key" ON "Edition"("projectId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "EditionPersonDays_editionId_personId_key" ON "EditionPersonDays"("editionId", "personId");

-- CreateIndex
CREATE INDEX "TimeEntry_personId_date_idx" ON "TimeEntry"("personId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MonthLock_personId_month_key" ON "MonthLock"("personId", "month");
