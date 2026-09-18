"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canManageEquipment } from "@/lib/rights";
import { EQUIPMENT_STATES } from "@/lib/equipment";
import { createContact } from "./contacts";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ALLOWED_MIME, MAX_ATTACHMENT_BYTES, UPLOAD_DIR } from "@/lib/attachments";
import { V, le } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const DENIED = `L'inventaire se tient par ${le(V.direction)}, ${le(V.raf)} ou l'assistant·e (droit « Tient l'inventaire du matériel »).`;
const clean = (v: unknown) => { const s = v == null ? "" : String(v).trim(); return s || null; };

export type EquipmentInput = { name: string; category?: string | null; reference?: string | null; location?: string | null; quantity?: number | string | null; state?: string; purchasedAt?: string | null; value?: number | string | null; notes?: string | null };

export async function createEquipment(input: EquipmentInput): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  if (!canManageEquipment(me)) return { ok: false, error: DENIED };
  const name = clean(input.name); if (!name) return { ok: false, error: "Donnez un nom au matériel." };
  const quantity = Math.max(1, Math.round(Number(input.quantity ?? 1) || 1));
  const state = EQUIPMENT_STATES.some((s) => s.value === input.state) ? input.state! : "ok";
  const value = input.value != null && String(input.value).trim() ? Number(String(input.value).replace(",", ".")) : null;
  const e = await prisma.equipment.create({ data: { name, category: clean(input.category), reference: clean(input.reference), location: clean(input.location), quantity, state, purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null, value: value != null && Number.isFinite(value) ? value : null, notes: clean(input.notes) } });
  revalidatePath("/materiel");
  return { ok: true, data: { id: e.id } };
}

// Sortir de l'inventaire (jamais supprimé : le registre des prêts reste lisible), ou l'y remettre.
export async function retireEquipment(id: string, retired: boolean): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canManageEquipment(me)) return { ok: false, error: DENIED };
  const e = await prisma.equipment.findUnique({ where: { id }, include: { loans: { where: { returnedAt: null } } } });
  if (!e) return { ok: false, error: "Matériel introuvable." };
  if (retired && e.loans.length) return { ok: false, error: "Ce matériel est en prêt : enregistrez d'abord le retour." };
  await prisma.equipment.update({ where: { id }, data: { state: retired ? "retired" : "ok" } });
  revalidatePath("/materiel");
  return { ok: true };
}

export type LoanInput = { equipmentId: string; quantity?: number | string | null; personId?: string | null; contactId?: string | null; contact?: { lastName: string; firstName?: string | null; email?: string | null; phone?: string | null } | null; organisationId?: string | null; editionId?: string | null; outAt?: string | null; dueAt?: string | null; notes?: string | null; depositAmount?: number | string | null; depositRef?: string | null };

// Un prêt : à quelqu'un de l'équipe, ou à un contact de l'annuaire (une organisation emprunte toujours par une personne : son
// contact, existant ou créé au passage) ; retour attendu obligatoire ; tout le monde peut l'enregistrer.
export async function createLoan(input: LoanInput): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const e = await prisma.equipment.findUnique({ where: { id: input.equipmentId }, include: { loans: { where: { returnedAt: null } } } });
  if (!e || !e.active) return { ok: false, error: "Matériel introuvable." };
  if (e.state === "retired") return { ok: false, error: "Ce matériel est sorti de l'inventaire." };
  const quantity = Math.max(1, Math.round(Number(input.quantity ?? 1) || 1));
  const available = e.quantity - e.loans.reduce((n, l) => n + l.quantity, 0);
  if (quantity > available) return { ok: false, error: available <= 0 ? "Tout est déjà sorti : enregistrez un retour d'abord." : `Il n'en reste que ${available} disponible${available > 1 ? "s" : ""}.` };
  const personId = input.personId || null; let contactId = input.contactId || null; const organisationId = input.organisationId || null;
  if (!personId && !contactId && input.contact && clean(input.contact.lastName)) {
    const r = await createContact({ ...input.contact, organisationId });
    if (!r.ok) return r;
    contactId = r.data!.id;
  }
  if (!personId && !contactId) return { ok: false, error: organisationId ? "Une organisation emprunte par quelqu'un : choisissez ou créez le contact qui prend le matériel." : "Dites à qui : une personne de l'équipe, ou un contact de l'annuaire." };
  if (!input.dueAt) return { ok: false, error: "Indiquez la date de retour attendue." };
  const outAt = input.outAt ? new Date(input.outAt) : new Date();
  const dueAt = new Date(input.dueAt);
  if (dueAt < outAt) return { ok: false, error: "La date de retour précède la sortie." };
  const depositAmount = input.depositAmount != null && String(input.depositAmount).trim() ? Number(String(input.depositAmount).replace(",", ".")) : null;
  const l = await prisma.loan.create({ data: { equipmentId: e.id, quantity, personId, contactId, organisationId, editionId: input.editionId || null, outAt, dueAt, notes: clean(input.notes), depositAmount: depositAmount != null && Number.isFinite(depositAmount) ? depositAmount : null, depositRef: clean(input.depositRef), createdById: me.id } });
  revalidatePath("/materiel");
  return { ok: true, data: { id: l.id } };
}

// La fiche de prêt a été envoyée à l'emprunteur (par le mail de la personne : on trace, on n'envoie pas depuis l'outil).
export async function markLoanSent(id: string): Promise<Result> {
  await getCurrentPerson();
  await prisma.loan.update({ where: { id }, data: { sentAt: new Date() } });
  revalidatePath("/materiel");
  return { ok: true };
}

// Pièces jointes du matériel (facture d'achat, devis, notice) et des prêts (fiche signée, état des lieux).
export async function uploadEquipmentFile(form: FormData): Promise<Result> {
  const me = await getCurrentPerson();
  const equipmentId = String(form.get("equipmentId") ?? "") || null;
  const loanId = String(form.get("loanId") ?? "") || null;
  if (!equipmentId && !loanId) return { ok: false, error: "Rattachement manquant." };
  if (equipmentId && !canManageEquipment(me)) return { ok: false, error: DENIED };
  if (loanId) { const l = await prisma.loan.findUnique({ where: { id: loanId } }); if (!l) return { ok: false, error: "Prêt introuvable." }; if (l.createdById !== me.id && l.personId !== me.id && !canManageEquipment(me)) return { ok: false, error: "Ce prêt a été enregistré par quelqu'un d'autre." }; }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier." };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "Pièce trop lourde (5 Mo au plus)." };
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.includes(mime)) return { ok: false, error: "Format non accepté : PDF, image, Word, Excel ou texte." };
  const storedName = `${randomBytes(12).toString("hex")}${path.extname(file.name).toLowerCase().slice(0, 8)}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()));
  await prisma.attachment.create({ data: { equipmentId, loanId, kind: String(form.get("kind") ?? "other"), label: String(form.get("label") ?? "").trim() || file.name, fileName: file.name, storedName, mimeType: mime, size: file.size, uploadedById: me.id } });
  revalidatePath("/materiel");
  return { ok: true };
}

export async function deleteEquipmentFile(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const a = await prisma.attachment.findUnique({ where: { id } });
  if (!a || (!a.equipmentId && !a.loanId)) return { ok: false, error: "Pièce introuvable." };
  if (a.uploadedById !== me.id && !canManageEquipment(me)) return { ok: false, error: "Cette pièce a été déposée par quelqu'un d'autre." };
  await prisma.attachment.delete({ where: { id } });
  await unlink(path.join(UPLOAD_DIR, a.storedName)).catch(() => undefined);
  revalidatePath("/materiel");
  return { ok: true };
}

export async function returnLoan(id: string, input: { returnNote?: string | null; returnedAt?: string | null } = {}): Promise<Result> {
  await getCurrentPerson();
  const l = await prisma.loan.findUnique({ where: { id } });
  if (!l) return { ok: false, error: "Prêt introuvable." };
  if (l.returnedAt) return { ok: false, error: "Déjà rendu." };
  await prisma.loan.update({ where: { id }, data: { returnedAt: input.returnedAt ? new Date(input.returnedAt) : new Date(), returnNote: clean(input.returnNote) } });
  revalidatePath("/materiel");
  return { ok: true };
}

export async function deleteLoan(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const l = await prisma.loan.findUnique({ where: { id } });
  if (!l) return { ok: false, error: "Prêt introuvable." };
  if (l.createdById !== me.id && !canManageEquipment(me)) return { ok: false, error: "Ce prêt a été enregistré par quelqu'un d'autre." };
  await prisma.loan.delete({ where: { id } });
  revalidatePath("/materiel");
  return { ok: true };
}
