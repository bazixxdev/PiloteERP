"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canManageEquipment } from "@/lib/rights";
import { EQUIPMENT_STATES } from "@/lib/equipment";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const DENIED = "L'inventaire se tient par la direction, la RAF ou l'assistant·e (droit « Tient l'inventaire du matériel »).";
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

export type LoanInput = { equipmentId: string; quantity?: number | string | null; personId?: string | null; contactId?: string | null; organisationId?: string | null; editionId?: string | null; outAt?: string | null; dueAt?: string | null; notes?: string | null };

// Un prêt : à quelqu'un de l'équipe, à un contact ou à une organisation ; tout le monde peut l'enregistrer.
export async function createLoan(input: LoanInput): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const e = await prisma.equipment.findUnique({ where: { id: input.equipmentId }, include: { loans: { where: { returnedAt: null } } } });
  if (!e || !e.active) return { ok: false, error: "Matériel introuvable." };
  if (e.state === "retired") return { ok: false, error: "Ce matériel est sorti de l'inventaire." };
  const quantity = Math.max(1, Math.round(Number(input.quantity ?? 1) || 1));
  const available = e.quantity - e.loans.reduce((n, l) => n + l.quantity, 0);
  if (quantity > available) return { ok: false, error: available <= 0 ? "Tout est déjà sorti : enregistrez un retour d'abord." : `Il n'en reste que ${available} disponible${available > 1 ? "s" : ""}.` };
  const personId = input.personId || null; const contactId = input.contactId || null; const organisationId = input.organisationId || null;
  if (!personId && !contactId && !organisationId) return { ok: false, error: "Dites à qui : une personne de l'équipe, un contact ou une organisation." };
  const outAt = input.outAt ? new Date(input.outAt) : new Date();
  const dueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (dueAt && dueAt < outAt) return { ok: false, error: "La date de retour précède la sortie." };
  const l = await prisma.loan.create({ data: { equipmentId: e.id, quantity, personId, contactId, organisationId, editionId: input.editionId || null, outAt, dueAt, notes: clean(input.notes), createdById: me.id } });
  revalidatePath("/materiel");
  return { ok: true, data: { id: l.id } };
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
