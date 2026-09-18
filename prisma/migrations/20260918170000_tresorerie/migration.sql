-- Trésorerie (18/09) : règles de flux saisies, solde de départ et seuil dans les paramètres ; module et droits sur l'existant.
CREATE TABLE "CashRule" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashRule_direction_idx" ON "CashRule"("direction");
ALTER TABLE "CashRule" ADD CONSTRAINT "CashRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Settings"
  ADD COLUMN "cashOpeningBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "cashOpeningMonth" TEXT,
  ADD COLUMN "cashAlertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 20000;
ALTER TABLE "Settings" ALTER COLUMN "modules" SET DEFAULT 'veille,adherents,tresorerie';
UPDATE "Settings" SET "modules" = CASE WHEN "modules" = '' THEN 'tresorerie' ELSE "modules" || ',tresorerie' END WHERE "modules" NOT LIKE '%tresorerie%';

-- Droits : la direction et la RAF tiennent la trésorerie ; les responsables de pôle la consultent.
UPDATE "Role" SET "permissions" = "permissions" || ',treasury.view,treasury.manage' WHERE "code" IN ('director', 'raf') AND "permissions" NOT LIKE '%treasury.manage%';
UPDATE "Role" SET "permissions" = "permissions" || ',treasury.view' WHERE "code" = 'pole_lead' AND "permissions" NOT LIKE '%treasury.view%';
