-- Fiche projet (lot 1 du 19/09) : un projet se range.
ALTER TABLE "Project" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
