-- Matériel et prêts (18/09) : inventaire et registre des prêts ; module et droit posés sur l'existant.
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "reference" TEXT,
    "location" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL DEFAULT 'ok',
    "purchasedAt" TIMESTAMP(3),
    "value" DOUBLE PRECISION,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Equipment_category_idx" ON "Equipment"("category");
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "personId" TEXT,
    "contactId" TEXT,
    "organisationId" TEXT,
    "editionId" TEXT,
    "outAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnNote" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Loan_equipmentId_idx" ON "Loan"("equipmentId");
CREATE INDEX "Loan_returnedAt_idx" ON "Loan"("returnedAt");
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Settings" ALTER COLUMN "modules" SET DEFAULT 'veille,adherents,tresorerie,materiel';
UPDATE "Settings" SET "modules" = CASE WHEN "modules" = '' THEN 'materiel' ELSE "modules" || ',materiel' END WHERE "modules" NOT LIKE '%materiel%';
-- Droit : l'inventaire se tient par la direction, la RAF et l'assistant·e ; tout le monde emprunte et rend.
UPDATE "Role" SET "permissions" = "permissions" || ',equipment.manage' WHERE "code" IN ('director', 'raf', 'assistant') AND "permissions" NOT LIKE '%equipment.manage%';
