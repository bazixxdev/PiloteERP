"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
import { reportInternalError } from "@/lib/errors";
import { processLogo, BrandImageError, BRAND_MAX_BYTES, BRAND_MIME, type BrandKind } from "@/lib/brand-images";

type Result = { ok: true } | { ok: false; error: string };
const KINDS: BrandKind[] = ["logo", "logo_small"];

// Téléverser un logo (spec connexion § 3) : réservé à qui administre l'outil, vérifié avant de lire le formulaire.
export async function uploadBrandLogo(form: FormData): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration de l'outil." };
  if (!(form instanceof FormData)) return { ok: false, error: "Formulaire invalide." };
  const kind = String(form.get("kind") ?? "") as BrandKind;
  if (!KINDS.includes(kind)) return { ok: false, error: "Logo inconnu." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier." };
  if (file.size > BRAND_MAX_BYTES) return { ok: false, error: "Image trop lourde : 2 Mo au plus." };
  if (!BRAND_MIME.includes(file.type)) return { ok: false, error: "Format non accepté : PNG, JPEG, WebP ou SVG." };
  try {
    const out = await processLogo(Buffer.from(await file.arrayBuffer()), kind);
    const data = { png: new Uint8Array(out.png), width: out.width, height: out.height, palette: out.palette ?? undefined };
    await prisma.brandAsset.upsert({ where: { key: kind }, create: { key: kind, ...data }, update: data });
  } catch (e) {
    if (e instanceof BrandImageError) return { ok: false, error: e.message };
    return { ok: false, ...reportInternalError("uploadBrandLogo", e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Retirer un logo : l'outil revient à celui du fichier client (et à sa palette).
export async function deleteBrandLogo(kind: BrandKind): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration de l'outil." };
  if (!KINDS.includes(kind)) return { ok: false, error: "Logo inconnu." };
  await prisma.brandAsset.deleteMany({ where: { key: kind } });
  revalidatePath("/", "layout");
  return { ok: true };
}
