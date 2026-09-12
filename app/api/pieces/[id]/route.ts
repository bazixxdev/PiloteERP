import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { COOKIE } from "@/lib/session";
import { UPLOAD_DIR } from "@/lib/attachments";

// Téléchargement d'une pièce : réservé aux personnes connectées à l'outil.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (!jar.get(COOKIE)?.value) return new NextResponse("Connexion requise", { status: 401 });
  const { id } = await params;
  const a = await prisma.attachment.findUnique({ where: { id } });
  if (!a) return new NextResponse("Pièce introuvable", { status: 404 });
  try {
    const data = await readFile(path.join(UPLOAD_DIR, a.storedName));
    return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": a.mimeType, "Content-Disposition": `inline; filename="${encodeURIComponent(a.fileName)}"`, "Cache-Control": "private, max-age=0" } });
  } catch {
    return new NextResponse("Fichier absent du stockage", { status: 410 });
  }
}
