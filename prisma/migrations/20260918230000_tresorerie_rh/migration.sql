-- Trésorerie (retour de Gaël, 18/09) : les ressources humaines en lignes à part (kind = hr, personne facultative).
ALTER TABLE "CashRule" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'flow', ADD COLUMN "personId" TEXT;
ALTER TABLE "CashRule" ADD CONSTRAINT "CashRule_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
