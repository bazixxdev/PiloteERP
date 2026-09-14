-- Lot 3 « Demandes, devis, factures, documents » : demandes internes, bon pour accord, circuit facture, adresse de facturation.
ALTER TABLE "ValidationRequest" ADD COLUMN "supplier" TEXT;
ALTER TABLE "ValidationRequest" ADD COLUMN "supplierEmail" TEXT;
ALTER TABLE "Expense" ADD COLUMN "nature" TEXT;
ALTER TABLE "Expense" ADD COLUMN "invoiceReceivedAt" DATETIME;
ALTER TABLE "Expense" ADD COLUMN "serviceDoneAt" DATETIME;
ALTER TABLE "Expense" ADD COLUMN "serviceDoneById" TEXT REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD COLUMN "paidAt" DATETIME;
ALTER TABLE "Settings" ADD COLUMN "billingEmail" TEXT NOT NULL DEFAULT 'factures@cress-cvl.example';
ALTER TABLE "Settings" ADD COLUMN "billingNote" TEXT NOT NULL DEFAULT 'Merci d''adresser la facture à cette adresse, en rappelant la référence du devis et le nom du projet.';

CREATE TABLE "Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "requesterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "poleId" TEXT,
    "editionId" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'open',
    "answer" TEXT,
    "doneAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Request_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Request_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Request_assigneeId_status_idx" ON "Request"("assigneeId", "status");
CREATE INDEX "Request_poleId_status_idx" ON "Request"("poleId", "status");
