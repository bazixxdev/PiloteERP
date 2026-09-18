-- Connecteur Brevo (18/09) : attributs et date de synchronisation sur les contacts, listes miroir d'une liste Brevo
-- (source, identifiant, date), compte rendu de synchronisation dans les paramètres.
ALTER TABLE "Contact"
  ADD COLUMN "brevoAttributes" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN "brevoSyncedAt" TIMESTAMP(3);
ALTER TABLE "ContactList"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "brevoListId" INTEGER,
  ADD COLUMN "brevoSyncedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "ContactList_brevoListId_key" ON "ContactList"("brevoListId");
ALTER TABLE "Settings"
  ADD COLUMN "brevoSyncedAt" TIMESTAMP(3),
  ADD COLUMN "brevoSyncReport" TEXT;
