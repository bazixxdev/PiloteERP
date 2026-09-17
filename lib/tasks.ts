import { type Viewer } from "./scope";
import { prisma } from "./db";
import { dayjs } from "./format";
import { canReadShared } from "./modules";
import type { EditionOpt, TaskView } from "@/components/tasks/task-list";

const toView = (t: { id: string; label: string; dueDate: Date | null; done: boolean; listId: string | null; requestId: string | null; list: { id: string; name: string; color: string | null } | null; edition: { id: string; year: number; project: { name: string } } | null; action: { id: string; name: string } | null; slots: { id: string; startAt: Date; endAt: Date; allDay: boolean }[] }): TaskView => ({
  id: t.id, label: t.label, dueDate: t.dueDate ? dayjs(t.dueDate).format("YYYY-MM-DD") : null, done: t.done, listId: t.listId, requestId: t.requestId, list: t.list ? { id: t.list.id, name: t.list.name, color: t.list.color } : null,
  edition: t.edition ? { id: t.edition.id, name: t.edition.project.name, year: t.edition.year } : null,
  action: t.action ? { id: t.action.id, name: t.action.name } : null,
  slots: t.slots.map((s) => ({ id: s.id, startAt: s.startAt.toISOString(), endAt: s.endAt.toISOString(), allDay: s.allDay })),
});

const include = { edition: { include: { project: true } }, action: true, list: { select: { id: true, name: true, color: true } }, slots: { orderBy: { startAt: "asc" as const } } };

// Tâches de la personne connectée, prêtes pour le client (dates en chaînes). Les terminées de plus de 14 jours disparaissent.
export async function loadMyTasks(personId: string, opts?: { editionId?: string }): Promise<TaskView[]> {
  const rows = await prisma.task.findMany({
    where: { personId, ...(opts?.editionId ? { editionId: opts.editionId } : {}), OR: [{ done: false }, { doneAt: { gte: dayjs().subtract(14, "day").toDate() } }] },
    include,
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toView);
}

export type ListView = { id: string; name: string; visibility: string; color: string | null; edition: { id: string; name: string; year: number } | null; owner: { id: string; name: string } };

// Mes listes, dans l'ordre.
export async function loadMyLists(personId: string): Promise<ListView[]> {
  const rows = await prisma.taskList.findMany({ where: { personId }, include: { edition: { include: { project: true } }, person: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  return rows.map((l) => ({ id: l.id, name: l.name, visibility: l.visibility, color: l.color, edition: l.edition ? { id: l.edition.id, name: l.edition.project.name, year: l.edition.year } : null, owner: { id: l.person.id, name: l.person.name } }));
}

// Listes que d'autres ont partagées avec moi (visibilité pole_lead / pole / all), avec leurs tâches en cours : lecture seule.
export async function loadSharedLists(me: Viewer): Promise<{ list: ListView; tasks: TaskView[] }[]> {
  const rows = await prisma.taskList.findMany({
    where: { personId: { not: me.id }, visibility: { not: "private" }, person: { active: true } },
    include: { edition: { include: { project: true } }, person: true, tasks: { where: { OR: [{ done: false }, { doneAt: { gte: dayjs().subtract(14, "day").toDate() } }] }, include, orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ person: { order: "asc" } }, { order: "asc" }],
  });
  return rows
    .filter((l) => canReadShared(me, l.person, l.visibility))
    .map((l) => ({ list: { id: l.id, name: l.name, visibility: l.visibility, color: l.color, edition: l.edition ? { id: l.edition.id, name: l.edition.project.name, year: l.edition.year } : null, owner: { id: l.person.id, name: l.person.name } }, tasks: l.tasks.map(toView) }));
}

// Éditions proposables dans la saisie (« @ ») : les plus pertinentes pour la personne d'abord (je pilote, je contribue, mon pôle…).
export async function loadEditionOpts(me: Viewer, settings: { envelopeAlertPercent: number; deliverableAlertDays: number }): Promise<EditionOpt[]> {
  const { loadPortfolio } = await import("./queries");
  const { byRelevance } = await import("./scope");
  const portfolio = await loadPortfolio(settings, { statuses: ["in_progress", "validated"] });
  return byRelevance(me, portfolio, (e) => ({ project: e.project, teamIds: e.team.map((t) => t.personId), ownerIds: e.actions.map((a) => a.ownerId ?? "") }), (a, b) => a.project.name.localeCompare(b.project.name, "fr") || a.year - b.year)
    .map((e) => ({ id: e.id, name: e.project.name, year: e.year, actions: e.actions.filter((a) => a.state !== "done").map((a) => ({ id: a.id, name: a.name })) }));
}


// Fournisseurs de la base, pour le champ avec recherche du formulaire de validation.
export async function loadSuppliers(): Promise<{ id: string; name: string; email: string | null }[]> {
  return prisma.supplier.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
}

// Éditions proposables pour une validation depuis Demandes : les mêmes que pour une tâche, avec le circuit (pilote, responsable, direction) de chacune.
export async function loadEditionChoices(me: Viewer, settings: { envelopeAlertPercent: number; deliverableAlertDays: number }) {
  const opts = await loadEditionOpts(me, settings);
  const [eds, people] = await Promise.all([
    prisma.edition.findMany({ where: { id: { in: opts.map((o) => o.id) } }, select: { id: true, project: { select: { pilotId: true, poleId: true, pilot: { select: { name: true } }, guarantor: { select: { name: true } } } } } }),
    prisma.person.findMany({ where: { active: true }, select: { name: true, role: true, poleId: true } }),
  ]);
  const dir = people.find((p) => p.role === "director")?.name ?? null;
  return opts.map((o) => {
    const e = eds.find((x) => x.id === o.id)!;
    const lead = e.project.guarantor?.name ?? people.find((p) => p.role === "pole_lead" && p.poleId === e.project.poleId)?.name ?? null;
    const isPilot = e.project.pilotId === me.id;
    return { ...o, recipients: { 1: isPilot ? (lead ?? dir) : e.project.pilot.name, 2: lead ?? dir, 3: dir } };
  });
}
