"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canManageMembers } from "@/lib/rights";
import { findOrCreateOrganisation, hasKind, kindsOf, serializeKinds } from "@/lib/organisations";
import { MEMBERSHIP_METHODS, MEMBERSHIP_STATUS } from "@/lib/members";
import { createContact, type ContactInput } from "./contacts";
import { V, le } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const DENIED = `Les adhésions se tiennent par ${le(V.raf)} ou ${le(V.direction)} (droit « Gère les adhésions »).`;
const clean = (v: unknown) => { const s = v == null ? "" : String(v).trim(); return s || null; };

async function guard() {
  const me = await getCurrentPerson();
  return { me, denied: canManageMembers(me) ? null : DENIED };
}

async function ensureMemberKind(orgId: string) {
  const o = await prisma.organisation.findUnique({ where: { id: orgId } });
  if (o && !hasKind(o, "member")) await prisma.organisation.update({ where: { id: orgId }, data: { kinds: serializeKinds([...kindsOf(o), "member"]) } });
}

export type MembershipInput = {
  year: number; college?: string | null; amount?: number | null; status?: string; paidAt?: string | null; method?: string | null; notes?: string | null;
  organisationId?: string | null; organisationName?: string | null; // structure : existante, ou à créer par son nom
  contactId?: string | null; contact?: ContactInput | null; // personne physique : existante, ou créée au passage ; ou référent·e de la structure
};

// Une adhésion : structure (organisation de l'annuaire, créée par son nom au besoin) ou personne (contact), une année.
export async function createMembership(input: MembershipInput): Promise<Result<{ id: string }>> {
  const { me, denied } = await guard(); if (denied) return { ok: false, error: denied };
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: "Année invalide." };
  const status = MEMBERSHIP_STATUS.some((s) => s.value === input.status) ? input.status! : "due";
  const method = input.method && MEMBERSHIP_METHODS.some((m) => m.value === input.method) ? input.method : null;
  let organisationId = input.organisationId || null;
  if (!organisationId && clean(input.organisationName)) organisationId = (await findOrCreateOrganisation(input.organisationName!, "member")).id;
  let contactId = input.contactId || null;
  if (!contactId && input.contact && clean(input.contact.lastName)) {
    const r = await createContact({ ...input.contact, organisationId: organisationId ?? input.contact.organisationId ?? null });
    if (!r.ok) return r;
    contactId = r.data!.id;
  }
  if (!organisationId && !contactId) return { ok: false, error: "Choisissez une structure ou une personne." };
  const dup = await prisma.membership.findFirst({ where: { year, status: { not: "cancelled" }, ...(organisationId ? { organisationId } : { contactId }) } });
  if (dup) return { ok: false, error: `Une adhésion ${year} existe déjà pour ce membre.` };
  if (organisationId) await ensureMemberKind(organisationId);
  const m = await prisma.membership.create({ data: { organisationId, contactId, year, college: clean(input.college), amount: Number(input.amount ?? 0) || 0, status, paidAt: input.paidAt ? new Date(input.paidAt) : status === "paid" ? new Date() : null, method: status === "paid" ? method ?? "other" : method, notes: clean(input.notes), createdById: me.id } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: m.id } };
}

// Régler / changer le statut en un clic (le reste se modifie en place).
export async function setMembershipStatus(id: string, status: string, method?: string | null): Promise<Result> {
  const { denied } = await guard(); if (denied) return { ok: false, error: denied };
  if (!MEMBERSHIP_STATUS.some((s) => s.value === status)) return { ok: false, error: "Statut inconnu." };
  const m = await prisma.membership.findUnique({ where: { id } });
  if (!m) return { ok: false, error: "Adhésion introuvable." };
  await prisma.membership.update({ where: { id }, data: { status, paidAt: status === "paid" ? m.paidAt ?? new Date() : status === "due" ? null : m.paidAt, ...(status === "paid" && method && MEMBERSHIP_METHODS.some((x) => x.value === method) ? { method } : {}) } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteMembership(id: string): Promise<Result> {
  const { denied } = await guard(); if (denied) return { ok: false, error: denied };
  const m = await prisma.membership.findUnique({ where: { id } });
  if (!m) return { ok: false, error: "Adhésion introuvable." };
  if (m.helloAssoItemId) return { ok: false, error: "Cette adhésion vient de HelloAsso : elle se marque « annulée », elle ne se supprime pas (elle reviendrait à la synchronisation)." };
  await prisma.membership.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Reconduire : les adhérents de l'année N (hors annulées) sans adhésion N+1 en reçoivent une « à régler », même collège,
// même cotisation. Prépare la campagne ; rien n'est encaissé.
export async function renewMemberships(fromYear: number): Promise<Result<{ created: number; skipped: number }>> {
  const { me, denied } = await guard(); if (denied) return { ok: false, error: denied };
  const toYear = fromYear + 1;
  const [from, to] = await Promise.all([
    prisma.membership.findMany({ where: { year: fromYear, status: { not: "cancelled" } } }),
    prisma.membership.findMany({ where: { year: toYear, status: { not: "cancelled" } }, select: { organisationId: true, contactId: true } }),
  ]);
  const have = new Set(to.map((m) => m.organisationId ? `o:${m.organisationId}` : `c:${m.contactId}`));
  let created = 0, skipped = 0;
  for (const m of from) {
    const key = m.organisationId ? `o:${m.organisationId}` : `c:${m.contactId}`;
    if (have.has(key)) { skipped++; continue; }
    have.add(key);
    await prisma.membership.create({ data: { organisationId: m.organisationId, contactId: m.contactId, year: toYear, college: m.college, amount: m.amount, status: m.status === "exempt" ? "exempt" : "due", createdById: me.id } });
    created++;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { created, skipped } };
}
