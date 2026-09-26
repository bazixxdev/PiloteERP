import { prisma } from "./db";
import { canEditActions, has } from "./rights";
import { inMyPole, projectPoleIds, type Viewer } from "./scope";
import { canReadDelegation, canWriteDelegation, dueInPeriod, objectiveInPeriod, periodFor, periodsOf } from "./delegation";
import { attachYearActions } from "./actions-db";
import { milestoneTitle } from "./actions";

const include = {
  edition: { select: {
    id: true, year: true, projectId: true,
    project: { select: { name: true, pilotId: true, poleId: true, pole: { select: { name: true } }, secondaryPoles: { select: { poleId: true } } } },
    team: { select: { personId: true } },
    indicators: { select: { id: true, label: true, target: true, actual: true, imposed: true }, orderBy: { order: "asc" as const } },
    fundingLines: { select: { funder: { select: { name: true } }, deliverables: { select: { id: true, label: true, dueDate: true, done: true } } } },
  } },
  revisions: { select: { id: true, createdAt: true, expectations: true, limits: true, controls: true, author: { select: { name: true } } }, orderBy: { createdAt: "desc" as const } },
};

// La feuille de délégation d'une personne pour une année et une période. Chaque délégation illisible pour `me` est écartée
// ici, avant tout envoi ; les tâches ne sortent que pour la personne elle-même (elles sont personnelles).
// Renvoie null si la personne n'existe pas ou si rien n'est lisible pour quelqu'un d'autre qu'elle.
export async function loadSheet(me: Viewer, personId: string, year: number, periodKey?: string) {
  const [person, settings, rows] = await Promise.all([
    prisma.person.findUnique({ where: { id: personId }, select: { id: true, name: true, jobTitle: true } }),
    prisma.settings.findUnique({ where: { id: 1 }, select: { delegationPeriods: true } }),
    prisma.delegation.findMany({ where: { personId, edition: { year } }, include, orderBy: { createdAt: "asc" } }),
  ]);
  if (!person) return null;
  const isSelf = me.id === personId;
  const readable = rows.filter((r) => canReadDelegation(me, { personId, poleIds: projectPoleIds(r.edition.project) }));
  if (!isSelf && readable.length === 0) return null;
  const periods = periodsOf(settings?.delegationPeriods ?? "01-06,07-12", year);
  const period = periodFor(periodKey, periods, new Date());
  const tasks = isSelf
    ? await prisma.task.findMany({ where: { personId, editionId: { in: readable.map((r) => r.editionId) } }, select: { id: true, label: true, dueDate: true, done: true, editionId: true }, orderBy: [{ done: "asc" }, { dueDate: "asc" }] })
    : null;
  // Les actions de l'année (période qui chevauche l'année) ; objectifs et points de contrôle se lisent sur leurs jalons.
  const years = await attachYearActions(readable.map((r) => r.edition), { lean: true });
  const actionsOf = new Map(years.map((e) => [e.id, e.actions]));
  const cards = readable.map((r) => {
    const e = r.edition;
    const actions = (actionsOf.get(e.id) ?? []).map((a) => {
      const own = a.milestones.filter((m) => !m.isCheckpoint);
      // L'échéance d'un objectif : son prochain jalon non fait (hors points de contrôle), sinon le dernier tenu.
      return { ...a, due: own.find((m) => !m.done)?.date ?? own[own.length - 1]?.date ?? null, onlyCheckpoints: a.milestones.length > 0 && own.length === 0 };
    }).sort((x, y) => (x.due?.getTime() ?? Infinity) - (y.due?.getTime() ?? Infinity) || x.order - y.order);
    const checkpoints = actions.flatMap((a) => a.milestones.filter((m) => m.isCheckpoint && dueInPeriod(m.date, period)).map((m) => ({ id: m.id, name: milestoneTitle(a.name, m.label), date: m.date, owner: a.owner })))
      .sort((x, y) => x.date.getTime() - y.date.getTime());
    return {
      pole: e.project.pole.name,
      canWrite: canWriteDelegation(me, projectPoleIds(e.project)),
      canAddObjective: canEditActions(me, e.project.pilotId === me.id, e.team.some((t) => t.personId === me.id), inMyPole(me, e.project)),
      delegation: { id: r.id, expectations: r.expectations, limits: r.limits, controls: r.controls, acknowledgedAt: r.acknowledgedAt, boardPresentedAt: r.boardPresentedAt, revisions: r.revisions },
      edition: { id: e.id, name: e.project.name, year: e.year },
      // Un objectif n'est pas une action faite seulement de points de contrôle (l'ancien « point de contrôle » d'action).
      objectives: actions.filter((a) => a.ownerId === personId && !a.onlyCheckpoints && objectiveInPeriod(a, period)).map((a) => ({ id: a.id, name: a.name, state: a.state, due: a.due })),
      checkpoints,
      indicators: e.indicators,
      deliverables: e.fundingLines.flatMap((l) => l.deliverables.filter((d) => dueInPeriod(d.dueDate, period)).map((d) => ({ ...d, funder: l.funder.name }))).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
      tasks: tasks ? tasks.filter((t) => t.editionId === e.id && (!t.done || (t.dueDate && dueInPeriod(t.dueDate, period)))) : null,
    };
  });
  const groups = [...new Set(cards.map((c) => c.pole))].map((pole) => ({ pole, cards: cards.filter((c) => c.pole === pole) }));
  return { person, year, periods, period, groups, isSelf, canWrite: cards.some((c) => c.canWrite) };
}

export type Sheet = NonNullable<Awaited<ReturnType<typeof loadSheet>>>;

// Personnes dont `me` peut lire au moins une délégation de l'année, avec leur état (pour la coordination).
export async function listPeople(me: Viewer, year: number) {
  if (!has(me, "delegation.view_all") && !has(me, "delegation.write")) return [];
  const rows = await prisma.delegation.findMany({ where: { edition: { year } }, select: { personId: true, acknowledgedAt: true, boardPresentedAt: true, person: { select: { name: true } }, edition: { select: { project: { select: { poleId: true, secondaryPoles: { select: { poleId: true } } } } } } } });
  const by = new Map<string, { id: string; name: string; total: number; unread: number; board: Date | null }>();
  for (const r of rows) {
    if (!canReadDelegation(me, { personId: r.personId, poleIds: projectPoleIds(r.edition.project) })) continue;
    const p = by.get(r.personId) ?? { id: r.personId, name: r.person.name, total: 0, unread: 0, board: null };
    p.total += 1;
    if (!r.acknowledgedAt) p.unread += 1;
    if (r.boardPresentedAt && (!p.board || r.boardPresentedAt > p.board)) p.board = r.boardPresentedAt;
    by.set(r.personId, p);
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// Éditions de l'année où `me` peut rédiger une délégation (formulaire « Nouvelle délégation »).
export async function writableEditions(me: Viewer, year: number) {
  if (!has(me, "delegation.write")) return [];
  const eds = await prisma.edition.findMany({ where: { year }, select: { id: true, project: { select: { name: true, poleId: true, secondaryPoles: { select: { poleId: true } } } } }, orderBy: { project: { name: "asc" } } });
  return eds.filter((e) => canWriteDelegation(me, projectPoleIds(e.project))).map((e) => ({ id: e.id, name: e.project.name }));
}
