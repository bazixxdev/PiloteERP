import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les tests Playwright lancent leur propre serveur de dev : un cache à part (.next-test) pour ne pas corrompre celui du serveur de travail.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Pièces jointes légères : 5 Mo côté métier, marge pour le formulaire.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
