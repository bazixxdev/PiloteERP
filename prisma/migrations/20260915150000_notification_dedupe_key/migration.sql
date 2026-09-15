-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_personId_dedupeKey_key" ON "Notification"("personId", "dedupeKey");
