-- Pôles secondaires d'un projet commun
CREATE TABLE "ProjectPole" (
    "projectId" TEXT NOT NULL,
    "poleId" TEXT NOT NULL,
    PRIMARY KEY ("projectId", "poleId"),
    CONSTRAINT "ProjectPole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectPole_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
