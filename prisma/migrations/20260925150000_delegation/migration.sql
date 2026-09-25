-- Délégation (25/09, docs/superpowers/specs/2026-09-25-delegation-design.md). Migration « expand » : deux tables, un drapeau,
-- un réglage ; rien d'existant n'est renommé ni supprimé.

-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "isCheckpoint" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "delegationPeriods" TEXT NOT NULL DEFAULT '01-06,07-12';

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "expectations" TEXT,
    "limits" TEXT,
    "controls" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "boardPresentedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelegationRevision" (
    "id" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "expectations" TEXT,
    "limits" TEXT,
    "controls" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Delegation_personId_editionId_key" ON "Delegation"("personId", "editionId");

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationRevision" ADD CONSTRAINT "DelegationRevision_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationRevision" ADD CONSTRAINT "DelegationRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Droits nouveaux donnés à la direction des installations existantes (réglables ensuite dans Admin › Rôles et droits).
UPDATE "Role" SET "permissions" = CASE WHEN "permissions" = '' THEN 'delegation.write,delegation.view_all' ELSE "permissions" || ',delegation.write,delegation.view_all' END
  WHERE "code" = 'director' AND "permissions" NOT LIKE '%delegation.write%';
