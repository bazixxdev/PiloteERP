import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { branding } from "./branding";
import { DEFAULT_PALETTE, type BrandPalette } from "./brand-palette";
import { processLogo, type BrandKind } from "./brand-images";
import type { Img } from "@/config/clients/types";

export function brandUrl(kind: BrandKind, updatedAt: Date): string {
  return `/marque/${kind === "logo" ? "logo" : "logo-petit"}?v=${updatedAt.getTime()}`;
}

// Ce que le layout calcule une fois par requête et transmet à la barre latérale et au bandeau (tâche 3).
export type ShellLogos = { color: Img; mark: Img };

// Les logos affichés (spec connexion § 3) : ceux téléversés par un admin, sinon ceux du fichier client. Le logo « blanc »
// (fond sombre) reste celui du fichier client.
export async function getLogos(): Promise<ShellLogos & { favicon: { src: string; uploaded: boolean } }> {
  const b = branding();
  const rows = await prisma.brandAsset.findMany({ select: { key: true, width: true, height: true, updatedAt: true } });
  const big = rows.find((r) => r.key === "logo");
  const small = rows.find((r) => r.key === "logo_small");
  return {
    color: big ? { src: brandUrl("logo", big.updatedAt), width: big.width, height: big.height } : b.logos.color,
    mark: small ? { src: brandUrl("logo_small", small.updatedAt), width: small.width, height: small.height } : b.logos.mark,
    favicon: small ? { src: brandUrl("logo_small", small.updatedAt), uploaded: true } : { src: b.logos.favicon, uploaded: false },
  };
}

// Palette du panneau de connexion : celle du grand logo téléversé ; sinon calculée une fois par démarrage depuis le grand logo
// du fichier client (la connexion est colorée dès le déploiement) ; sinon la palette neutre.
let configPalette: Promise<BrandPalette> | null = null;
export async function getLoginPalette(): Promise<BrandPalette> {
  const row = await prisma.brandAsset.findUnique({ where: { key: "logo" }, select: { palette: true } });
  if (row?.palette) return row.palette as unknown as BrandPalette;
  configPalette ??= readFile(path.join(process.cwd(), "public", branding().logos.color.src))
    .then((buf) => processLogo(buf, "logo"))
    .then((r) => r.palette ?? DEFAULT_PALETTE)
    .catch(() => DEFAULT_PALETTE);
  return configPalette;
}

// Ce qu'Admin › Paramètres affiche (tâche 4) : l'URL de chaque logo téléversé (ou rien), la palette du grand logo pour
// l'aperçu du panneau et les pastilles de couleurs.
export async function getBrandAdminState(): Promise<{ logo: { url: string; palette: BrandPalette } | null; logoSmall: { url: string } | null }> {
  const rows = await prisma.brandAsset.findMany({ select: { key: true, updatedAt: true, palette: true } });
  const big = rows.find((r) => r.key === "logo");
  const small = rows.find((r) => r.key === "logo_small");
  return {
    logo: big ? { url: brandUrl("logo", big.updatedAt), palette: (big.palette as unknown as BrandPalette) ?? DEFAULT_PALETTE } : null,
    logoSmall: small ? { url: brandUrl("logo_small", small.updatedAt) } : null,
  };
}
