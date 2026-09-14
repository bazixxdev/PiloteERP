-- Lot 1 « Mon travail » : listes de tâches, notes, modules par personne, part fixe
ALTER TABLE "Person" ADD COLUMN "modules" TEXT NOT NULL DEFAULT 'tasks,notes,split';
ALTER TABLE "Person" ADD COLUMN "fixedShare" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Person" ADD COLUMN "fixedShareNote" TEXT;

CREATE TABLE "TaskList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "editionId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskList_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskList_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TaskList_personId_idx" ON "TaskList"("personId");

ALTER TABLE "Task" ADD COLUMN "listId" TEXT REFERENCES "TaskList" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" TEXT NOT NULL DEFAULT 'project',
    "editionId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Note_authorId_idx" ON "Note"("authorId");
CREATE INDEX "Note_editionId_idx" ON "Note"("editionId");
