-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "validationThresholdLevel1" REAL NOT NULL DEFAULT 500,
    "validationThresholdLevel2" REAL NOT NULL DEFAULT 3000,
    "reminderDaysBefore" TEXT NOT NULL DEFAULT '30,7',
    "envelopeAlertPercent" INTEGER NOT NULL DEFAULT 80,
    "deliverableAlertDays" INTEGER NOT NULL DEFAULT 30,
    "timeVisibility" TEXT NOT NULL DEFAULT 'self_pole_lead_raf',
    "horizonDays" INTEGER NOT NULL DEFAULT 90,
    "timeRules" TEXT NOT NULL DEFAULT '',
    "serverPathTemplate" TEXT NOT NULL DEFAULT '\\cress\Partage\Action\{code}\{annee}'
);
INSERT INTO "new_Settings" ("deliverableAlertDays", "envelopeAlertPercent", "horizonDays", "id", "reminderDaysBefore", "timeRules", "timeVisibility", "validationThresholdLevel1", "validationThresholdLevel2") SELECT "deliverableAlertDays", "envelopeAlertPercent", "horizonDays", "id", "reminderDaysBefore", "timeRules", "timeVisibility", "validationThresholdLevel1", "validationThresholdLevel2" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
