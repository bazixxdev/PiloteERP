import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { branding } from "@/lib/branding";
import { prisma } from "@/lib/db";

export const revalidate = 0;
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Favicon (lot I, puis spec connexion § 3) : le petit logo téléversé par un admin, réduit à 64 px, sinon le PNG du client
// (public/clients/<client>/favicon.png). Dynamique (retiré de force-static) : le remplacement d'un logo doit se voir sans
// redéployer.
export default async function Icon() {
  const row = await prisma.brandAsset.findUnique({ where: { key: "logo_small" }, select: { png: true } });
  if (row) {
    const png = await sharp(row.png)
      .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return new Response(new Uint8Array(png), { headers: { "Content-Type": contentType } });
  }
  const file = await readFile(path.join(process.cwd(), "public", branding().logos.favicon));
  return new Response(file, { headers: { "Content-Type": contentType } });
}
