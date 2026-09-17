-- Lot E2 : un seul annuaire d'organisations. Funder → Organisation (genre financeur), Supplier fondu dedans (genre
-- fournisseur ; même nom = même organisation avec les deux genres), FunderContact → OrganisationContact, partenaires liés
-- à l'édition. Les colonnes de rôle (funderId, supplierId, contactId) gardent leur nom.

CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kinds" TEXT NOT NULL DEFAULT 'partner',
    "siret" TEXT,
    "website" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organisation_name_key" ON "Organisation"("name");

-- 1. Les financeurs, avec leur identifiant (les lignes, conventions et appels les citent déjà).
INSERT INTO "Organisation" ("id", "name", "kinds", "notes")
  SELECT "id", "name", 'funder', "notes" FROM "Funder";

-- 2. Les fournisseurs : même nom qu'un financeur → on ajoute le genre ; sinon une organisation à part (identifiant conservé).
UPDATE "Organisation" o SET "kinds" = o."kinds" || ',supplier',
  "email" = COALESCE(o."email", s."email"), "phone" = COALESCE(o."phone", s."phone")
  FROM "Supplier" s WHERE lower(btrim(s."name")) = lower(btrim(o."name"));
INSERT INTO "Organisation" ("id", "name", "kinds", "email", "phone", "notes", "createdAt")
  SELECT s."id", s."name", 'supplier', s."email", s."phone", s."notes", s."createdAt" FROM "Supplier" s
  WHERE NOT EXISTS (SELECT 1 FROM "Organisation" o WHERE lower(btrim(o."name")) = lower(btrim(s."name")));
-- Les validations qui citaient un fournisseur fondu dans un financeur pointent sur ce dernier.
UPDATE "ValidationRequest" v SET "supplierId" = o."id"
  FROM "Supplier" s JOIN "Organisation" o ON lower(btrim(o."name")) = lower(btrim(s."name"))
  WHERE v."supplierId" = s."id" AND o."id" <> s."id";

-- 3. Les contacts.
CREATE TABLE "OrganisationContact" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganisationContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrganisationContact_organisationId_idx" ON "OrganisationContact"("organisationId");
INSERT INTO "OrganisationContact" ("id", "organisationId", "firstName", "lastName", "role", "email", "phone", "notes", "primary", "createdAt")
  SELECT "id", "funderId", "firstName", "lastName", "role", "email", "phone", "notes", "primary", "createdAt" FROM "FunderContact";

-- 4. Partenaires liés à l'édition.
CREATE TABLE "EditionPartner" (
    "editionId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EditionPartner_pkey" PRIMARY KEY ("editionId","organisationId")
);

-- 5. Les clés étrangères basculent, les anciennes tables tombent.
ALTER TABLE "FundingLine" DROP CONSTRAINT "FundingLine_funderId_fkey";
ALTER TABLE "FundingLine" DROP CONSTRAINT "FundingLine_contactId_fkey";
ALTER TABLE "Convention" DROP CONSTRAINT "Convention_funderId_fkey";
ALTER TABLE "Convention" DROP CONSTRAINT "Convention_contactId_fkey";
ALTER TABLE "Call" DROP CONSTRAINT "Call_funderId_fkey";
ALTER TABLE "ValidationRequest" DROP CONSTRAINT "ValidationRequest_supplierId_fkey";
DROP TABLE "FunderContact";
DROP TABLE "Funder";
DROP TABLE "Supplier";

ALTER TABLE "FundingLine" ADD CONSTRAINT "FundingLine_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FundingLine" ADD CONSTRAINT "FundingLine_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "OrganisationContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Convention" ADD CONSTRAINT "Convention_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Convention" ADD CONSTRAINT "Convention_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "OrganisationContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidationRequest" ADD CONSTRAINT "ValidationRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganisationContact" ADD CONSTRAINT "OrganisationContact_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditionPartner" ADD CONSTRAINT "EditionPartner_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditionPartner" ADD CONSTRAINT "EditionPartner_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
