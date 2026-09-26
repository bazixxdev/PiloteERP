"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson, type CurrentPerson } from "@/lib/session";
import { parseDay, validPeriod } from "@/lib/actions";
import { actionCtx, editionActionCtx } from "@/lib/actions-rights-db";
import { addMilestoneTx, createActionTx, extendPeriodTx, newActionData } from "@/lib/actions-write-db";
import { V, cap, ce, de, e } from "@/lib/vocab";

// Commandes de l'action (spec actions § 2). Qui peut écrire ? (actionCtx, calculé avant toute lecture ou écriture)
// - contenu, période, jalons : le pilote du projet, l'équipe d'une des années que la période couvre, le responsable de pôle
//   sur son pôle, la direction, le responsable de l'action et ses personnes associées ;
// - personnes associées : les mêmes, sauf un simple associé ;
// - suppression : pilote, équipe d'une année couverte, pôle, direction — ni le responsable ni les associés.
// Qui peut lire ? ce que les écrans chargent déjà.

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
type Need = "edit" | "people" | "delete";

const NOT_FOUND = () => `${cap(V.action)} introuvable.`;
const DENIED: Record<Need, () => string> = {
  edit: () => `Vous ne pouvez pas modifier ${ce(V.action)}.`,
  people: () => `Vous ne pouvez pas gérer les personnes associées à ${ce(V.action)} : son responsable ou l'équipe de l'année le fait.`,
  delete: () => `Vous ne pouvez pas supprimer ${ce(V.action)}.`,
};
// Le layout entier : l'action apparaît dans chaque année qu'elle couvre (onglets, portefeuille, échéances, agenda).
const refresh = (actionId: string) => { revalidatePath(`/action/${actionId}`); revalidatePath("/", "layout"); };

// Garde commune : le droit demandé sur l'action visée, pour la personne courante (déjà chargée par l'appelant).
async function guard(me: CurrentPerson, actionId: string, need: Need = "edit") {
  const ctx = await actionCtx(actionId, me);
  if (!ctx.a) return { ok: false as const, error: NOT_FOUND() };
  const allowed = need === "edit" ? ctx.can : need === "people" ? ctx.canManagePeople : ctx.canDelete;
  if (!allowed) return { ok: false as const, error: DENIED[need]() };
  return { ok: true as const, a: ctx.a };
}

export async function createAction(editionId: string, input: { name: string; ownerId?: string | null; startDate?: string; endDate?: string }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const { ed, can } = await editionActionCtx(editionId, me);
  if (!ed) return { ok: false, error: `${cap(V.edition)} introuvable.` };
  if (!can) return { ok: false, error: `Vous ne pouvez pas ajouter ${de(V.action)} ici.` };
  const prepared = await newActionData(ed, me, input);
  if (!prepared.ok) return prepared;
  const a = await prisma.$transaction((tx) => createActionTx(tx, prepared.data));
  refresh(a.id);
  return { ok: true, data: { id: a.id } };
}

export async function setActionPeriod(actionId: string, startDate: string, endDate: string): Promise<Result> {
  const me = await getCurrentPerson();
  const g = await guard(me, actionId);
  if (!g.ok) return g;
  const s = parseDay(startDate), en = parseDay(endDate);
  if (!s || !en) return { ok: false, error: "Date invalide." };
  const bad = validPeriod(s, en);
  if (bad) return { ok: false, error: bad };
  await prisma.action.update({ where: { id: actionId }, data: { startDate: s, endDate: en } });
  refresh(actionId);
  return { ok: true };
}

// Un jalon hors de la période l'étend, dans la même transaction (periodIncluding).
export async function addMilestone(actionId: string, input: { date: string; label: string; isPublic?: boolean; isCheckpoint?: boolean }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const g = await guard(me, actionId);
  if (!g.ok) return g;
  const date = parseDay(input.date);
  if (!date) return { ok: false, error: "Date invalide." };
  const m = await prisma.$transaction((tx) => addMilestoneTx(tx, g.a, { ...input, date }));
  refresh(actionId);
  return { ok: true, data: { id: m.id } };
}

export async function updateMilestone(id: string, patch: { date?: string; label?: string; done?: boolean; venue?: string | null; participants?: string | null; isPublic?: boolean; isCheckpoint?: boolean }): Promise<Result> {
  const me = await getCurrentPerson();
  const m = await prisma.milestone.findUnique({ where: { id }, select: { actionId: true, label: true } });
  if (!m) return { ok: false, error: "Jalon introuvable." };
  const g = await guard(me, m.actionId);
  if (!g.ok) return g;
  const date = patch.date !== undefined ? parseDay(patch.date) : undefined;
  if (date === null) return { ok: false, error: "Date invalide." };
  const text = (v: string | null) => (v ?? "").trim() || null;
  // Frontière de transaction : le jalon et l'extension de la période vont ensemble.
  await prisma.$transaction(async (tx) => {
    await tx.milestone.update({ where: { id }, data: {
      ...(date ? { date } : {}),
      ...(patch.label !== undefined ? { label: patch.label.trim() || m.label } : {}),
      ...(patch.done !== undefined ? { done: patch.done, doneAt: patch.done ? new Date() : null } : {}),
      ...(patch.venue !== undefined ? { venue: text(patch.venue) } : {}),
      ...(patch.participants !== undefined ? { participants: text(patch.participants) } : {}),
      ...(patch.isPublic !== undefined ? { isPublic: Boolean(patch.isPublic) } : {}),
      ...(patch.isCheckpoint !== undefined ? { isCheckpoint: Boolean(patch.isCheckpoint) } : {}),
    } });
    if (date) await extendPeriodTx(tx, g.a, date);
  });
  refresh(m.actionId);
  return { ok: true };
}

export async function deleteMilestone(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const m = await prisma.milestone.findUnique({ where: { id }, select: { actionId: true } });
  if (!m) return { ok: false, error: "Jalon introuvable." };
  const g = await guard(me, m.actionId);
  if (!g.ok) return g;
  await prisma.milestone.delete({ where: { id } });
  refresh(m.actionId);
  return { ok: true };
}

// Personnes associées (en plus du responsable) : elles modifient l'action comme lui, sans gérer la liste ni supprimer.
export async function setActionPeople(actionId: string, personIds: string[]): Promise<Result> {
  const me = await getCurrentPerson();
  const g = await guard(me, actionId, "people");
  if (!g.ok) return g;
  const ids = [...new Set(personIds.filter(Boolean))];
  const found = ids.length === 0 ? 0 : await prisma.person.count({ where: { id: { in: ids }, active: true } });
  if (found !== ids.length) return { ok: false, error: "Personne introuvable." };
  // Frontière de transaction : remplacer la liste d'un coup, jamais à moitié.
  await prisma.$transaction([
    prisma.actionPerson.deleteMany({ where: { actionId } }),
    prisma.actionPerson.createMany({ data: ids.map((personId) => ({ actionId, personId })) }),
  ]);
  refresh(actionId);
  return { ok: true };
}

// Supprimer une action : jamais quand du temps ou des dépenses y sont rattachés (leur lien tomberait en silence) ; tâches,
// réalisations, indicateurs et demandes de validation gardent leur ligne, détachée (SetNull) ; jalons, personnes associées
// et financements de l'action partent avec elle (Cascade).
export async function deleteAction(actionId: string): Promise<Result> {
  const me = await getCurrentPerson();
  const g = await guard(me, actionId, "delete");
  if (!g.ok) return g;
  // Frontière de transaction : on recompte au moment de supprimer.
  const blocked = await prisma.$transaction(async (tx) => {
    if ((await tx.timeEntry.count({ where: { actionId } })) || (await tx.expense.count({ where: { actionId } }))) return true;
    await tx.action.delete({ where: { id: actionId } });
    return false;
  });
  if (blocked) return { ok: false, error: `Des heures ou des dépenses y sont rattachées : passez ${ce(V.action)} en « abandonné${e(V.action)} » plutôt.` };
  revalidatePath("/", "layout");
  return { ok: true };
}
