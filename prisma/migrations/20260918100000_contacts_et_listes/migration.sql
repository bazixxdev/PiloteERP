-- Contacts et listes (18/09) : OrganisationContact devient Contact (organisation facultative, tags, adresse, Brevo prêt) ;
-- listes de contacts avec colonnes propres. Les clés étrangères des lignes et conventions suivent le renommage.
ALTER TABLE "OrganisationContact" RENAME TO "Contact";
ALTER TABLE "Contact" RENAME CONSTRAINT "OrganisationContact_pkey" TO "Contact_pkey";
ALTER TABLE "Contact" RENAME CONSTRAINT "OrganisationContact_organisationId_fkey" TO "Contact_organisationId_fkey";
ALTER INDEX "OrganisationContact_organisationId_idx" RENAME TO "Contact_organisationId_idx";
ALTER TABLE "Contact" ALTER COLUMN "organisationId" DROP NOT NULL;
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_organisationId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contact"
  ADD COLUMN "organisationName" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "postcode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "tags" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "brevoContactId" TEXT,
  ADD COLUMN "brevoStatus" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "Contact_brevoContactId_key" ON "Contact"("brevoContactId");
CREATE INDEX "Contact_email_idx" ON "Contact"("email");
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContactList" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "color" TEXT,
    "editionId" TEXT,
    "fields" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactList_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactList_ownerId_idx" ON "ContactList"("ownerId");
ALTER TABLE "ContactList" ADD CONSTRAINT "ContactList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactList" ADD CONSTRAINT "ContactList_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContactListItem" (
    "listId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    "values" TEXT NOT NULL DEFAULT '{}',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactListItem_pkey" PRIMARY KEY ("listId","contactId")
);
ALTER TABLE "ContactListItem" ADD CONSTRAINT "ContactListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactListItem" ADD CONSTRAINT "ContactListItem_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les lignes et conventions citent toujours leur contact : la contrainte pointe sur la table renommée.
ALTER TABLE "FundingLine" DROP CONSTRAINT "FundingLine_contactId_fkey";
ALTER TABLE "FundingLine" ADD CONSTRAINT "FundingLine_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Convention" DROP CONSTRAINT "Convention_contactId_fkey";
ALTER TABLE "Convention" ADD CONSTRAINT "Convention_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
