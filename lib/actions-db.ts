import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { actionsOfYear, attachRefusal, editionForMilestone, withYearActions } from "./actions";

const include = {
  owner: true,
  people: { include: { person: true } },
  milestones: { orderBy: { date: "asc" as const } },
  fundings: { include: { fundingLine: { include: { funder: true } } } },
  // Pas de tâches ici (26/09) : une tâche est personnelle ; la page de l'action lit les siennes, filtrées (mes tâches et
  // listes partagées avec moi), jamais le chargeur d'une année qui les sérialiserait pour tout lecteur.
};

// Mode léger (relances, cloche, échéances : appelé par le layout à chaque navigation) : les champs de l'action, ses jalons,
// et qui prévenir (responsable, personnes associées) ; ni financements, ni tâches, ni heures.
const leanInclude = {
  owner: { select: { id: true, name: true } },
  people: { select: { person: { select: { id: true, name: true } } } },
  milestones: { orderBy: { date: "asc" as const } },
};

const order = [{ startDate: "asc" as const }, { order: "asc" as const }];

// Heures saisies par action sur [1/1/Y, 1/1/Y+1[ (même borne que la saisie de l'année dans loadEdition).
async function hoursOfYear(actionIds: string[], year: number) {
  const rows = await prisma.timeEntry.groupBy({
    by: ["actionId"],
    where: { actionId: { in: actionIds }, date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    _sum: { hours: true },
  });
  return new Map(rows.map((h) => [h.actionId, h._sum.hours ?? 0]));
}

async function hoursOfAllTime(actionIds: string[]) {
  const rows = await prisma.timeEntry.groupBy({ by: ["actionId"], where: { actionId: { in: actionIds } }, _sum: { hours: true } });
  return new Map(rows.map((t) => [t.actionId, t._sum.hours ?? 0]));
}

type Ed = { id: string; projectId: string; year: number };
const projectIdsOf = (editions: Ed[]) => [...new Set(editions.map((e) => e.projectId))];

// Les actions d'une année = celles du projet dont la période chevauche l'année (spec actions § 2). Seul chemin de lecture :
// ne plus lire `edition.actions` (relation d'origine, gardée jusqu'au contract). Une action sans projet ni période n'est
// rattachée à aucune année.
export async function attachYearActions<E extends Ed>(editions: E[]): Promise<Awaited<ReturnType<typeof full<E>>>>;
export async function attachYearActions<E extends Ed>(editions: E[], opts: { lean: true }): Promise<Awaited<ReturnType<typeof lean<E>>>>;
export async function attachYearActions<E extends Ed>(editions: E[], opts?: { lean: true }) {
  return opts?.lean ? lean(editions) : full(editions);
}

async function lean<E extends Ed>(editions: E[]) {
  const projectIds = projectIdsOf(editions);
  const actions = projectIds.length === 0 ? [] : await prisma.action.findMany({ where: { projectId: { in: projectIds } }, include: leanInclude, orderBy: order });
  return editions.map((e) => ({ ...e, actions: actionsOfYear(actions, e) }));
}

async function full<E extends Ed>(editions: E[]) {
  const projectIds = projectIdsOf(editions);
  const actions = projectIds.length === 0 ? [] : await prisma.action.findMany({ where: { projectId: { in: projectIds } }, include, orderBy: order });
  const ids = actions.map((a) => a.id);
  const years = [...new Set(editions.map((e) => e.year))];
  // groupBy ne découpe pas par année : une requête par année demandée (les pages multi-années en ont quelques-unes).
  const [byYear, total] = ids.length === 0
    ? [new Map<number, Map<string | null, number>>(), new Map<string | null, number>()]
    : await Promise.all([
        Promise.all(years.map(async (y) => [y, await hoursOfYear(ids, y)] as const)).then((pairs) => new Map(pairs)),
        hoursOfAllTime(ids),
      ]);
  return withYearActions(editions, actions, byYear, total);
}

// Toutes les actions d'un projet, toutes années confondues (heures totales ; pas d'année, donc pas d'heures de l'année).
export async function projectActions(projectId: string) {
  const actions = await prisma.action.findMany({ where: { projectId }, include, orderBy: order });
  const total = actions.length === 0 ? new Map<string | null, number>() : await hoursOfAllTime(actions.map((a) => a.id));
  return actions.map((a) => ({ ...a, hoursYear: 0, hoursTotal: total.get(a.id) ?? 0 }));
}

export type YearAction = Awaited<ReturnType<typeof full>>[number]["actions"][number];

// Jalons (filtre `where`) des actions qui courent dans une année de leur projet au statut donné, chacun rattaché à UNE année
// (editionForMilestone) : l'agenda, le café et les flux iCal ne doublent pas le jalon d'une action pluriannuelle.
export async function milestonesInEditions(where: Prisma.MilestoneWhereInput, statuses: string[]) {
  const ms = await prisma.milestone.findMany({
    where,
    include: { action: { include: { owner: true, people: { select: { personId: true } } } } },
    orderBy: [{ date: "asc" }, { order: "asc" }],
  });
  const projectIds = [...new Set(ms.flatMap((m) => (m.action.projectId ? [m.action.projectId] : [])))];
  const editions = projectIds.length === 0 ? [] : await prisma.edition.findMany({ where: { projectId: { in: projectIds }, status: { in: statuses } }, include: { project: { include: { pilot: true, pole: true } } } });
  return ms.flatMap((m) => {
    const edition = editionForMilestone(m, m.action, editions);
    return edition ? [{ ...m, edition }] : [];
  });
}

// Une action choisie pour une année (tâche, réalisation, demande de validation) : même projet, période qui chevauche l'année —
// la règle d'attachYearActions, pas l'édition de création de l'action.
export async function actionRunsInEdition(actionId: string, editionId: string | null | undefined): Promise<boolean> {
  if (!editionId) return false;
  const [a, e] = await Promise.all([
    prisma.action.findUnique({ where: { id: actionId }, select: { projectId: true, startDate: true, endDate: true } }),
    prisma.edition.findUnique({ where: { id: editionId }, select: { projectId: true, year: true } }),
  ]);
  return Boolean(e && attachRefusal(a, e) === null);
}
