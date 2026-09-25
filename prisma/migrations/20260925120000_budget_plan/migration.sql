-- Budget prévisionnel par catégorie (25/09, docs/superpowers/specs/2026-09-25-budget-previsionnel-design.md). Migration « expand » :
-- nouvelles tables et colonnes facultatives, rien d'existant n'est renommé ni supprimé.

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN     "budgetPlanStatus" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "budgetPlanValidatedAt" TIMESTAMP(3),
ADD COLUMN     "budgetPlanValidatedById" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "budgetCategoryId" TEXT;

-- CreateTable
CREATE TABLE "BudgetCategory" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "accountPrefixes" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'ledger',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetActualOverride" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetActualOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetLine_editionId_idx" ON "BudgetLine"("editionId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetActualOverride_editionId_categoryId_key" ON "BudgetActualOverride"("editionId", "categoryId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_budgetCategoryId_fkey" FOREIGN KEY ("budgetCategoryId") REFERENCES "BudgetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetActualOverride" ADD CONSTRAINT "BudgetActualOverride_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetActualOverride" ADD CONSTRAINT "BudgetActualOverride_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetActualOverride" ADD CONSTRAINT "BudgetActualOverride_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Grille commune par défaut : posée une fois, modifiable ensuite dans Admin › Référentiels.
INSERT INTO "BudgetCategory" ("id", "label", "accountPrefixes", "source", "order", "active") VALUES
  ('bcat_personnel',      'Personnel',                '64',                          'time',   1, true),
  ('bcat_indirects',      'Coûts indirects',          '',                            'none',   2, true),
  ('bcat_prestations',    'Prestations',              '604,611,622,628',             'ledger', 3, true),
  ('bcat_achats',         'Achats et fournitures',    '601,602,606',                 'ledger', 4, true),
  ('bcat_deplacements',   'Déplacements',             '625',                         'ledger', 5, true),
  ('bcat_communication',  'Communication',            '623',                         'ledger', 6, true),
  ('bcat_locaux',         'Locaux et fonctionnement', '613,614,615,616,618,626,627', 'ledger', 7, true),
  ('bcat_investissement', 'Investissement',           '2',                           'ledger', 8, true),
  ('bcat_autre',          'Autre',                    '6',                           'ledger', 9, true)
ON CONFLICT ("id") DO NOTHING;

-- Droits nouveaux donnés aux rôles système des installations existantes, sans rien retirer (ils restent réglables dans
-- Admin › Rôles et droits). Idempotent : un rôle qui a déjà le droit n'est pas touché.
UPDATE "Role" SET "permissions" = CASE WHEN "permissions" = '' THEN 'budget.plan,budget.validate' ELSE "permissions" || ',budget.plan,budget.validate' END
  WHERE "code" IN ('director', 'raf') AND "permissions" NOT LIKE '%budget.plan%';
UPDATE "Role" SET "permissions" = CASE WHEN "permissions" = '' THEN 'budget.plan' ELSE "permissions" || ',budget.plan' END
  WHERE "code" IN ('pole_lead', 'pilot') AND "permissions" NOT LIKE '%budget.plan%';
