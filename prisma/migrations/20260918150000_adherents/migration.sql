-- Adhérents + HelloAsso (18/09) : table des adhésions, miroir des inscrits d'un formulaire HelloAsso sur les listes,
-- compte rendu de synchronisation ; le module « adherents » et le droit « members.manage » sont posés sur l'existant.
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "contactId" TEXT,
    "year" INTEGER NOT NULL,
    "college" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'due',
    "paidAt" TIMESTAMP(3),
    "method" TEXT,
    "helloAssoItemId" TEXT,
    "helloAssoForm" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Membership_helloAssoItemId_key" ON "Membership"("helloAssoItemId");
CREATE INDEX "Membership_year_idx" ON "Membership"("year");
CREATE INDEX "Membership_organisationId_idx" ON "Membership"("organisationId");
CREATE INDEX "Membership_contactId_idx" ON "Membership"("contactId");
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactList" ADD COLUMN "helloAssoForm" TEXT;
CREATE UNIQUE INDEX "ContactList_helloAssoForm_key" ON "ContactList"("helloAssoForm");

ALTER TABLE "Settings"
  ADD COLUMN "helloAssoSyncedAt" TIMESTAMP(3),
  ADD COLUMN "helloAssoSyncReport" TEXT;
ALTER TABLE "Settings" ALTER COLUMN "modules" SET DEFAULT 'veille,adherents';
UPDATE "Settings" SET "modules" = CASE WHEN "modules" = '' THEN 'adherents' ELSE "modules" || ',adherents' END WHERE "modules" NOT LIKE '%adherents%';

-- Le droit « gère les adhésions » va à la direction et à la RAF (les rôles système existants ne sont pas reseedés).
UPDATE "Role" SET "permissions" = CASE WHEN "permissions" = '' THEN 'members.manage' ELSE "permissions" || ',members.manage' END WHERE "code" IN ('director', 'raf') AND "permissions" NOT LIKE '%members.manage%';
