"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditActions } from "@/lib/rights";
import { inMyPole, projectPoleIds } from "@/lib/scope";
import { canWriteDelegation } from "@/lib/delegation";
import { fmtDate } from "@/lib/format";
import { reportInternalError } from "@/lib/errors";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const DENIED = "Vous ne rédigez pas cette délégation.";
const KIND = "delegation";
const link = (personId: string) => `/delegation?personne=${personId}`;
const clean = (s: string | null | undefined) => (s ?? "").trim() || null;

async function delegationFor(id: string) {
  return prisma.delegation.findUnique({ where: { id }, include: { person: { select: { id: true, name: true } }, edition: { select: { id: true, year: true, project: { select: { name: true, poleId: true, secondaryPoles: { select: { poleId: true } } } } } } } });
}

// Nouvelles délégations d'une personne sur des éditions ; idempotent (une existante n'est pas doublée).
export async function createDelegations(personId: string, editionIds: string[]): Promise<Result<{ created: number }>> {
  try {
    const me = await getCurrentPerson();
    const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true, active: true } });
    if (!person?.active) return { ok: false, error: "Personne introuvable ou partie." };
    const ids = [...new Set(editionIds.filter(Boolean))];
    if (ids.length === 0) return { ok: false, error: "Choisissez au moins un projet." };
    const eds = await prisma.edition.findMany({ where: { id: { in: ids } }, select: { id: true, project: { select: { name: true, poleId: true, secondaryPoles: { select: { poleId: true } } } } } });
    if (eds.length !== ids.length || eds.some((e) => !canWriteDelegation(me, projectPoleIds(e.project)))) return { ok: false, error: DENIED };
    const r = await prisma.delegation.createMany({ data: eds.map((e) => ({ personId, editionId: e.id, createdById: me.id })), skipDuplicates: true });
    if (r.count > 0 && personId !== me.id) await prisma.notification.create({ data: { personId, senderId: me.id, kind: KIND, title: `Nouvelle délégation : ${eds.map((e) => e.project.name).join(", ")}`, link: link(personId) } });
    revalidatePath("/delegation");
    return { ok: true, data: { created: r.count } };
  } catch (e) {
    return { ok: false, ...reportInternalError("createDelegations", e) };
  }
}

// Modifier attendus, limites, contrôles : l'état précédent part dans l'historique et la personne doit relire.
export async function updateDelegation(id: string, input: { expectations?: string | null; limits?: string | null; controls?: string | null }): Promise<Result> {
  try {
    const me = await getCurrentPerson();
    const d = await delegationFor(id);
    if (!d || !canWriteDelegation(me, projectPoleIds(d.edition.project))) return { ok: false, error: DENIED };
    const next = { expectations: input.expectations === undefined ? d.expectations : clean(input.expectations), limits: input.limits === undefined ? d.limits : clean(input.limits), controls: input.controls === undefined ? d.controls : clean(input.controls) };
    if (next.expectations === d.expectations && next.limits === d.limits && next.controls === d.controls) return { ok: true };
    // Une délégation encore vide n'a rien à archiver : la première rédaction ne crée pas de version.
    const hadText = Boolean(d.expectations || d.limits || d.controls);
    await prisma.$transaction([
      ...(hadText ? [prisma.delegationRevision.create({ data: { delegationId: id, expectations: d.expectations, limits: d.limits, controls: d.controls, authorId: me.id } })] : []),
      prisma.delegation.update({ where: { id }, data: { ...next, acknowledgedAt: null } }),
      ...(d.personId !== me.id ? [prisma.notification.create({ data: { personId: d.personId, senderId: me.id, kind: KIND, title: `Délégation modifiée, à relire : ${d.edition.project.name}`, link: link(d.personId) } })] : []),
    ]);
    revalidatePath("/delegation");
    return { ok: true };
  } catch (e) {
    return { ok: false, ...reportInternalError("updateDelegation", e) };
  }
}

// Prise de connaissance : seule la personne concernée, jamais quelqu'un à sa place (même la coordination).
export async function acknowledgeDelegations(ids: string[]): Promise<Result> {
  const me = await getCurrentPerson();
  const rows = await prisma.delegation.findMany({ where: { id: { in: ids } }, select: { id: true, personId: true } });
  if (rows.length === 0 || rows.length !== new Set(ids).size || rows.some((r) => r.personId !== me.id)) return { ok: false, error: "Seule la personne concernée prend connaissance de sa délégation." };
  await prisma.$transaction([
    prisma.delegation.updateMany({ where: { id: { in: ids }, personId: me.id }, data: { acknowledgedAt: new Date() } }),
    prisma.notification.updateMany({ where: { personId: me.id, kind: KIND, readAt: null }, data: { readAt: new Date() } }),
  ]);
  revalidatePath("/delegation");
  return { ok: true };
}

// Présentation au CA : datée sur les délégations de l'année et consignée en décision « CA » sur chaque édition concernée.
export async function consignBoardPresentation(personId: string, year: number, date: string, note?: string | null): Promise<Result> {
  try {
    const me = await getCurrentPerson();
    const when = new Date(date);
    if (!date || Number.isNaN(when.getTime())) return { ok: false, error: "Indiquez la date de la présentation." };
    const rows = await prisma.delegation.findMany({ where: { personId, edition: { year } }, include: { person: { select: { name: true } }, edition: { select: { id: true, project: { select: { poleId: true, secondaryPoles: { select: { poleId: true } } } } } } } });
    const mine = rows.filter((r) => canWriteDelegation(me, projectPoleIds(r.edition.project)));
    if (mine.length === 0) return { ok: false, error: DENIED };
    const body = `Délégation de ${mine[0].person.name} présentée au CA le ${fmtDate(when)}.${clean(note) ? ` ${clean(note)}` : ""}`;
    await prisma.$transaction([
      prisma.delegation.updateMany({ where: { id: { in: mine.map((r) => r.id) } }, data: { boardPresentedAt: when } }),
      ...mine.map((r) => prisma.decision.create({ data: { editionId: r.edition.id, instance: "board", body, authorId: me.id, decidedAt: when } })),
    ]);
    revalidatePath("/delegation");
    return { ok: true };
  } catch (e) {
    return { ok: false, ...reportInternalError("consignBoardPresentation", e) };
  }
}

export async function deleteDelegation(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const d = await delegationFor(id);
  if (!d || !canWriteDelegation(me, projectPoleIds(d.edition.project))) return { ok: false, error: DENIED };
  await prisma.delegation.delete({ where: { id } });
  revalidatePath("/delegation");
  return { ok: true };
}

// Point de contrôle : même droit que la modification des actions de l'édition.
export async function setActionCheckpoint(actionId: string, value: boolean): Promise<Result> {
  const me = await getCurrentPerson();
  const a = await prisma.action.findUnique({ where: { id: actionId }, select: { editionId: true, edition: { select: { project: { select: { pilotId: true, poleId: true, secondaryPoles: { select: { poleId: true } } } }, team: { select: { personId: true } } } } } });
  if (!a) return { ok: false, error: "Introuvable." };
  const p = a.edition.project;
  if (!canEditActions(me, p.pilotId === me.id, a.edition.team.some((t) => t.personId === me.id), inMyPole(me, p))) return { ok: false, error: "Vous ne modifiez pas les étapes de ce projet." };
  await prisma.action.update({ where: { id: actionId }, data: { isCheckpoint: value } });
  revalidatePath("/delegation");
  revalidatePath(`/edition/${a.editionId}`);
  return { ok: true };
}
