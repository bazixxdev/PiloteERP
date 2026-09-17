"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin, canEditFunding, canWriteLayer } from "@/lib/rights";
import { projectPoleIds } from "@/lib/scope";
import { findOrCreateOrganisation, kindsOf, ORGANISATION_KINDS, serializeKinds, type OrganisationKind } from "@/lib/organisations";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// L'annuaire des organisations (lot E2) est tenu par qui gère les financements ou administre l'outil.
async function guard(): Promise<string | null> {
  const me = await getCurrentPerson();
  return canEditFunding(me) || canAdmin(me) ? null : "L'annuaire des organisations est tenu par la RAF et la direction.";
}

export async function createOrganisation(name: string, kinds: string[]): Promise<Result<{ id: string }>> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const n = name.trim();
  if (!n) return { ok: false, error: "Le nom est obligatoire." };
  const ks = kinds.filter((k): k is OrganisationKind => ORGANISATION_KINDS.some((x) => x.key === k));
  if (ks.length === 0) return { ok: false, error: "Choisissez au moins un genre." };
  const existing = (await prisma.organisation.findMany({ where: { name: { equals: n, mode: "insensitive" } } }))[0];
  if (existing) return { ok: false, error: `« ${existing.name} » existe déjà : ajoutez-lui le genre plutôt qu'un doublon.` };
  const o = await prisma.organisation.create({ data: { name: n, kinds: serializeKinds(ks) } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: o.id } };
}

// Genres cumulables ; on ne retire pas un genre encore utilisé (financeur cité par une ligne, fournisseur cité par un devis).
export async function setOrganisationKind(id: string, kind: OrganisationKind, on: boolean): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const o = await prisma.organisation.findUnique({ where: { id }, include: { _count: { select: { lines: true, conventions: true, calls: true, validations: true, editions: true } } } });
  if (!o) return { ok: false, error: "Organisation introuvable." };
  const current = kindsOf(o);
  if (!on) {
    if (kind === "funder" && (o._count.lines || o._count.conventions || o._count.calls)) return { ok: false, error: "Cette organisation finance encore des lignes, conventions ou appels : le genre financeur reste." };
    if (kind === "supplier" && o._count.validations) return { ok: false, error: "Des devis citent encore ce fournisseur : le genre reste." };
    if (kind === "partner" && o._count.editions) return { ok: false, error: "Des éditions la citent encore comme partenaire : le genre reste." };
    if (current.length <= 1) return { ok: false, error: "Une organisation garde au moins un genre." };
  }
  const next = on ? [...current, kind] : current.filter((k) => k !== kind);
  await prisma.organisation.update({ where: { id }, data: { kinds: serializeKinds(next) } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Un contact parti se détache (date) ; il reste lisible sur les dossiers qui le citent. Retour possible.
export async function setContactLeft(id: string, left: boolean): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Contact introuvable." };
  await prisma.contact.update({ where: { id }, data: { leftAt: left ? new Date() : null, primary: left ? false : c.primary } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Partenaires d'une édition : le pilote, l'équipe, le responsable de pôle, la direction (même droit que le fil de l'année).
async function editionGuard(editionId: string): Promise<string | null> {
  const me = await getCurrentPerson();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: true } });
  if (!e) return "Édition introuvable.";
  const ok = canWriteLayer(me, "year", e.project.pilotId === me.id, e.team.some((t) => t.personId === me.id), me.poleId !== null && projectPoleIds(e.project).includes(me.poleId));
  return ok ? null : "Le pilote, l'équipe ou le responsable de pôle lient les partenaires.";
}

export async function addEditionPartner(editionId: string, input: { organisationId?: string | null; name?: string | null; role?: string | null }): Promise<Result<{ organisationId: string }>> {
  const d = await editionGuard(editionId); if (d) return { ok: false, error: d };
  let organisationId = input.organisationId ?? null;
  if (!organisationId) {
    const name = input.name?.trim();
    if (!name) return { ok: false, error: "Choisissez une organisation ou donnez son nom." };
    organisationId = (await findOrCreateOrganisation(name, "partner")).id;
  } else {
    const o = await prisma.organisation.findUnique({ where: { id: organisationId } });
    if (!o) return { ok: false, error: "Organisation introuvable." };
    if (!kindsOf(o).includes("partner")) await prisma.organisation.update({ where: { id: o.id }, data: { kinds: serializeKinds([...kindsOf(o), "partner"]) } });
  }
  await prisma.editionPartner.upsert({ where: { editionId_organisationId: { editionId, organisationId } }, create: { editionId, organisationId, role: input.role?.trim() || null }, update: { role: input.role?.trim() || null } });
  revalidatePath("/", "layout");
  return { ok: true, data: { organisationId } };
}

export async function removeEditionPartner(editionId: string, organisationId: string): Promise<Result> {
  const d = await editionGuard(editionId); if (d) return { ok: false, error: d };
  await prisma.editionPartner.deleteMany({ where: { editionId, organisationId } });
  revalidatePath("/", "layout");
  return { ok: true };
}
