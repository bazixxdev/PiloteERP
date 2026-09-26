import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { defaultPeriod, parseDay, periodIncluding, runsIn, validPeriod, type Period } from "./actions";
import { V, cap, adj, ce } from "@/lib/vocab";

// Écritures de l'action, utilisables dans une transaction (Prisma.TransactionClient). Pas de « use server » : les gardes sont
// faites AVANT par les commandes (app/actions/actions.ts) et l'objectif de délégation, qui les appellent ensuite.

type Tx = Prisma.TransactionClient;
type Fail = { ok: false; error: string };

export type NewAction = { editionId: string; projectId: string; startDate: Date; endDate: Date; name: string; ownerId: string | null };

// Ce qu'on crée : période par défaut = l'année ; une période choisie doit chevaucher l'année où on crée l'action (sinon elle
// n'y apparaîtrait pas) ; responsable = celui choisi s'il est actif, sinon moi si je pilote, sinon le pilote.
export async function newActionData(
  ed: { id: string; year: number; projectId: string; project: { pilotId: string } },
  me: { id: string },
  input: { name: string; ownerId?: string | null; startDate?: string; endDate?: string },
): Promise<{ ok: true; data: NewAction } | Fail> {
  const def = defaultPeriod(ed.year);
  const start = input.startDate ? parseDay(input.startDate) : def.startDate;
  const end = input.endDate ? parseDay(input.endDate) : def.endDate;
  if (!start || !end) return { ok: false, error: "Date invalide." };
  const bad = validPeriod(start, end);
  if (bad) return { ok: false, error: bad };
  if (!runsIn({ startDate: start, endDate: end }, ed.year)) return { ok: false, error: `La période doit couvrir ${ed.year} pour que ${ce(V.action)} y apparaisse.` };
  if (input.ownerId && !(await activePerson(input.ownerId))) return { ok: false, error: "Responsable introuvable." };
  return { ok: true, data: {
    editionId: ed.id, projectId: ed.projectId, startDate: start, endDate: end,
    name: input.name.trim() || cap(adj(V.action, "nouveau", "nouvelle")),
    ownerId: input.ownerId || (ed.project.pilotId === me.id ? me.id : ed.project.pilotId),
  } };
}

export async function activePerson(id: string): Promise<boolean> {
  return Boolean(await prisma.person.findFirst({ where: { id, active: true }, select: { id: true } }));
}

export async function createActionTx(tx: Tx, data: NewAction) {
  const order = await tx.action.count({ where: { projectId: data.projectId } });
  return tx.action.create({ data: { ...data, order, state: "todo" } });
}

// Un jalon hors de la période l'étend (periodIncluding) : dans la même transaction que le jalon.
export async function extendPeriodTx(tx: Tx, action: { id: string } & Period, date: Date) {
  const p = periodIncluding(action, date);
  if (p.startDate.getTime() !== action.startDate.getTime() || p.endDate.getTime() !== action.endDate.getTime()) {
    await tx.action.update({ where: { id: action.id }, data: p });
  }
}

export async function addMilestoneTx(tx: Tx, action: { id: string } & Period, input: { date: Date; label: string; isPublic?: boolean; isCheckpoint?: boolean }) {
  const order = await tx.milestone.count({ where: { actionId: action.id } });
  const m = await tx.milestone.create({ data: { actionId: action.id, date: input.date, label: input.label.trim() || "Jalon", isPublic: Boolean(input.isPublic), isCheckpoint: Boolean(input.isCheckpoint), order } });
  await extendPeriodTx(tx, action, input.date);
  return m;
}
