import sharp from "sharp";
import { paletteFromPixels, PALETTE_OPTIONS, type BrandPalette } from "./brand-palette";

export type BrandKind = "logo" | "logo_small";
export const BRAND_MAX_BYTES = 2 * 1024 * 1024;
export const BRAND_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_SIDE: Record<BrandKind, number> = { logo: 640, logo_small: 256 };

export class BrandImageError extends Error {}

// Un logo téléversé (spec connexion § 3) : lu par sharp (un SVG est rastérisé, donc aucun script SVG n'est jamais servi),
// réduit, converti en PNG ; pour le grand logo, la palette du panneau est calculée sur un échantillon de 160 px sans lissage
// (plus proche voisin : pas de couleur fabriquée aux bords, notice § 3.1). Illisible : BrandImageError, l'appelant refuse.
export async function processLogo(input: Buffer, kind: BrandKind): Promise<{ png: Buffer; width: number; height: number; palette: BrandPalette | null }> {
  try {
    const side = MAX_SIDE[kind];
    const { data: png, info } = await sharp(input, { density: 144 })
      .resize(side, side, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    if (kind === "logo_small") return { png, width: info.width, height: info.height, palette: null };
    const n = PALETTE_OPTIONS.sampleSize;
    const sample = await sharp(input, { density: 144 })
      .ensureAlpha()
      .resize(n, n, { fit: "inside", kernel: "nearest", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { png, width: info.width, height: info.height, palette: paletteFromPixels(sample.data, sample.info.width, sample.info.height) };
  } catch (e) {
    console.error("[brand-images] image illisible", e);
    throw new BrandImageError("Image illisible : envoyez un PNG, un JPEG, un WebP ou un SVG.");
  }
}
