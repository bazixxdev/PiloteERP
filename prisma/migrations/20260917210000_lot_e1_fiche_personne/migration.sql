-- Lot E1 : fiche personne (prénom / nom, fonction, téléphone, dates, note). Le nom existant se découpe : premier mot = prénom.
ALTER TABLE "Person"
  ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "jobTitle" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "arrivedAt" TIMESTAMP(3),
  ADD COLUMN "leftAt" TIMESTAMP(3),
  ADD COLUMN "note" TEXT;

UPDATE "Person" SET
  "firstName" = split_part(btrim("name"), ' ', 1),
  "lastName" = btrim(substr(btrim("name"), length(split_part(btrim("name"), ' ', 1)) + 1));
