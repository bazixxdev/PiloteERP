-- CreateTable
CREATE TABLE "BrevoIgnored" (
    "brevoContactId" TEXT NOT NULL,
    "email" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byId" TEXT,

    CONSTRAINT "BrevoIgnored_pkey" PRIMARY KEY ("brevoContactId")
);
