"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { canEditFunding, isCodir } from "@/lib/rights";
import { instanceHas } from "@/lib/modules";
import { CALL_STATUSES, suggestedReference } from "@/lib/calls";
import { dayjs } from "@/lib/format";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function moduleOn(): Promise<string | null> {
  return instanceHas(await getSettings(), "veille") ? null : "Le module « Appels à projets » est désactivé (admin › Paramètres).";
}

// Repérer un appel : la RAF, la direction — et les responsables de pôle, qui reçoivent souvent l'information les premiers.
function canSpot(role: string): boolean {
  return canEditFunding(role) || role === "pole_lead";
}

export async function addCall(input: { funderId: string; label: string; scheme?: string | null; deadline?: string | null; rolling?: boolean; recurring?: boolean; amountHint?: string | null; link?: string | null; note?: string | null }): Promise<Result<{ id: string }>> {
  const off = await moduleOn(); if (off) return { ok: false, error: off };
  const me = await getCurrentPerson();
  if (!canSpot(me.role)) return { ok: false, error: "Un appel à projets se repère par la RAF, la direction ou un responsable de pôle." };
  if (!input.funderId) return { ok: false, error: "Choisissez le financeur." };
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Donnez un intitulé à l'appel." };
  const c = await prisma.call.create({ data: {
    funderId: input.funderId, label, scheme: input.scheme?.trim() || null,
    deadline: input.rolling ? null : input.deadline ? new Date(input.deadline) : null, rolling: !!input.rolling, recurring: !!input.recurring,
    amountHint: input.amountHint?.trim() || null, link: input.link?.trim() || null, note: input.note?.trim() || null,
  } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: c.id } };
}

// Statut d'équipe : le CODIR (direction, RAF, responsables de pôle) dit « à étudier », « on dépose » ou « écarté » ; null remet à zéro.
export async function setCallStatus(id: string, status: string | null): Promise<Result> {
  const off = await moduleOn(); if (off) return { ok: false, error: off };
  const me = await getCurrentPerson();
  if (!isCodir(me.role)) return { ok: false, error: "Le statut d'un appel se pose en CODIR (direction, RAF, responsables de pôle)." };
  if (status !== null && !CALL_STATUSES.some((s) => s.value === status)) return { ok: false, error: "Statut inconnu." };
  const c = await prisma.call.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Appel introuvable" };
  await prisma.call.update({ where: { id }, data: status === null ? { teamStatus: null, statusById: null, statusAt: null } : { teamStatus: status, statusById: me.id, statusAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// « Étudier » : l'appel devient une convention « à déposer », pré-remplie ; l'appel garde le lien. Jamais deux fois.
export async function promoteCall(id: string): Promise<Result<{ conventionId: string; existed: boolean }>> {
  const off = await moduleOn(); if (off) return { ok: false, error: off };
  const me = await getCurrentPerson();
  if (!canEditFunding(me.role)) return { ok: false, error: "Seule la RAF (ou la direction) crée une convention depuis un appel." };
  const c = await prisma.call.findUnique({ where: { id }, include: { funder: true } });
  if (!c) return { ok: false, error: "Appel introuvable" };
  if (c.conventionId) return { ok: true, data: { conventionId: c.conventionId, existed: true } };
  const year = c.deadline ? dayjs(c.deadline).year() : dayjs().year();
  // Référence unique : FINANCEUR-ANNÉE, puis -2, -3… si elle existe déjà.
  const base = suggestedReference(c.funder.name, year);
  let reference = base;
  for (let i = 2; await prisma.convention.findUnique({ where: { reference } }); i++) reference = `${base}-${i}`;
  const notes = [c.amountHint ? `Montant indicatif : ${c.amountHint}.` : null, c.link ? `Appel : ${c.link}` : null, c.note].filter(Boolean).join("\n") || null;
  const conv = await prisma.convention.create({ data: {
    funderId: c.funderId, reference, scheme: c.scheme ?? c.label, label: c.label, startYear: year, endYear: year, status: "to_submit", notes,
    submittedAt: null,
  } });
  await prisma.call.update({ where: { id }, data: { conventionId: conv.id, teamStatus: "apply", statusById: c.teamStatus === "apply" ? c.statusById : me.id, statusAt: c.teamStatus === "apply" ? c.statusAt : new Date() } });
  revalidatePath("/", "layout");
  return { ok: true, data: { conventionId: conv.id, existed: false } };
}

// Reconduire un appel annuel : l'appel de l'année suivante, même contenu, statut d'équipe vierge.
export async function renewCall(id: string): Promise<Result<{ id: string }>> {
  const off = await moduleOn(); if (off) return { ok: false, error: off };
  const me = await getCurrentPerson();
  if (!canSpot(me.role)) return { ok: false, error: "Réservé à la RAF, à la direction et aux responsables de pôle." };
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
  if (!canSpot(me.role)) return { ok: false, error: "Réservé à la RAF, à la direction et aux responsables de pôle." };
  await prisma.call.update({ where: { id }, data: { active } });
  revalidatePath("/", "layout");
  return { ok: true };
}
