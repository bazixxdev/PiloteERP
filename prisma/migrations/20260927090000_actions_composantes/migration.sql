-- Action composante et circuit de validation par niveaux (26/09, docs/superpowers/specs/2026-09-26-actions-composantes-design.md § 1
-- et 2026-09-26-vocabulaire-gouvernance-design.md § 3). Migration « expand » : des colonnes nullables ou à défaut, cinq tables,
-- puis la copie des données existantes (en fin de fichier) ; aucune colonne n'est supprimée ni passée NOT NULL.

-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "audience" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "entrusted" TEXT,
ADD COLUMN     "latitude" TEXT,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "recurrence" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "actionId" TEXT;

-- AlterTable
ALTER TABLE "Indicator" ADD COLUMN     "actionId" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "tracksTime" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'funded';

-- CreateTable
CREATE TABLE "ActionPerson" (
    "actionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "ActionPerson_pkey" PRIMARY KEY ("actionId","personId")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "venue" TEXT,
    "participants" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isCheckpoint" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionFunding" (
    "actionId" TEXT NOT NULL,
    "fundingLineId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,

    CONSTRAINT "ActionFunding_pkey" PRIMARY KEY ("actionId","fundingLineId")
);

-- CreateTable
CREATE TABLE "FicheValidationLevel" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FicheValidationLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FicheValidation" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "deciderId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FicheValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_actionId_date_idx" ON "Milestone"("actionId", "date");

-- CreateIndex
CREATE INDEX "FicheValidation_editionId_idx" ON "FicheValidation"("editionId");

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPerson" ADD CONSTRAINT "ActionPerson_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPerson" ADD CONSTRAINT "ActionPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionFunding" ADD CONSTRAINT "ActionFunding_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionFunding" ADD CONSTRAINT "ActionFunding_fundingLineId_fkey" FOREIGN KEY ("fundingLineId") REFERENCES "FundingLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheValidation" ADD CONSTRAINT "FicheValidation_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheValidation" ADD CONSTRAINT "FicheValidation_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "FicheValidationLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheValidation" ADD CONSTRAINT "FicheValidation_deciderId_fkey" FOREIGN KEY ("deciderId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Copie (26/09, spec actions § 1) : chaque action existante garde tout ; rien n'est supprimé.
-- 1. Projet et période : l'année de l'action, prolongée jusqu'à son jalon s'il tombe après le 31/12.
UPDATE "Action" a SET
  "projectId" = e."projectId",
  "startDate" = make_date(e."year", 1, 1),
  "endDate"   = GREATEST(make_date(e."year", 12, 31), COALESCE(a."milestoneDate"::date, make_date(e."year", 12, 31)))
FROM "Edition" e WHERE e."id" = a."editionId";

-- 2. L'ancien jalon devient un jalon (avec lieu, participants, public, point de contrôle).
INSERT INTO "Milestone" ("id", "actionId", "date", "label", "done", "doneAt", "venue", "participants", "isPublic", "isCheckpoint", "order")
SELECT 'ms_' || a."id", a."id", a."milestoneDate", a."name", a."state" = 'done', NULL, a."venue", a."participants", a."isPublic", a."isCheckpoint", 0
FROM "Action" a WHERE a."milestoneDate" IS NOT NULL;

-- 3. L'ancien financeur devient un lien sans montant.
INSERT INTO "ActionFunding" ("actionId", "fundingLineId", "amount")
SELECT a."id", a."fundingLineId", NULL FROM "Action" a WHERE a."fundingLineId" IS NOT NULL;

-- 4. « late » (calculé, rarement stocké) redevient « doing ».
UPDATE "Action" SET "state" = 'doing' WHERE "state" = 'late';

-- 5. Dépenses : l'action de la demande de validation, quand il y en a une.
UPDATE "Expense" x SET "actionId" = v."actionId" FROM "ValidationRequest" v WHERE x."validationId" = v."id" AND v."actionId" IS NOT NULL;

-- 6. Libellés d'état par défaut (seulement s'ils valent encore l'ancien défaut).
UPDATE "RefValue" SET "label" = 'À développer' WHERE "family" = 'action_state' AND "code" = 'todo' AND "label" = 'À faire';
UPDATE "RefValue" SET "label" = 'Terminée'     WHERE "family" = 'action_state' AND "code" = 'done' AND "label" = 'Fait';
INSERT INTO "RefValue" ("id", "family", "code", "label", "color", "order")
SELECT 'ref_action_abandoned', 'action_state', 'abandoned', 'Abandonnée', 'muted', 3
WHERE NOT EXISTS (SELECT 1 FROM "RefValue" WHERE "family" = 'action_state' AND "code" = 'abandoned');

-- 7. Circuit de validation par défaut : deux niveaux ; libellés modifiables dans l'admin (TLST : « Coordination »).
INSERT INTO "FicheValidationLevel" ("id", "order", "label", "permission", "active") VALUES
  ('fvl_1', 1, 'Direction', 'fiche.validate.1', true),
  ('fvl_2', 2, 'CA', 'fiche.validate.2', true);

-- 8. Anciennes décisions → circuit. Auteur : la personne tracée dans l'historique, sinon une personne « direction », sinon le
--    pilote du projet (Project.pilotId est NOT NULL : l'insertion ne peut pas échouer faute d'auteur).
INSERT INTO "FicheValidation" ("id", "editionId", "levelId", "decision", "comment", "deciderId", "decidedAt")
SELECT 'fv1_' || e."id", e."id", 'fvl_1',
  CASE e."codirDecision" WHEN 'renew' THEN 'approved' WHEN 'adjust' THEN 'rework' ELSE 'refused' END,
  CASE e."codirDecision" WHEN 'stop' THEN 'arrêt décidé' ELSE NULL END,
  COALESCE(
    (SELECT c."authorId" FROM "ChangeLog" c WHERE c."editionId" = e."id" AND c."field" = 'codirDecision' ORDER BY c."createdAt" DESC LIMIT 1),
    (SELECT p."id" FROM "Person" p WHERE p."role" = 'director' ORDER BY p."order" LIMIT 1),
    pr."pilotId"),
  COALESCE(e."codirDate", e."updatedAt")
FROM "Edition" e JOIN "Project" pr ON pr."id" = e."projectId" WHERE e."codirDecision" IS NOT NULL;
INSERT INTO "FicheValidation" ("id", "editionId", "levelId", "decision", "comment", "deciderId", "decidedAt")
SELECT 'fv2_' || e."id", e."id", 'fvl_2', 'approved', NULL,
  COALESCE(
    (SELECT c."authorId" FROM "ChangeLog" c WHERE c."editionId" = e."id" AND c."field" = 'boardValidated' ORDER BY c."createdAt" DESC LIMIT 1),
    (SELECT p."id" FROM "Person" p WHERE p."role" = 'director' ORDER BY p."order" LIMIT 1),
    pr."pilotId"),
  COALESCE(e."boardDate", e."updatedAt")
FROM "Edition" e JOIN "Project" pr ON pr."id" = e."projectId" WHERE e."boardValidated" = true;

-- 9. Droits des nouveaux niveaux (Role.permissions = liste séparée par des virgules, même motif que 20260925120000_budget_plan) :
--    niveau 1 pour les rôles qui avaient « fiche.validation », niveau 2 pour la direction.
UPDATE "Role" SET "permissions" = CASE WHEN "permissions" = '' THEN 'fiche.validate.1' ELSE "permissions" || ',fiche.validate.1' END
  WHERE "permissions" LIKE '%fiche.validation%' AND "permissions" NOT LIKE '%fiche.validate.1%';
UPDATE "Role" SET "permissions" = CASE WHEN "permissions" = '' THEN 'fiche.validate.2' ELSE "permissions" || ',fiche.validate.2' END
  WHERE "code" = 'director' AND "permissions" NOT LIKE '%fiche.validate.2%';
