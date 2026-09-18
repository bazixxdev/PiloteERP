-- Fiche de prêt (retour de Gaël, 18/09) : numéro, chèque de caution, envoi ; pièces jointes sur le matériel et les prêts.
CREATE SEQUENCE IF NOT EXISTS "Loan_number_seq";
ALTER TABLE "Loan"
  ADD COLUMN "number" INTEGER NOT NULL DEFAULT nextval('"Loan_number_seq"'),
  ADD COLUMN "depositAmount" DOUBLE PRECISION,
  ADD COLUMN "depositRef" TEXT,
  ADD COLUMN "depositReturnedAt" TIMESTAMP(3),
  ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER SEQUENCE "Loan_number_seq" OWNED BY "Loan"."number";
CREATE UNIQUE INDEX "Loan_number_key" ON "Loan"("number");

ALTER TABLE "Attachment" ALTER COLUMN "editionId" DROP NOT NULL;
ALTER TABLE "Attachment" ADD COLUMN "equipmentId" TEXT, ADD COLUMN "loanId" TEXT;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
