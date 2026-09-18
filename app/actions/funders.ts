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
  const count = await prisma.contact.count({ where: { organisationId: funderId } });
  // L'annuaire est commun : un contact qui a déjà cette adresse n'est pas dupliqué — sans organisation, il est rattaché ici ;
  // chez une autre organisation, on le dit (il se détache depuis sa fiche).
  if (email) {
    const dup = await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: { organisation: { select: { name: true } } } });
    if (dup && dup.organisationId === funderId) return { ok: false, error: "Ce contact est déjà dans la liste." };
    if (dup && dup.organisationId) return { ok: false, error: `${[dup.firstName, dup.lastName].filter(Boolean).join(" ")} est déjà dans l'annuaire, chez ${dup.organisation?.name} : changez sa structure depuis sa fiche (Contacts).` };
    if (dup) {
      await prisma.contact.update({ where: { id: dup.id }, data: { organisationId: funderId, organisationName: null, leftAt: null, role: dup.role ?? (input.role?.trim() || null), phone: dup.phone ?? (input.phone?.trim() || null), primary: count === 0 } });
      revalidatePath("/", "layout");
      return { ok: true, data: { id: dup.id } };
    }
  }
  const c = await prisma.contact.create({
    data: { organisationId: funderId, lastName, firstName: input.firstName?.trim() || null, role: input.role?.trim() || null, email, phone: input.phone?.trim() || null, primary: count === 0 },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: c.id } };
}

export async function deleteFunderContact(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Contact introuvable." };
  await prisma.contact.delete({ where: { id } });
  // Un seul contact principal : s'il disparaît, le premier restant prend le relais.
  if (c.primary) {
    const next = await prisma.contact.findFirst({ where: { organisationId: c.organisationId }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.contact.update({ where: { id: next.id }, data: { primary: true } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPrimaryFunderContact(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Contact introuvable." };
  await prisma.$transaction([
    prisma.contact.updateMany({ where: { organisationId: c.organisationId }, data: { primary: false } }),
    prisma.contact.update({ where: { id }, data: { primary: true } }),
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

// Rattacher un contact de l'annuaire (sans organisation) à ce financeur : même personne, une seule fiche (Contacts).
export async function attachFunderContact(funderId: string, contactId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const c = await prisma.contact.findUnique({ where: { id: contactId }, include: { organisation: { select: { name: true } } } });
  if (!c) return { ok: false, error: "Contact introuvable." };
  if (c.organisationId && c.organisationId !== funderId) return { ok: false, error: `Ce contact est chez ${c.organisation?.name} : changez sa structure depuis sa fiche (Contacts).` };
  const count = await prisma.contact.count({ where: { organisationId: funderId, leftAt: null } });
  await prisma.contact.update({ where: { id: contactId }, data: { organisationId: funderId, organisationName: null, leftAt: null, primary: c.primary || count === 0 } });
  revalidatePath("/", "layout");
  return { ok: true };
}
