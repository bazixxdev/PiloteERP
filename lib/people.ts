import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { runsIn, yearsLabel } from "./actions";

// Ce qu'une personne porte dans l'outil (lot E1) : la fiche l'affiche, « Préparer un départ » le réattribue bloc par bloc.
// On ne regarde que le vivant : éditions non clôturées, actions non faites, demandes ouvertes, tâches à faire.
const LIVE = ["in_progress", "validated", "proposed", "rechallenged"];

// Les actions non faites d'une personne qui courent dans une année vivante de leur projet : la même liste pour la fiche,
// « Préparer un départ » et la réattribution (app/actions/people.ts). Triées par prochain jalon non fait.
export async function liveOwnedActions(personId: string, db: Prisma.TransactionClient = prisma) {
  const rows = await db.action.findMany({
    where: { ownerId: personId, state: { not: "done" } },
    select: { id: true, name: true, startDate: true, endDate: true, project: { select: { name: true, editions: { where: { status: { in: LIVE } }, select: { year: true } } } }, milestones: { where: { done: false }, orderBy: { date: "asc" }, take: 1, select: { date: true } } },
  });
  return rows
    .flatMap((a) => (a.project && a.startDate && a.endDate && a.project.editions.some((e) => runsIn({ startDate: a.startDate!, endDate: a.endDate! }, e.year))
      ? [{ id: a.id, name: a.name, project: a.project.name, years: yearsLabel({ startDate: a.startDate, endDate: a.endDate }), nextMilestone: a.milestones[0]?.date ?? null }]
      : []))
    .sort((x, y) => (x.nextMilestone?.getTime() ?? Infinity) - (y.nextMilestone?.getTime() ?? Infinity));
}

export async function loadResponsibilities(personId: string) {
  const [piloted, guaranteed, ledPoles, sponsored, actions, requests, tasks, teams] = await Promise.all([
    prisma.project.findMany({ where: { pilotId: personId }, include: { editions: { where: { status: { in: LIVE } }, select: { id: true, year: true } } }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { guarantorId: personId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.pole.findMany({ where: { leadId: personId }, select: { id: true, name: true } }),
    prisma.edition.findMany({ where: { sponsorId: personId, status: { in: LIVE } }, select: { id: true, year: true, project: { select: { name: true } } }, orderBy: [{ project: { name: "asc" } }, { year: "desc" }] }),
    liveOwnedActions(personId),
    prisma.request.findMany({ where: { assigneeId: personId, status: { in: ["open", "doing"] } }, select: { id: true, title: true, dueDate: true }, orderBy: { dueDate: "asc" } }),
    prisma.task.count({ where: { personId, done: false } }),
    prisma.editionTeam.findMany({ where: { personId, edition: { status: { in: LIVE } } }, select: { editionId: true, edition: { select: { year: true, project: { select: { name: true } } } } } }),
  ]);
  return { piloted, guaranteed, ledPoles, sponsored, actions, requests, tasks, teams };
}

export type Responsibilities = Awaited<ReturnType<typeof loadResponsibilities>>;

export function responsibilityCount(r: Responsibilities): number {
  return r.piloted.length + r.guaranteed.length + r.ledPoles.length + r.sponsored.length + r.actions.length + r.requests.length;
}
