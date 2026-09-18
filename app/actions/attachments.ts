"use server";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditFunding, canWriteLayer } from "@/lib/rights";
import { ALLOWED_MIME, MAX_ATTACHMENT_BYTES, UPLOAD_DIR } from "@/lib/attachments";
import { inMyPole } from "@/lib/scope";
import { V, cap, ce } from "@/lib/vocab";

type Result = { ok: true } | { ok: false; error: string };

// Dépôt d'une pièce jointe (formulaire multipart). Rattachement : édition + ligne / livrable / validation selon le contexte.
export async function uploadAttachment(form: FormData): Promise<Result> {
  try {
    const me = await getCurrentPerson();
    const editionId = String(form.get("editionId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier." };
    if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "Pièce trop lourde (5 Mo au plus) : le dossier complet reste sur le serveur." };
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.includes(mime)) return { ok: false, error: "Format non accepté : PDF, image, Word, Excel ou texte." };

    const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: true } });
    if (!e) return { ok: false, error: `${cap(V.edition)} introuvable` };
    const isPilot = e.project.pilotId === me.id;
    const isTeam = e.team.some((t) => t.personId === me.id);
    const validationId = String(form.get("validationId") ?? "") || null;
    const requester = validationId ? await prisma.validationRequest.findUnique({ where: { id: validationId } }) : null;
    const allowed = canWriteLayer(me, "year", isPilot, isTeam, inMyPole(me, e.project)) || canEditFunding(me) || requester?.requesterId === me.id;
    if (!allowed) return { ok: false, error: `Vous ne pouvez pas déposer de pièce sur ${ce(V.edition)}.` };

    const ext = path.extname(file.name).toLowerCase().slice(0, 8);
    const storedName = `${randomBytes(12).toString("hex")}${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()));

    await prisma.attachment.create({
      data: {
        editionId,
        fundingLineId: String(form.get("fundingLineId") ?? "") || null,
        deliverableId: String(form.get("deliverableId") ?? "") || null,
        validationId,
        kind: String(form.get("kind") ?? "other"),
        label: String(form.get("label") ?? "").trim() || file.name,
        fileName: file.name,
        storedName,
        mimeType: mime,
        size: file.size,
        uploadedById: me.id,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}
