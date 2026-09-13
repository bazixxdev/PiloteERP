-- Plan de charge : jours prévus par édition, personne et mois
CREATE TABLE "PlannedLoad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "days" REAL NOT NULL,
    CONSTRAINT "PlannedLoad_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlannedLoad_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlannedLoad_editionId_personId_month_key" ON "PlannedLoad"("editionId", "personId", "month");
CREATE INDEX "PlannedLoad_personId_month_idx" ON "PlannedLoad"("personId", "month");
