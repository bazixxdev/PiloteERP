"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditAction } from "@/lib/rights";
import { inMyPole } from "@/lib/scope";
import { defaultPeriod, parseDay, validPeriod } from "@/lib/actions";
import { actionCtx } from "@/lib/actions-rights-db";
import { V, cap, ce, de, e, adj } from "@/lib/vocab";

// Commandes de l'action (spec actions § 2) : qui peut écrire ? le pilote du projet, l'équipe d'une des années que la période
// couvre, le responsable de pôle sur son pôle, la direction, le responsable de l'action et ses personnes associées
// (canEditAction, calculé par actionCtx avant toute lecture ou écriture). Qui peut lire ? ce que les écrans chargent déjà.

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const NOT_FOUND = () => `${cap(V.action)} introuvable.`;
const DENIED = () => `Vous ne pouvez pas modifier ${ce(V.action)}.`;
// Le layout entier : l'action apparaît dans chaque année qu'elle couvre (onglets, portefeuille, échéances, agenda).
const refresh = (actionId: string) => { revalidatePath(`/action/${actionId}`); revalidatePath("/", "layout"); };

// Garde commune : la personne courante, puis le droit sur l'action visée.
async function guard(actionId: string) {
  const me = await getCurrentPerson();
  const { a, can } = await actionCtx(actionId, me);
  if (!a) return { ok: false as const, error: NOT_FOUND() };
  if (!can) return { ok: false as const, error: DENIED() };
  return { ok: true as const, me, a };
}

// Période par défaut : l'année ; le responsable par défaut : moi si je pilote, sinon le pilote.
export async function createAction(editionId: string, input: { name: string; ownerId?: string | null; startDate?: string; endDate?: string }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const ed = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: { select: { personId: true } } } });
  if (!ed) return { ok: false, error: `${cap(V.edition)} introuvable.` };
  const isPilot = ed.project.pilotId === me.id;
  const can = canEditAction(me, { isPilot, isTeamOfCoveredYear: ed.team.some((t) => t.personId === me.id), samePole: inMyPole(me, ed.project), isOwnerOrAssociate: false });
  if (!can) return { ok: false, error: `Vous ne pouvez pas ajouter ${de(V.action)} ici.` };
  const def = defaultPeriod(ed.year);
  const start = input.startDate ? parseDay(input.startDate) : def.startDate;
  const end = input.endDate ? parseDay(input.endDate) : def.endDate;
  if (!start || !end) return { ok: false, error: "Date invalide." };
  const bad = validPeriod(start, end);
  if (bad) return { ok: false, error: bad };
  if (input.ownerId && !(await prisma.person.findFirst({ where: { id: input.ownerId, active: true }, select: { id: true } }))) return { ok: false, error: "Responsable introuvable." };
  const count = await prisma.action.count({ where: { projectId: ed.projectId } });
  const a = await prisma.action.create({ data: {
    editionId, projectId: ed.projectId, startDate: start, endDate: end, order: count, state: "todo",
    name: input.name.trim() || cap(adj(V.action, "nouveau", "nouvelle")),
    ownerId: input.ownerId || (isPilot ? me.id : ed.project.pilotId),
  } });
  refresh(a.id);
  return { ok: true, data: { id: a.id } };
}

export async function setActionPeriod(actionId: string, startDate: string, endDate: string): Promise<Result> {
  const g = await guard(actionId);
  if (!g.ok) return g;
  const s = parseDay(startDate), en = parseDay(endDate);
  if (!s || !en) return { ok: false, error: "Date invalide." };
  const bad = validPeriod(s, en);
  if (bad) return { ok: false, error: bad };
  await prisma.action.update({ where: { id: actionId }, data: { startDate: s, endDate: en } });
  refresh(actionId);
  return { ok: true };
}

export async function addMilestone(actionId: string, input: { date: string; label: string; isPublic?: boolean; isCheckpoint?: boolean }): Promise<Result<{ id: string }>> {
  const g = await guard(actionId);
  if (!g.ok) return g;
  const date = parseDay(input.date);
  if (!date) return { ok: false, error: "Date invalide." };
  const count = await prisma.milestone.count({ where: { actionId } });
  const m = await prisma.milestone.create({ data: { actionId, date, label: input.label.trim() || "Jalon", isPublic: Boolean(input.isPublic), isCheckpoint: Boolean(input.isCheckpoint), order: count } });
  refresh(actionId);
  return { ok: true, data: { id: m.id } };
}

export async function updateMilestone(id: string, patch: { date?: string; label?: string; done?: boolean; venue?: string | null; participants?: string | null; isPublic?: boolean; isCheckpoint?: boolean }): Promise<Result> {
  const m = await prisma.milestone.findUnique({ where: { id }, select: { actionId: true, label: true } });
  if (!m) return { ok: false, error: "Jalon introuvable." };
  const g = await guard(m.actionId);
  if (!g.ok) return g;
  const date = patch.date !== undefined ? parseDay(patch.date) : undefined;
  if (date === null) return { ok: false, error: "Date invalide." };
  const text = (v: string | null) => (v ?? "").trim() || null;
  await prisma.milestone.update({ where: { id }, data: {
    ...(date ? { date } : {}),
    ...(patch.label !== undefined ? { label: patch.label.trim() || m.label } : {}),
    ...(patch.done !== undefined ? { done: patch.done, doneAt: patch.done ? new Date() : null } : {}),
    ...(patch.venue !== undefined ? { venue: text(patch.venue) } : {}),
    ...(patch.participants !== undefined ? { participants: text(patch.participants) } : {}),
    ...(patch.isPublic !== undefined ? { isPublic: Boolean(patch.isPublic) } : {}),
    ...(patch.isCheckpoint !== undefined ? { isCheckpoint: Boolean(patch.isCheckpoint) } : {}),
  } });
  refresh(m.actionId);
  return { ok: true };
}

export async function deleteMilestone(id: string): Promise<Result> {
  const m = await prisma.milestone.findUnique({ where: { id }, select: { actionId: true } });
  if (!m) return { ok: false, error: "Jalon introuvable." };
  const g = await guard(m.actionId);
  if (!g.ok) return g;
  await prisma.milestone.delete({ where: { id } });
  refresh(m.actionId);
  return { ok: true };
}

// Personnes associées (en plus du responsable) : elles modifient l'action comme lui.
export async function setActionPeople(actionId: string, personIds: string[]): Promise<Result> {
  const g = await guard(actionId);
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
  const g = await guard(actionId);
  if (!g.ok) return g;
  const [hours, expenses] = await Promise.all([prisma.timeEntry.count({ where: { actionId } }), prisma.expense.count({ where: { actionId } })]);
  if (hours || expenses) return { ok: false, error: `Des heures ou des dépenses y sont rattachées : passez ${ce(V.action)} en « abandonné${e(V.action)} » plutôt.` };
  await prisma.action.delete({ where: { id: actionId } });
  revalidatePath("/", "layout");
  return { ok: true };
}
