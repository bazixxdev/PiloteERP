-- Jeton d'API pour les exports (Excel) et actions publiques (agenda du site)
ALTER TABLE "Settings" ADD COLUMN "apiToken" TEXT;
ALTER TABLE "Action" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
