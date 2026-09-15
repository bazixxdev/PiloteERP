-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- AlterTable (lien vers la base fournisseurs ; la contrainte est portée par l'application, comme pour les colonnes ajoutées avant)
ALTER TABLE "ValidationRequest" ADD COLUMN "supplierId" TEXT;
