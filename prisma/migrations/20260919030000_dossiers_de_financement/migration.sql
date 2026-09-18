-- Dossiers de financement (lot 2 du 19/09) : la convention devient un dossier avec son cycle (à étudier → réponse → déposé →
-- obtenu / refusé / écarté) et, une fois obtenu, sa forme ; les appels portent le montant, la durée et la cible.
ALTER TABLE "Convention"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "form" TEXT,
  ADD COLUMN "amountKind" TEXT NOT NULL DEFAULT 'total',
  ADD COLUMN "targetProjectId" TEXT,
  ADD COLUMN "deadline" TIMESTAMP(3),
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "helpers" TEXT,
  ADD COLUMN "sources" TEXT,
  ADD COLUMN "decisionNote" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3);
ALTER TABLE "Convention" ALTER COLUMN "status" SET DEFAULT 'study';
UPDATE "Convention" SET "status" = 'drafting' WHERE "status" = 'to_submit';
-- Ce qui est déjà obtenu dans l'existant était conventionné : la forme par défaut est la convention.
UPDATE "Convention" SET "form" = 'convention' WHERE "status" IN ('notified', 'contracted', 'justified') AND "form" IS NULL;
ALTER TABLE "Convention" ADD CONSTRAINT "Convention_targetProjectId_fkey" FOREIGN KEY ("targetProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Convention" ADD CONSTRAINT "Convention_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Call"
  ADD COLUMN "amountValue" DOUBLE PRECISION,
  ADD COLUMN "amountKind" TEXT NOT NULL DEFAULT 'total',
  ADD COLUMN "durationYears" INTEGER,
  ADD COLUMN "targetProjectId" TEXT;
ALTER TABLE "Call" ADD CONSTRAINT "Call_targetProjectId_fkey" FOREIGN KEY ("targetProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD COLUMN "conventionId" TEXT;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD COLUMN "conventionId" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT "Task_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Note" ADD COLUMN "conventionId" TEXT;
ALTER TABLE "Note" ADD CONSTRAINT "Note_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Référentiels : statuts de dossier et formes de financement (les libellés se modifient dans l'admin).
INSERT INTO "RefValue" ("id", "family", "code", "label", "color", "order") VALUES
  (md5('dossier_status:study'), 'dossier_status', 'study', 'À étudier', 'info', 0),
  (md5('dossier_status:drafting'), 'dossier_status', 'drafting', 'Réponse en cours', 'primary', 1),
  (md5('dossier_status:submitted'), 'dossier_status', 'submitted', 'Déposé · en attente', 'warning', 2),
  (md5('dossier_status:notified'), 'dossier_status', 'notified', 'Obtenu · notifié', 'mint', 3),
  (md5('dossier_status:contracted'), 'dossier_status', 'contracted', 'Obtenu · conventionné', 'mint', 4),
  (md5('dossier_status:justified'), 'dossier_status', 'justified', 'Obtenu · justifié', 'muted', 5),
  (md5('dossier_status:lost'), 'dossier_status', 'lost', 'Refusé', 'danger', 6),
  (md5('dossier_status:dismissed'), 'dossier_status', 'dismissed', 'Écarté', 'muted', 7),
  (md5('funding_form:convention'), 'funding_form', 'convention', 'Convention', NULL, 0),
  (md5('funding_form:arrete'), 'funding_form', 'arrete', 'Arrêté attributif', NULL, 1),
  (md5('funding_form:lettre'), 'funding_form', 'lettre', 'Lettre de notification', NULL, 2),
  (md5('funding_form:mecenat'), 'funding_form', 'mecenat', 'Contrat de mécénat', NULL, 3),
  (md5('funding_form:commande'), 'funding_form', 'commande', 'Bon de commande (prestation)', NULL, 4),
  (md5('funding_form:cotisation'), 'funding_form', 'cotisation', 'Cotisation / adhésion', NULL, 5),
  (md5('funding_form:sans'), 'funding_form', 'sans', 'Sans formalisme', NULL, 6)
ON CONFLICT DO NOTHING;
