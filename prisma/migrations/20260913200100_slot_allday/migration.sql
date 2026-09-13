-- Créneau de travail : journée entière ou plage horaire
ALTER TABLE "WorkSlot" ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false;
