-- CreateTable
CREATE TABLE "NoteShare" (
    "noteId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("noteId", "personId"),
    CONSTRAINT "NoteShare_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoteShare_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NoteShare_personId_idx" ON "NoteShare"("personId");

-- AlterTable
ALTER TABLE "Note" ADD COLUMN "color" TEXT;
