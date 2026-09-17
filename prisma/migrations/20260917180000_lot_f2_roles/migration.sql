-- Lot F2 : rôles en base, droits par rôle. Les rôles existants sont créés avec leurs libellés du référentiel (ou par défaut),
-- les droits par défaut sont posés par l'application au premier chargement (lib/roles.ts) ; le référentiel « Rôles » disparaît.
CREATE TABLE "Role" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "validationLevel" INTEGER NOT NULL DEFAULT 0,
    "permissions" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Role_pkey" PRIMARY KEY ("code")
);

INSERT INTO "Role" ("code", "label", "order", "system") VALUES
  ('director', 'Direction', 0, true),
  ('raf', 'RAF', 1, true),
  ('pole_lead', 'Responsable de pôle', 2, true),
  ('pilot', 'Chargé·e de mission (pilote)', 3, true),
  ('contributor', 'Contributeur·rice', 4, true),
  ('assistant', 'Assistant·e', 5, true);

-- Libellés personnalisés dans l'ancien référentiel, s'il y en a.
UPDATE "Role" r SET "label" = v."label" FROM "RefValue" v WHERE v."family" = 'role' AND v."code" = r."code";
-- Un code de rôle inconnu chez une personne (donnée ancienne) devient un rôle créé, pour ne perdre personne.
INSERT INTO "Role" ("code", "label", "order")
  SELECT DISTINCT p."role", p."role", 10 FROM "Person" p WHERE p."role" NOT IN (SELECT "code" FROM "Role");
DELETE FROM "RefValue" WHERE "family" = 'role';

ALTER TABLE "Person" ADD CONSTRAINT "Person_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
