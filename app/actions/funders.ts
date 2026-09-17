"use server";

import { revalidatePath } from "next/cache";
import { findOrCreateOrganisation, kindFilter } from "@/lib/organisations";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Contacts d'un financeur : tenus par la RAF (ou la direction). Le minimum utile, pas de synchronisation Outlook.
async function guard(): Promise<string | null> {
  const me = await getCurrentPerson();
  return canEditFunding(me) ? null : "Seule la RAF (ou la direction) tient les contacts des financeurs.";
}

export async function addFunderContact(funderId: string, input: { firstName?: string; lastName: string; role?: string; email?: string; phone?: string }): Promise<Result<{ id: string }>> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const lastName = input.lastName.trim();
  if (!lastName) return { ok: false, error: "Le nom est obligatoire." };
  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Adresse email invalide." };
  const count = await prisma.organisationContact.count({ where: { organisationId: funderId } });
  const c = await prisma.organisationContact.create({
    data: { organisationId: funderId, lastName, firstName: input.firstName?.trim() || null, role: input.role?.trim() || null, email, phone: input.phone?.trim() || null, primary: count === 0 },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: c.id } };
}

export async function deleteFunderContact(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const c = await prisma.organisationContact.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Contact introuvable." };
  await prisma.organisationContact.delete({ where: { id } });
  // Un seul contact principal : s'il disparaît, le premier restant prend le relais.
  if (c.primary) {
    const next = await prisma.organisationContact.findFirst({ where: { organisationId: c.organisationId }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.organisationContact.update({ where: { id: next.id }, data: { primary: true } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPrimaryFunderContact(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const c = await prisma.organisationContact.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Contact introuvable." };
  await prisma.$transaction([
    prisma.organisationContact.updateMany({ where: { organisationId: c.organisationId }, data: { primary: false } }),
    prisma.organisationContact.update({ where: { id }, data: { primary: true } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addFunder(name: string): Promise<Result<{ id: string }>> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const n = name.trim();
  if (!n) return { ok: false, error: "Nom du financeur obligatoire." };
  if ((await prisma.organisation.findMany({ where: { name: { equals: n, mode: "insensitive" }, ...kindFilter("funder") } })).length) return { ok: false, error: `« ${n} » existe déjà.` };
  const f = await findOrCreateOrganisation(n, "funder");
  revalidatePath("/", "layout");
  return { ok: true, data: { id: f.id } };
}
