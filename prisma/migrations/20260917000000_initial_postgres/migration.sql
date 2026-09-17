-- Migration initiale PostgreSQL (17/09/2026) : le schéma complet en une fois. Les 30 migrations SQLite du prototype
-- (12/09 → 15/09) restent dans l'historique git ; aucune donnée réelle n'existait, la démo se reseed.
-- CreateTable
CREATE TABLE "Pole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadId" TEXT,

    CONSTRAINT "Pole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "poleId" TEXT,
    "role" TEXT NOT NULL,
    "workRhythm" TEXT NOT NULL,
    "availableDays" INTEGER NOT NULL DEFAULT 200,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "icsToken" TEXT,
    "modules" TEXT NOT NULL DEFAULT 'tasks,notes,split',
    "fixedShare" BOOLEAN NOT NULL DEFAULT false,
    "fixedShareNote" TEXT,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TimeCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonTimeCode" (
    "personId" TEXT NOT NULL,
    "timeCodeId" TEXT NOT NULL,

    CONSTRAINT "PersonTimeCode_pkey" PRIMARY KEY ("personId","timeCodeId")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Funder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunderContact" (
    "id" TEXT NOT NULL,
    "funderId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunderContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convention" (
    "id" TEXT NOT NULL,
    "funderId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "scheme" TEXT,
    "label" TEXT,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'to_submit',
    "amountRequested" DOUBLE PRECISION,
    "amountNotified" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "notes" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Convention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefValue" (
    "id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RefValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "analyticCode" TEXT NOT NULL,
    "poleId" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "guarantorId" TEXT,
    "missionId" TEXT NOT NULL,
    "strategicAxis" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPole" (
    "projectId" TEXT NOT NULL,
    "poleId" TEXT NOT NULL,

    CONSTRAINT "ProjectPole_pkey" PRIMARY KEY ("projectId","poleId")
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "decisionDate" TIMESTAMP(3),
    "conditionalStart" BOOLEAN NOT NULL DEFAULT false,
    "stakes" TEXT,
    "axis" TEXT,
    "sressMeasure" TEXT,
    "snessLink" TEXT,
    "otherTexts" TEXT,
    "yearPriorities" TEXT,
    "expectedOutcome" TEXT,
    "plannedFunders" TEXT,
    "directExpenseEnvelope" DOUBLE PRECISION,
    "fte" DOUBLE PRECISION,
    "imposedIndicators" TEXT,
    "sponsorId" TEXT,
    "operationalObjectives" TEXT,
    "quantitativeObjectives" TEXT,
    "content" TEXT,
    "audience" TEXT,
    "calendar" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "partners" TEXT,
    "method" TEXT,
    "governance" TEXT,
    "ownIndicators" TEXT,
    "timeNeed" TEXT,
    "budgetNeed" TEXT,
    "codirDecision" TEXT,
    "codirDate" TIMESTAMP(3),
    "boardValidated" BOOLEAN NOT NULL DEFAULT false,
    "boardDate" TIMESTAMP(3),
    "venues" TEXT,
    "equipment" TEXT,
    "evidenceToKeep" TEXT,
    "evaluation" TEXT,
    "report" TEXT,
    "budgetEnvelope" DOUBLE PRECISION,
    "committed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionTeam" (
    "editionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "EditionTeam_pkey" PRIMARY KEY ("editionId","personId")
);

-- CreateTable
CREATE TABLE "PlannedLoad" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PlannedLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionPersonDays" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "soldDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableDays" DOUBLE PRECISION,

    CONSTRAINT "EditionPersonDays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "milestoneDate" TIMESTAMP(3),
    "timeTarget" DOUBLE PRECISION,
    "state" TEXT NOT NULL DEFAULT 'todo',
    "fundingLineId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "venue" TEXT,
    "participants" TEXT,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingLine" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "funderId" TEXT NOT NULL,
    "conventionId" TEXT,
    "scheme" TEXT,
    "status" TEXT NOT NULL DEFAULT 'to_submit',
    "amountRequested" DOUBLE PRECISION,
    "amountGranted" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "contractedAt" TIMESTAMP(3),
    "analyticCode" TEXT,
    "allocationKeyRef" TEXT,
    "multiYear" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "contactId" TEXT,

    CONSTRAINT "FundingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "fundingLineId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "fundingLineId" TEXT,
    "conventionId" TEXT,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "expectedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "projectId" TEXT,
    "actionId" TEXT,
    "timeCodeId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthLock" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRequest" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "actionId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "attachmentUrl" TEXT,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deciderId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "targetDelayDays" INTEGER NOT NULL DEFAULT 5,
    "supplier" TEXT,
    "supplierEmail" TEXT,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "requesterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "poleId" TEXT,
    "editionId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "answer" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "validationThresholdLevel1" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "validationThresholdLevel2" DOUBLE PRECISION NOT NULL DEFAULT 3000,
    "reminderDaysBefore" TEXT NOT NULL DEFAULT '30,7',
    "envelopeAlertPercent" INTEGER NOT NULL DEFAULT 80,
    "deliverableAlertDays" INTEGER NOT NULL DEFAULT 30,
    "timeVisibility" TEXT NOT NULL DEFAULT 'self_pole_lead_raf',
    "horizonDays" INTEGER NOT NULL DEFAULT 90,
    "deadlineSyncAt" TIMESTAMP(3),
    "timeRules" TEXT NOT NULL DEFAULT '',
    "serverPathTemplate" TEXT NOT NULL DEFAULT '\\cress\Partage\Action\{code}\{annee}',
    "teamIcsToken" TEXT,
    "apiToken" TEXT,
    "hoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "operatingDaysPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingEmail" TEXT NOT NULL DEFAULT 'factures@cress-cvl.example',
    "billingNote" TEXT NOT NULL DEFAULT 'Merci d''adresser la facture à cette adresse, en rappelant la référence du devis et le nom du projet.',
    "modules" TEXT NOT NULL DEFAULT 'veille',
    "realizedSource" TEXT NOT NULL DEFAULT 'raf',
    "pennylaneAxes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerLine" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "analyticCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountLabel" TEXT,
    "year" INTEGER NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "detail" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticTag" (
    "code" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticTag_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "LedgerImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "fileName" TEXT,
    "lines" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "byId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "funderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scheme" TEXT,
    "deadline" TIMESTAMP(3),
    "rolling" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "amountHint" TEXT,
    "link" TEXT,
    "note" TEXT,
    "teamStatus" TEXT,
    "statusById" TEXT,
    "statusAt" TIMESTAMP(3),
    "conventionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadFreeze" (
    "year" INTEGER NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frozenById" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "LoadFreeze_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "ChangeProposal" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "proposed" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "actionId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "label" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocLink" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "codirOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DocLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "target" TEXT,
    "actual" TEXT,
    "imposed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "fundingLineId" TEXT,
    "deliverableId" TEXT,
    "validationId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rhythm" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hoursEven" TEXT NOT NULL,
    "hoursOdd" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Rhythm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonRhythmPeriod" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "rhythmId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3),

    CONSTRAINT "PersonRhythmPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekDeclaration" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "supplier" TEXT,
    "committed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reference" TEXT,
    "validationId" TEXT,
    "nature" TEXT,
    "invoiceReceivedAt" TIMESTAMP(3),
    "serviceDoneAt" TIMESTAMP(3),
    "serviceDoneById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "instance" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "followUpId" TEXT,
    "dueDate" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertKind" TEXT,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "senderId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "editionId" TEXT,
    "actionId" TEXT,
    "listId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskList" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "color" TEXT,
    "editionId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" TEXT NOT NULL DEFAULT 'project',
    "editionId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "color" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteShare" (
    "noteId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteShare_pkey" PRIMARY KEY ("noteId","personId")
);

-- CreateTable
CREATE TABLE "WorkSlot" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldRemark" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'other',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "FieldRemark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_icsToken_key" ON "Person"("icsToken");

-- CreateIndex
CREATE UNIQUE INDEX "TimeCode_code_key" ON "TimeCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Funder_name_key" ON "Funder"("name");

-- CreateIndex
CREATE INDEX "FunderContact_funderId_idx" ON "FunderContact"("funderId");

-- CreateIndex
CREATE UNIQUE INDEX "Convention_reference_key" ON "Convention"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "RefValue_family_code_key" ON "RefValue"("family", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_projectId_year_key" ON "Edition"("projectId", "year");

-- CreateIndex
CREATE INDEX "PlannedLoad_personId_month_idx" ON "PlannedLoad"("personId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedLoad_editionId_personId_month_key" ON "PlannedLoad"("editionId", "personId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "EditionPersonDays_editionId_personId_key" ON "EditionPersonDays"("editionId", "personId");

-- CreateIndex
CREATE INDEX "Payment_fundingLineId_idx" ON "Payment"("fundingLineId");

-- CreateIndex
CREATE INDEX "Payment_conventionId_idx" ON "Payment"("conventionId");

-- CreateIndex
CREATE INDEX "Payment_expectedAt_idx" ON "Payment"("expectedAt");

-- CreateIndex
CREATE INDEX "TimeEntry_personId_date_idx" ON "TimeEntry"("personId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MonthLock_personId_month_key" ON "MonthLock"("personId", "month");

-- CreateIndex
CREATE INDEX "Request_assigneeId_status_idx" ON "Request"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Request_poleId_status_idx" ON "Request"("poleId", "status");

-- CreateIndex
CREATE INDEX "LedgerLine_analyticCode_year_idx" ON "LedgerLine"("analyticCode", "year");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerLine_source_analyticCode_accountNumber_year_key" ON "LedgerLine"("source", "analyticCode", "accountNumber", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Call_conventionId_key" ON "Call"("conventionId");

-- CreateIndex
CREATE INDEX "Call_funderId_idx" ON "Call"("funderId");

-- CreateIndex
CREATE INDEX "Call_deadline_idx" ON "Call"("deadline");

-- CreateIndex
CREATE INDEX "Call_teamStatus_idx" ON "Call"("teamStatus");

-- CreateIndex
CREATE INDEX "ChangeProposal_editionId_status_idx" ON "ChangeProposal"("editionId", "status");

-- CreateIndex
CREATE INDEX "Achievement_editionId_date_idx" ON "Achievement"("editionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storedName_key" ON "Attachment"("storedName");

-- CreateIndex
CREATE UNIQUE INDEX "Rhythm_code_key" ON "Rhythm"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WeekDeclaration_personId_week_key" ON "WeekDeclaration"("personId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_validationId_key" ON "Expense"("validationId");

-- CreateIndex
CREATE INDEX "Notification_personId_readAt_idx" ON "Notification"("personId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_personId_dedupeKey_key" ON "Notification"("personId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Task_personId_done_idx" ON "Task"("personId", "done");

-- CreateIndex
CREATE INDEX "TaskList_personId_idx" ON "TaskList"("personId");

-- CreateIndex
CREATE INDEX "Note_authorId_idx" ON "Note"("authorId");

-- CreateIndex
CREATE INDEX "Note_editionId_idx" ON "Note"("editionId");

-- CreateIndex
CREATE INDEX "NoteShare_personId_idx" ON "NoteShare"("personId");

-- CreateIndex
CREATE INDEX "WorkSlot_taskId_idx" ON "WorkSlot"("taskId");

-- CreateIndex
CREATE INDEX "FieldRemark_editionId_resolvedAt_idx" ON "FieldRemark"("editionId", "resolvedAt");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- AddForeignKey
ALTER TABLE "Pole" ADD CONSTRAINT "Pole_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTimeCode" ADD CONSTRAINT "PersonTimeCode_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTimeCode" ADD CONSTRAINT "PersonTimeCode_timeCodeId_fkey" FOREIGN KEY ("timeCodeId") REFERENCES "TimeCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunderContact" ADD CONSTRAINT "FunderContact_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convention" ADD CONSTRAINT "Convention_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convention" ADD CONSTRAINT "Convention_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "FunderContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_guarantorId_fkey" FOREIGN KEY ("guarantorId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPole" ADD CONSTRAINT "ProjectPole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPole" ADD CONSTRAINT "ProjectPole_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionTeam" ADD CONSTRAINT "EditionTeam_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionTeam" ADD CONSTRAINT "EditionTeam_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedLoad" ADD CONSTRAINT "PlannedLoad_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedLoad" ADD CONSTRAINT "PlannedLoad_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionPersonDays" ADD CONSTRAINT "EditionPersonDays_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionPersonDays" ADD CONSTRAINT "EditionPersonDays_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_fundingLineId_fkey" FOREIGN KEY ("fundingLineId") REFERENCES "FundingLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingLine" ADD CONSTRAINT "FundingLine_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingLine" ADD CONSTRAINT "FundingLine_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingLine" ADD CONSTRAINT "FundingLine_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingLine" ADD CONSTRAINT "FundingLine_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "FunderContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_fundingLineId_fkey" FOREIGN KEY ("fundingLineId") REFERENCES "FundingLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fundingLineId_fkey" FOREIGN KEY ("fundingLineId") REFERENCES "FundingLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_timeCodeId_fkey" FOREIGN KEY ("timeCodeId") REFERENCES "TimeCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthLock" ADD CONSTRAINT "MonthLock_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthLock" ADD CONSTRAINT "MonthLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRequest" ADD CONSTRAINT "ValidationRequest_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRequest" ADD CONSTRAINT "ValidationRequest_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRequest" ADD CONSTRAINT "ValidationRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRequest" ADD CONSTRAINT "ValidationRequest_deciderId_fkey" FOREIGN KEY ("deciderId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRequest" ADD CONSTRAINT "ValidationRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadFreeze" ADD CONSTRAINT "LoadFreeze_frozenById_fkey" FOREIGN KEY ("frozenById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocLink" ADD CONSTRAINT "DocLink_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_fundingLineId_fkey" FOREIGN KEY ("fundingLineId") REFERENCES "FundingLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "ValidationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRhythmPeriod" ADD CONSTRAINT "PersonRhythmPeriod_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRhythmPeriod" ADD CONSTRAINT "PersonRhythmPeriod_rhythmId_fkey" FOREIGN KEY ("rhythmId") REFERENCES "Rhythm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekDeclaration" ADD CONSTRAINT "WeekDeclaration_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "ValidationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_serviceDoneById_fkey" FOREIGN KEY ("serviceDoneById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TaskList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskList" ADD CONSTRAINT "TaskList_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskList" ADD CONSTRAINT "TaskList_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteShare" ADD CONSTRAINT "NoteShare_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteShare" ADD CONSTRAINT "NoteShare_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSlot" ADD CONSTRAINT "WorkSlot_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldRemark" ADD CONSTRAINT "FieldRemark_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldRemark" ADD CONSTRAINT "FieldRemark_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldRemark" ADD CONSTRAINT "FieldRemark_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

