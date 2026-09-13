import { prisma } from "./db";
import { dayjs } from "./format";
import type { TaskView } from "@/components/tasks/task-list";

// Tâches de la personne connectée, prêtes pour le client (dates en chaînes). Les terminées de plus de 14 jours disparaissent.
export async function loadMyTasks(personId: string, opts?: { editionId?: string }): Promise<TaskView[]> {
  const rows = await prisma.task.findMany({
    where: { personId, ...(opts?.editionId ? { editionId: opts.editionId } : {}), OR: [{ done: false }, { doneAt: { gte: dayjs().subtract(14, "day").toDate() } }] },
    include: { edition: { include: { project: true } }, action: true, slots: { orderBy: { startAt: "asc" } } },
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((t) => ({
    id: t.id, label: t.label, dueDate: t.dueDate ? dayjs(t.dueDate).format("YYYY-MM-DD") : null, done: t.done,
    edition: t.edition ? { id: t.edition.id, name: t.edition.project.name, year: t.edition.year } : null,
    action: t.action ? { id: t.action.id, name: t.action.name } : null,
    slots: t.slots.map((s) => ({ id: s.id, startAt: s.startAt.toISOString(), endAt: s.endAt.toISOString(), allDay: s.allDay })),
  }));
}
