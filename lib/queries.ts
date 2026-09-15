import { prisma } from "./db";
import { computeAlerts, nextDeliverable, nextMilestone, type Alert } from "./alerts";
import { dayjs } from "./format";
import { budgetOf } from "./budget";

export const editionListInclude = {
  project: { include: { pole: true, pilot: true, guarantor: true, mission: true, secondaryPoles: { include: { pole: true } } } },
  actions: { include: { timeEntries: { select: { hours: true } }, owner: true }, orderBy: { order: "asc" as const } },
  fundingLines: { include: { funder: true, deliverables: { orderBy: { dueDate: "asc" as const } } } },
  validations: true,
  expenses: true,
  team: { include: { person: true } },
};

export type EditionRow = Awaited<ReturnType<typeof loadPortfolio>>[number];

// Toutes les éditions « vivantes » avec leurs alertes calculées (EF-G1).
export async function loadPortfolio(settings: { envelopeAlertPercent: number; deliverableAlertDays: number }, opts?: { statuses?: string[]; year?: number }) {
  const statuses = opts?.statuses ?? ["in_progress", "validated", "proposed", "rechallenged"];
  const editions = await prisma.edition.findMany({
    where: { status: { in: statuses }, ...(opts?.year ? { year: opts.year } : {}) },
    include: editionListInclude,
    orderBy: [{ project: { pole: { name: "asc" } } }, { project: { name: "asc" } }, { year: "asc" }],
  });

  // Temps consommé par édition = temps saisi sur le projet pendant l'année de l'édition.
  const projectIds = [...new Set(editions.map((e) => e.projectId))];
  const entries = await prisma.timeEntry.findMany({ where: { projectId: { in: projectIds } }, select: { projectId: true, date: true, hours: true } });
  const consumed = new Map<string, number>();
  for (const t of entries) {
    const key = `${t.projectId}:${dayjs(t.date).year()}`;
    consumed.set(key, (consumed.get(key) ?? 0) + t.hours);
  }

  return editions.map((e) => {
    const alerts: Alert[] = computeAlerts(e, settings);
    const timeTarget = e.actions.reduce((s, a) => s + (a.timeTarget ?? 0), 0);
    const timeConsumed = consumed.get(`${e.projectId}:${e.year}`) ?? 0;
    return {
      ...e,
      alerts,
      hasDanger: alerts.some((a) => a.level === "danger"),
      timeTarget,
      timeConsumed,
      pendingValidations: e.validations.filter((v) => v.status === "pending").length,
      nextMilestone: nextMilestone(e),
      nextDeliverable: nextDeliverable(e),
      budget: budgetOf(e),
      used: budgetOf(e).used,
      remaining: budgetOf(e).available,
    };
  });
}

export const editionFullInclude = {
  project: { include: { pole: true, pilot: true, guarantor: true, mission: true, secondaryPoles: { include: { pole: true } }, editions: { select: { id: true, year: true, status: true }, orderBy: { year: "asc" as const } } } },
  actions: { include: { timeEntries: { select: { hours: true, personId: true } }, owner: true, fundingLine: { include: { funder: true } }, tasks: { where: { done: false }, select: { id: true, label: true, dueDate: true, person: { select: { name: true } } }, orderBy: { dueDate: "asc" as const } } }, orderBy: { order: "asc" as const } },
  fundingLines: { include: { funder: { include: { contacts: true } }, contact: true, convention: { include: { contact: true, lines: { select: { id: true, amountGranted: true, amountRequested: true, editionId: true } } } }, deliverables: { orderBy: { dueDate: "asc" as const } } }, orderBy: { id: "asc" as const } },
  validations: { include: { requester: true, decider: true, action: true }, orderBy: { createdAt: "desc" as const } },
  team: { include: { person: true } },
  personDays: { include: { person: true } },
  plannedLoads: true,
  docLinks: true,
  comments: { include: { author: true }, orderBy: { createdAt: "asc" as const } },
  changes: { include: { author: true }, orderBy: { createdAt: "desc" as const }, take: 30 },
  remarks: { include: { author: true, resolvedBy: true }, orderBy: { createdAt: "asc" as const } },
  indicators: { orderBy: { order: "asc" as const } },
  attachments: { include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" as const } },
  expenses: { include: { validation: { select: { id: true, requester: { select: { name: true } }, decidedAt: true } }, serviceDoneBy: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } },
  decisions: { include: { author: true, followUp: true }, orderBy: { decidedAt: "desc" as const } },
  proposals: { include: { author: true, decidedBy: true }, orderBy: { createdAt: "desc" as const } },
  achievements: { include: { author: true, action: true }, orderBy: { date: "desc" as const } },
};

export type EditionFull = NonNullable<Awaited<ReturnType<typeof loadEdition>>>;

export async function loadEdition(id: string) {
  const e = await prisma.edition.findUnique({ where: { id }, include: editionFullInclude });
  if (!e) return null;
  const entries = await prisma.timeEntry.findMany({
    where: { projectId: e.projectId, date: { gte: new Date(`${e.year}-01-01`), lt: new Date(`${e.year + 1}-01-01`) } },
    select: { hours: true, personId: true, actionId: true },
  });
  return { ...e, yearEntries: entries };
}
