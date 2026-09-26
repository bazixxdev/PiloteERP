"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson, type CurrentPerson } from "@/lib/session";
import { DAY_INVALID, milestonesOutside, parseDay, propagationTargets, runsIn, validPeriod } from "@/lib/actions";
import { fmtDate } from "@/lib/format";
import { actionCtx, editionActionCtx } from "@/lib/actions-rights-db";
import { addMilestoneTx, createActionTx, extendPeriodTx, newActionData } from "@/lib/actions-write-db";
import { V, cap, ce, de, e } from "@/lib/vocab";

// Commandes de l'action (spec actions § 2). Qui peut écrire ? (actionCtx, calculé avant toute lecture ou écriture)
// - contenu, période, jalons : le pilote du projet, l'équipe d'une des années que la période couvre, le responsable de pôle
//   sur son pôle, la direction, le responsable de l'action et ses personnes associées ;
// - personnes associées : les mêmes, sauf un simple associé ;
// - suppression : pilote, équipe d'une année couverte, pôle, direction — ni le responsable ni les associés ;
// - financements (lier une ligne, son montant, retirer le lien) : le droit de modifier l'action, sur une ligne du même projet.
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
  if (!s || !en) return { ok: false, error: DAY_INVALID };
  const bad = validPeriod(s, en);
  if (bad) return { ok: false, error: bad };
  // La période contient toujours ses jalons : on ne la resserre pas en laissant un jalon dehors (lu et écrit ensemble).
  const outside = await prisma.$transaction(async (tx) => {
    const ms = await tx.milestone.findMany({ where: { actionId }, select: { date: true }, orderBy: { date: "asc" } });
    const out = milestonesOutside({ startDate: s, endDate: en }, ms.map((m) => m.date));
    if (out.length === 0) await tx.action.update({ where: { id: actionId }, data: { startDate: s, endDate: en } });
    return out;
  });
  if (outside.length > 0) return { ok: false, error: `Des jalons tomberaient hors de cette période (${outside.map((d) => fmtDate(d)).join(", ")}) : déplacez-les d'abord.` };
  refresh(actionId);
  return { ok: true };
}

// Un jalon hors de la période l'étend, dans la même transaction (periodIncluding).
export async function addMilestone(actionId: string, input: { date: string; label: string; isPublic?: boolean; isCheckpoint?: boolean }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const g = await guard(me, actionId);
  if (!g.ok) return g;
  const date = parseDay(input.date);
  if (!date) return { ok: false, error: DAY_INVALID };
  const m = await prisma.$transaction((tx) => addMilestoneTx(tx, actionId, { ...input, date }));
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
  if (date === null) return { ok: false, error: DAY_INVALID };
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
    if (date) await extendPeriodTx(tx, m.actionId, date);
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
  // Seules les personnes AJOUTÉES doivent être actives : une associée partie peut rester (ou être retirée) sans bloquer la liste.
  const current = new Set((await prisma.actionPerson.findMany({ where: { actionId }, select: { personId: true } })).map((p) => p.personId));
  const added = ids.filter((id) => !current.has(id));
  const found = added.length === 0 ? 0 : await prisma.person.count({ where: { id: { in: added }, active: true } });
  if (found !== added.length) return { ok: false, error: "Personne introuvable ou inactive." };
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

// Financements de l'action (spec actions § 2) : une action se rattache à plusieurs lignes, chacune avec un montant facultatif.
// Qui peut écrire ? le droit de modifier l'action (guard « edit »). La ligne est relue côté serveur : du même projet, d'une
// année que la période couvre. Qui peut lire ? comme la page de l'action (les montants des lignes sont déjà dans l'onglet Budget).
const LINE_NOT_FOUND = "Ligne de financement introuvable sur ce projet.";
const validAmount = (amount: unknown): amount is number | null => amount === null || (typeof amount === "number" && Number.isFinite(amount) && amount >= 0);

// Lier une ligne d'un dossier (conventionId) lie aussi ses sœurs du même dossier, même projet, sur les autres années que
// l'action couvre (propagationTargets) ; le montant ne va qu'à la ligne choisie. Renvoie le nombre de lignes liées.
export async function linkFunding(actionId: string, fundingLineId: string, amount: number | null): Promise<Result<{ linked: number }>> {
  const me = await getCurrentPerson();
  const g = await guard(me, actionId);
  if (!g.ok) return g;
  if (!validAmount(amount)) return { ok: false, error: "Montant invalide." };
  const a = g.a;
  const period = { startDate: a.startDate, endDate: a.endDate };
  const line = await prisma.fundingLine.findUnique({ where: { id: String(fundingLineId) }, select: { id: true, conventionId: true, edition: { select: { year: true, projectId: true } } } });
  if (!line || line.edition.projectId !== a.projectId) return { ok: false, error: LINE_NOT_FOUND };
  if (!runsIn(period, line.edition.year)) return { ok: false, error: `Cette ligne est de ${line.edition.year}, une année que ${ce(V.action)} ne couvre pas.` };
  // Frontière de transaction : la ligne choisie (avec son montant) et ses sœurs du même dossier, lues et liées ensemble.
  const linked = await prisma.$transaction(async (tx) => {
    let targets = [line.id];
    if (line.conventionId) {
      const sameDossier = await tx.fundingLine.findMany({ where: { conventionId: line.conventionId }, select: { id: true, conventionId: true, edition: { select: { year: true, projectId: true } } } });
      targets = propagationTargets({ ...period, projectId: a.projectId }, sameDossier.map((l) => ({ id: l.id, conventionId: l.conventionId, editionYear: l.edition.year, projectId: l.edition.projectId })), line.conventionId);
      if (!targets.includes(line.id)) targets.push(line.id);
    }
    for (const id of targets) {
      await tx.actionFunding.upsert({
        where: { actionId_fundingLineId: { actionId, fundingLineId: id } },
        create: { actionId, fundingLineId: id, amount: id === line.id ? amount : null },
        // Une sœur déjà liée garde son montant ; la ligne choisie prend celui saisi — un nouveau lien sans montant n'efface
        // pas celui déjà posé (pour le vider : setFundingAmount).
        update: id === line.id && amount !== null ? { amount } : {},
      });
    }
    return targets.length;
  });
  refresh(actionId);
  return { ok: true, data: { linked } };
}

export async function setFundingAmount(actionId: string, fundingLineId: string, amount: number | null): Promise<Result> {
  const me = await getCurrentPerson();
  const g = await guard(me, actionId);
  if (!g.ok) return g;
  if (!validAmount(amount)) return { ok: false, error: "Montant invalide." };
  const { count } = await prisma.actionFunding.updateMany({ where: { actionId, fundingLineId: String(fundingLineId) }, data: { amount } });
  if (count === 0) return { ok: false, error: LINE_NOT_FOUND };
  refresh(actionId);
  return { ok: true };
}

// Retirer un lien : seulement celui-ci ; les autres années du même dossier restent liées (on les retire une à une).
export async function unlinkFunding(actionId: string, fundingLineId: string): Promise<Result> {
  const me = await getCurrentPerson();
  const g = await guard(me, actionId);
  if (!g.ok) return g;
  const { count } = await prisma.actionFunding.deleteMany({ where: { actionId, fundingLineId: String(fundingLineId) } });
  if (count === 0) return { ok: false, error: LINE_NOT_FOUND };
  refresh(actionId);
  return { ok: true };
}
