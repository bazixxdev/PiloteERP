import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pièces jointes légères : 5 Mo côté métier, marge pour le formulaire.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
