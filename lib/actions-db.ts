import { prisma } from "./db";
import { runsIn } from "./actions";

const include = {
  owner: true,
  people: { include: { person: true } },
  milestones: { orderBy: { date: "asc" as const } },
  fundings: { include: { fundingLine: { include: { funder: true } } } },
  tasks: { where: { done: false }, include: { person: true }, orderBy: { dueDate: "asc" as const } },
};

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

// Les actions d'une année = celles du projet dont la période chevauche l'année (spec actions § 2). Seul chemin de lecture :
// ne plus lire `edition.actions` (relation d'origine, gardée jusqu'au contract). Une action sans projet ni période n'est
// rattachée à aucune année.
export async function attachYearActions<E extends { id: string; projectId: string; year: number }>(editions: E[]) {
  const projectIds = [...new Set(editions.map((e) => e.projectId))];
  const actions = projectIds.length === 0 ? [] : await prisma.action.findMany({ where: { projectId: { in: projectIds } }, include, orderBy: [{ startDate: "asc" }, { order: "asc" }] });
  const ids = actions.map((a) => a.id);
  const years = [...new Set(editions.map((e) => e.year))];
  // groupBy ne découpe pas par année : une requête par année demandée (les pages multi-années en ont quelques-unes).
  const [byYear, total] = ids.length === 0
    ? [new Map<number, Map<string | null, number>>(), new Map<string | null, number>()]
    : await Promise.all([
        Promise.all(years.map(async (y) => [y, await hoursOfYear(ids, y)] as const)).then((pairs) => new Map(pairs)),
        hoursOfAllTime(ids),
      ]);
  return editions.map((e) => ({
    ...e,
    actions: actions
      .filter((a) => a.projectId === e.projectId && a.startDate && a.endDate && runsIn({ startDate: a.startDate, endDate: a.endDate }, e.year))
      .map((a) => ({ ...a, hoursYear: byYear.get(e.year)?.get(a.id) ?? 0, hoursTotal: total.get(a.id) ?? 0 })),
  }));
}

// Toutes les actions d'un projet, toutes années confondues (heures totales ; pas d'année, donc pas d'heures de l'année).
export async function projectActions(projectId: string) {
  const actions = await prisma.action.findMany({ where: { projectId }, include, orderBy: [{ startDate: "asc" }, { order: "asc" }] });
  const total = actions.length === 0 ? new Map<string | null, number>() : await hoursOfAllTime(actions.map((a) => a.id));
  return actions.map((a) => ({ ...a, hoursYear: 0, hoursTotal: total.get(a.id) ?? 0 }));
}

export type YearAction = Awaited<ReturnType<typeof attachYearActions>>[number]["actions"][number];
