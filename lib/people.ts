import { prisma } from "./db";

// Ce qu'une personne porte dans l'outil (lot E1) : la fiche l'affiche, « Préparer un départ » le réattribue bloc par bloc.
// On ne regarde que le vivant : éditions non clôturées, actions non faites, demandes ouvertes, tâches à faire.
const LIVE = ["in_progress", "validated", "proposed", "rechallenged"];

export async function loadResponsibilities(personId: string) {
  const [piloted, guaranteed, ledPoles, sponsored, actions, requests, tasks, teams] = await Promise.all([
    prisma.project.findMany({ where: { pilotId: personId }, include: { editions: { where: { status: { in: LIVE } }, select: { id: true, year: true } } }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { guarantorId: personId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.pole.findMany({ where: { leadId: personId }, select: { id: true, name: true } }),
    prisma.edition.findMany({ where: { sponsorId: personId, status: { in: LIVE } }, select: { id: true, year: true, project: { select: { name: true } } }, orderBy: [{ project: { name: "asc" } }, { year: "desc" }] }),
    prisma.action.findMany({ where: { ownerId: personId, state: { not: "done" }, edition: { status: { in: LIVE } } }, select: { id: true, name: true, milestoneDate: true, edition: { select: { id: true, year: true, project: { select: { name: true } } } } }, orderBy: { milestoneDate: "asc" } }),
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
