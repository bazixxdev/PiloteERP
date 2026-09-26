-- Sens des anciennes décisions CODIR (expand, suite de 20260927090000_actions_composantes, décision du contrôleur du 26/09).
-- L'ancien Edition.codirDecision portait deux sens : (a) la fiche était validée — toute valeur la verrouillait (ancien
-- lib/lock.ts) ; (b) la décision de programmation pour l'année SUIVANTE (renew / adjust / stop), écrite au séminaire.
-- La migration précédente l'avait lu comme un avis sur la fiche (adjust → rework, stop → refused), ce qui déverrouillait les
-- fiches « ajuster ». On sépare les deux sens :
--   (a) toute codirDecision → FicheValidation « approved » au niveau 1, sans commentaire, datée codirDate (sinon updatedAt) ;
--   (b) plus une Decision sur la même année, « Reconduit / Ajusté / Arrêté pour {année + 1} » (texte de lib/preparer.ts),
--       instance « codir » si elle est dans la liste de l'admin, sinon la première de la liste.
-- Auteur, dans les deux cas : l'auteur du dernier ChangeLog codirDecision, sinon la première personne « director », sinon le
-- pilote du projet (même chaîne que la migration précédente). Rejouable : rien n'est dupliqué.

-- 1. Les lignes « fv1_<id> » créées par la migration précédente deviennent « approved », sans commentaire.
UPDATE "FicheValidation" fv SET "decision" = 'approved', "comment" = NULL
FROM "Edition" e
WHERE fv."id" = 'fv1_' || e."id" AND fv."editionId" = e."id" AND e."codirDecision" IS NOT NULL
  AND (fv."decision" <> 'approved' OR fv."comment" IS NOT NULL);

-- 2. Une codirDecision sans ligne « fv1_ » (supprimée entre-temps) : la ligne est recréée.
INSERT INTO "FicheValidation" ("id", "editionId", "levelId", "decision", "comment", "deciderId", "decidedAt")
SELECT 'fv1_' || e."id", e."id", 'fvl_1', 'approved', NULL,
  COALESCE(
    (SELECT c."authorId" FROM "ChangeLog" c WHERE c."editionId" = e."id" AND c."field" = 'codirDecision' ORDER BY c."createdAt" DESC LIMIT 1),
    (SELECT p."id" FROM "Person" p WHERE p."role" = 'director' ORDER BY p."order" LIMIT 1),
    pr."pilotId"),
  COALESCE(e."codirDate", e."updatedAt")
FROM "Edition" e JOIN "Project" pr ON pr."id" = e."projectId"
WHERE e."codirDecision" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "FicheValidationLevel" l WHERE l."id" = 'fvl_1')
  AND NOT EXISTS (SELECT 1 FROM "FicheValidation" fv WHERE fv."id" = 'fv1_' || e."id");

-- 3. La décision de programmation pour l'année suivante : une Decision « dprep_<id> », sauf si l'année porte déjà la même
--    décision (consignée par « Préparer ») ou si la ligne existe déjà (rejeu).
INSERT INTO "Decision" ("id", "editionId", "instance", "body", "authorId", "decidedAt")
SELECT 'dprep_' || e."id", e."id",
  COALESCE(
    (SELECT r."code" FROM "RefValue" r WHERE r."family" = 'decision_instance' ORDER BY (r."code" = 'codir') DESC, r."order", r."code" LIMIT 1),
    'codir'),
  x."body",
  COALESCE(
    (SELECT c."authorId" FROM "ChangeLog" c WHERE c."editionId" = e."id" AND c."field" = 'codirDecision' ORDER BY c."createdAt" DESC LIMIT 1),
    (SELECT p."id" FROM "Person" p WHERE p."role" = 'director' ORDER BY p."order" LIMIT 1),
    pr."pilotId"),
  COALESCE(e."codirDate", e."updatedAt")
FROM "Edition" e
JOIN "Project" pr ON pr."id" = e."projectId"
CROSS JOIN LATERAL (SELECT (CASE e."codirDecision" WHEN 'renew' THEN 'Reconduit' WHEN 'adjust' THEN 'Ajusté' ELSE 'Arrêté' END) || ' pour ' || (e."year" + 1) AS "body") x
WHERE e."codirDecision" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Decision" d WHERE d."id" = 'dprep_' || e."id")
  AND NOT EXISTS (SELECT 1 FROM "Decision" d WHERE d."editionId" = e."id" AND d."body" = x."body");
