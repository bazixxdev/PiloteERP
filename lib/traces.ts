import { prisma } from "./db";
import { dayjs } from "./format";

// Aide à la saisie des temps (retour du 14/09) : ce que la personne a laissé comme traces dans l'outil pendant la semaine —
// tâches terminées, créneaux posés, notes prises, jalons tenus — regroupé par projet. Pas de durée : un rappel de ce sur quoi on a travaillé.
export type Trace = { projectId: string | null; projectName: string; editionId: string | null; items: string[] };

export async function loadWeekTraces(personId: string, weekStart: dayjs.Dayjs): Promise<Trace[]> {
  const from = weekStart.startOf("day").toDate();
  const to = weekStart.add(7, "day").startOf("day").toDate();
  const [doneTasks, slotTasks, notes, actions] = await Promise.all([
    prisma.task.findMany({ where: { personId, done: true, doneAt: { gte: from, lt: to } }, include: { edition: { include: { project: true } } } }),
    prisma.task.findMany({ where: { personId, slots: { some: { startAt: { gte: from, lt: to } } } }, include: { edition: { include: { project: true } }, slots: { where: { startAt: { gte: from, lt: to } } } } }),
    prisma.note.findMany({ where: { authorId: personId, date: { gte: from, lt: to } }, include: { edition: { include: { project: true } } } }),
    prisma.action.findMany({ where: { ownerId: personId, milestoneDate: { gte: from, lt: to } }, include: { edition: { include: { project: true } } } }),
  ]);
  const groups = new Map<string, Trace>();
  const add = (edition: { id: string; projectId: string; project: { name: string } } | null, item: string) => {
    const key = edition?.projectId ?? "—";
    const g = groups.get(key) ?? { projectId: edition?.projectId ?? null, projectName: edition?.project.name ?? "Sans projet", editionId: edition?.id ?? null, items: [] };
    if (!g.items.includes(item)) g.items.push(item);
    groups.set(key, g);
  };
  for (const t of doneTasks) add(t.edition, `Tâche faite · ${t.label}`);
  for (const t of slotTasks) { const h = t.slots.reduce((s, x) => s + (x.allDay ? 7 : dayjs(x.endAt).diff(dayjs(x.startAt), "hour", true)), 0); add(t.edition, `Créneau${t.slots.length > 1 ? "x" : ""} posé${t.slots.length > 1 ? "s" : ""} · ${t.label} (~${Math.round(h * 2) / 2} h)`); }
  for (const n of notes) add(n.edition, `Note · ${n.title}`);
  for (const a of actions) add(a.edition, `Jalon · ${a.name} (${dayjs(a.milestoneDate).format("ddd D")})`);
  return [...groups.values()].sort((a, b) => (a.projectId ? 0 : 1) - (b.projectId ? 0 : 1) || b.items.length - a.items.length);
}
