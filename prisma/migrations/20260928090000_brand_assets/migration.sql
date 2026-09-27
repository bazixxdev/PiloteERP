-- Logos téléversés par un admin (spec connexion du 27/09), stockés convertis en PNG plutôt que dans public/ : survivent aux
-- déploiements (rsync --delete), partent dans pg_dump. Clés "logo" (grand) et "logo_small" (petit) ; palette calculée à
-- l'envoi, pour le grand logo seulement.
-- CreateTable
CREATE TABLE "BrandAsset" (
    "key" TEXT NOT NULL,
    "png" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "palette" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("key")
);
