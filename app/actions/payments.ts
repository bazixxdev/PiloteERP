"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const DENIED = "Seule la RAF (ou la direction) tient les versements.";

// Ajouter un versement attendu sur une ligne de financement (cas courant) ou sur une convention (tranches d'un accord partagé).
export async function addPayment(input: { fundingLineId?: string | null; conventionId?: string | null; label: string; amount: number; expectedAt: string; received?: boolean }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: DENIED };
  if (!input.fundingLineId && !input.conventionId) return { ok: false, error: "Un versement se rattache à une ligne de financement ou à une convention." };
  if (!(input.amount > 0)) return { ok: false, error: "Le montant doit être positif." };
  if (!input.expectedAt) return { ok: false, error: "Indiquez la date attendue." };
  const p = await prisma.payment.create({
    data: {
      fundingLineId: input.fundingLineId ?? null,
      conventionId: input.fundingLineId ? null : input.conventionId ?? null,
      label: input.label.trim() || "Versement",
      amount: input.amount,
      expectedAt: new Date(input.expectedAt),
      receivedAt: input.received ? new Date() : null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: p.id } };
}

// « Reçu le… » : posé (ou retiré) à la main par la RAF ou la direction ; jamais par un import ou un rapprochement.
export async function markPaymentReceived(id: string, received: boolean, receivedAt?: string | null): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: DENIED };
  const p = await prisma.payment.findUnique({ where: { id } });
  if (!p) return { ok: false, error: "Versement introuvable" };
  await prisma.payment.update({ where: { id }, data: { receivedAt: received ? (receivedAt ? new Date(receivedAt) : new Date()) : null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePayment(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: DENIED };
  const p = await prisma.payment.findUnique({ where: { id } });
  if (!p) return { ok: false, error: "Versement introuvable" };
  if (p.receivedAt) return { ok: false, error: "Un versement reçu ne se supprime pas : retirez d'abord la réception." };
  await prisma.payment.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}
