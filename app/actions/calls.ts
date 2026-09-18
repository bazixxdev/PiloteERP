"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { canEditCalls, canEditFunding, isCodir, type Actor } from "@/lib/rights";
import { instanceHas } from "@/lib/modules";
import { CALL_STATUSES, suggestedReference } from "@/lib/calls";
import { findOrCreateOrganisation } from "@/lib/organisations";
import { dayjs } from "@/lib/format";
import { V, cap, le, de, au, seul } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function moduleOn(): Promise<string | null> {
  return instanceHas(await getSettings(), "veille") ? null : "Le module « Appels à projets » est désactivé (admin › Paramètres).";
}

// Repérer un appel : la RAF, la direction — et les responsables de pôle, qui reçoivent souvent l'information les premiers.
function canSpot(me: Actor): boolean {
  return canEditCalls(me);
}

export async function addCall(input: { funderId: string; funderName?: string | null; label: string; scheme?: string | null; deadline?: string | null; rolling?: boolean; recurring?: boolean; amountHint?: string | null; amountValue?: number | string | null; amountKind?: string; durationYears?: number | string | null; targetProjectId?: string | null; link?: string | null; note?: string | null }): Promise<Result<{ id: string }>> {
  const off = await moduleOn(); if (off) return { ok: false, error: off };
  const me = await getCurrentPerson();
  if (!canSpot(me)) return { ok: false, error: `Un appel à projets se repère par ${le(V.raf)}, ${le(V.direction)} ou un responsable ${de(V.pole)}.` };
  // Un financeur qui n'est pas encore dans l'annuaire se crée par son nom (retour de Gaël : « on ne peut pas en ajouter »).
  let funderId = input.funderId || "";
  if (!funderId && input.funderName?.trim()) funderId = (await findOrCreateOrganisation(input.funderName, "funder")).id;
  if (!funderId) return { ok: false, error: "Choisissez le financeur, ou donnez son nom." };
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Donnez un intitulé à l'appel." };
  const amountValue = input.amountValue != null && String(input.amountValue).trim() ? Number(String(input.amountValue).replace(",", ".")) : null;
  const c = await prisma.call.create({ data: {
    funderId, label, scheme: input.scheme?.trim() || null,
    deadline: input.rolling ? null : input.deadline ? new Date(input.deadline) : null, rolling: !!input.rolling, recurring: !!input.recurring,
    amountHint: input.amountHint?.trim() || null, amountValue: amountValue != null && Number.isFinite(amountValue) ? amountValue : null, amountKind: input.amountKind === "annual" ? "annual" : "total",
    durationYears: input.durationYears ? Math.max(1, Math.round(Number(input.durationYears))) : null, targetProjectId: input.targetProjectId || null,
    link: input.link?.trim() || null, note: input.note?.trim() || null,
  } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: c.id } };
}

// Statut d'équipe : le CODIR (direction, RAF, responsables de pôle) dit « à étudier », « on dépose » ou « écarté » ; null remet à zéro.
export async function setCallStatus(id: string, status: string | null): Promise<Result> {
  const off = await moduleOn(); if (off) return { ok: false, error: off };
  const me = await getCurrentPerson();
  if (!isCodir(me)) return { ok: false, error: `Le statut d'un appel se pose en ${V.codir.one} (${V.direction.one}, ${V.raf.one}, responsables ${de(V.pole)}).` };
  if (status !== null && !CALL_STATUSES.some((s) => s.value === status)) return { ok: false, error: "Statut inconnu." };
  const c = await prisma.call.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Appel introuvable" };
  await prisma.call.update({ where: { id }, data: status === null ? { teamStatus: null, statusById: null, statusAt: null } : { teamStatus: status, statusById: me.id, statusAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// « Ouvrir un dossier » : l'appel devient un dossier de financement « à étudier », prérempli (montant, durée, cible, échéance,
// description) ; l'appel garde le lien. Jamais deux fois. (Lot 2 du 19/09 : on ne crée plus une convention qu'on n'a pas gagnée.)
export async function promoteCall(id: string): Promise<Result<{ conventionId: string; existed: boolean }>> {
  const off = await moduleOn(); if (off) return { ok: false, error: off };
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: `${cap(seul(V.raf))} (ou ${le(V.direction)}) ouvre un dossier depuis un appel.` };
  const c = await prisma.call.findUnique({ where: { id }, include: { funder: true } });
  if (!c) return { ok: false, error: "Appel introuvable" };
  if (c.conventionId) return { ok: true, data: { conventionId: c.conventionId, existed: true } };
  const year = c.deadline ? dayjs(c.deadline).year() : dayjs().year();
  const base = suggestedReference(c.funder.name, year);
  let reference = base;
  for (let i = 2; await prisma.convention.findUnique({ where: { reference } }); i++) reference = `${base}-${i}`;
  const years = Math.max(1, c.durationYears ?? 1);
  const sources = c.link ? `Appel : ${c.link}` : null;
  const conv = await prisma.convention.create({ data: {
    funderId: c.funderId, reference, scheme: c.scheme, label: c.label, description: c.note ?? (c.amountHint ? `Montant indicatif : ${c.amountHint}.` : null),
    startYear: year, endYear: year + years - 1, status: "study", amountRequested: c.amountValue ?? null, amountKind: c.amountKind, deadline: c.deadline, targetProjectId: c.targetProjectId, sources,
  } });
  await prisma.call.update({ where: { id }, data: { conventionId: conv.id, teamStatus: "study", statusById: me.id, statusAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true, data: { conventionId: conv.id, existed: false } };
}

// Reconduire un appel annuel : l'appel de l'année suivante, même contenu, statut d'équipe vierge.
export async function renewCall(id: string): Promise<Result<{ id: string }>> {
  const off = await moduleOn(); if (off) return { ok: false, error: off };
  const me = await getCurrentPerson();
  if (!canSpot(me)) return { ok: false, error: `Réservé ${au(V.raf)}, ${au(V.direction)} et aux responsables ${de(V.pole)}.` };
  const c = await prisma.call.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Appel introuvable" };
  if (!c.deadline) return { ok: false, error: "Un appel au fil de l'eau ne se reconduit pas : il reste ouvert." };
  const next = dayjs(c.deadline).add(1, "year");
  const dup = await prisma.call.findFirst({ where: { funderId: c.funderId, label: c.label, deadline: next.toDate() } });
  if (dup) return { ok: true, data: { id: dup.id } };
  const n = await prisma.call.create({ data: { funderId: c.funderId, label: c.label, scheme: c.scheme, deadline: next.toDate(), rolling: false, recurring: true, amountHint: c.amountHint, link: c.link, note: c.note } });
  if (c.active) await prisma.call.update({ where: { id }, data: { active: false } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: n.id } };
}

// Retirer un appel (annulé, plus d'actualité) : il reste en base, hors de la liste des actifs.
export async function setCallActive(id: string, active: boolean): Promise<Result> {
  const off = await moduleOn(); if (off) return { ok: false, error: off };
  const me = await getCurrentPerson();
  if (!canSpot(me)) return { ok: false, error: `Réservé ${au(V.raf)}, ${au(V.direction)} et aux responsables ${de(V.pole)}.` };
  await prisma.call.update({ where: { id }, data: { active } });
  revalidatePath("/", "layout");
  return { ok: true };
}
