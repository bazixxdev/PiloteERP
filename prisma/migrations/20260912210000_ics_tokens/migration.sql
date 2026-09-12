-- Jetons des flux agenda (.ics), personnels et équipe
ALTER TABLE "Person" ADD COLUMN "icsToken" TEXT;
ALTER TABLE "Settings" ADD COLUMN "teamIcsToken" TEXT;
CREATE UNIQUE INDEX "Person_icsToken_key" ON "Person"("icsToken");
