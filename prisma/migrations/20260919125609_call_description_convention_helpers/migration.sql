-- Appels à projets (19/09) : « note » devient « description » (renommage, rien n'est perdu) ; l'ancien « montant indicatif en
-- texte » y est replié quand il existait. La colonne amountHint reste, plus utilisée.
ALTER TABLE "Call" RENAME COLUMN "note" TO "description";
UPDATE "Call" SET "description" = CASE WHEN "description" IS NULL OR "description" = '' THEN 'Montant indicatif : ' || "amountHint" ELSE "description" || E'\n' || 'Montant indicatif : ' || "amountHint" END
  WHERE "amountHint" IS NOT NULL AND "amountHint" <> '';

-- CreateTable
CREATE TABLE "ConventionHelper" (
    "conventionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "ConventionHelper_pkey" PRIMARY KEY ("conventionId","personId")
);

-- AddForeignKey
ALTER TABLE "ConventionHelper" ADD CONSTRAINT "ConventionHelper_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConventionHelper" ADD CONSTRAINT "ConventionHelper_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
