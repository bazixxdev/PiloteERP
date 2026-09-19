"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { NOTE_COLORS } from "@/lib/notes";
import { dayjs } from "@/lib/format";
import { V, cap, au, ce } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Tâches personnelles : toujours celles de la personne connectée. Aucune action ne prend de personne en paramètre.
async function mine(taskId: string) {
  const me = await getCurrentPerson();
  const t = await prisma.task.findUnique({ where: { id: taskId } });
  if (!t || t.personId !== me.id) return null;
  return t;
}

const day = (d: string | null | undefined) => (d ? dayjs(d, "YYYY-MM-DD").startOf("day").toDate() : null);

export async function addTask(input: { label: string; dueDate?: string | null; editionId?: string | null; actionId?: string | null; listId?: string | null; conventionId?: string | null }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Écrivez la tâche." };
  let editionId = input.editionId || null;
  if (input.listId) {
    const l = await prisma.taskList.findUnique({ where: { id: input.listId } });
    if (!l || l.personId !== me.id) return { ok: false, error: "Liste introuvable." };
    // Une liste rattachée à une édition rattache ses tâches, sauf rattachement explicite.
    if (!editionId && l.editionId) editionId = l.editionId;
  }
  if (input.conventionId && !(await prisma.convention.findUnique({ where: { id: input.conventionId } }))) return { ok: false, error: "Dossier introuvable." };
  const t = await prisma.task.create({ data: { personId: me.id, label, dueDate: day(input.dueDate), editionId, actionId: input.actionId || null, listId: input.listId || null, conventionId: input.conventionId || null } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: t.id } };
}

export async function updateTask(id: string, patch: { label?: string; description?: string | null; dueDate?: string | null; done?: boolean; editionId?: string | null; actionId?: string | null; listId?: string | null }): Promise<Result> {
  const t = await mine(id);
  if (!t) return { ok: false, error: "Tâche introuvable." };
  if (patch.listId) {
    const l = await prisma.taskList.findUnique({ where: { id: patch.listId } });
    if (!l || l.personId !== t.personId) return { ok: false, error: "Liste introuvable." };
  }
  if (patch.editionId) {
    const e = await prisma.edition.findUnique({ where: { id: patch.editionId } });
    if (!e) return { ok: false, error: `${cap(V.edition)} introuvable.` };
  }
  if (patch.actionId) {
    const a = await prisma.action.findUnique({ where: { id: patch.actionId } });
    const editionId = patch.editionId !== undefined ? patch.editionId : t.editionId;
    if (!a || a.editionId !== editionId) return { ok: false, error: `${cap(ce(V.action))} n'appartient pas ${au(V.edition)} choisie.` };
  }
  // Tâche née d'une demande : la cocher fait la demande (le demandeur est prévenu), la décocher la rouvre.
  if (patch.done !== undefined && t.requestId) {
    const r = await prisma.request.findUnique({ where: { id: t.requestId }, include: { requester: true } });
    if (r && (patch.done ? r.status !== "done" : r.status === "done")) {
      await prisma.request.update({ where: { id: r.id }, data: { status: patch.done ? "done" : "doing", doneAt: patch.done ? new Date() : null } });
      if (patch.done && r.requesterId !== t.personId) await prisma.notification.create({ data: { personId: r.requesterId, senderId: t.personId, kind: "info", title: `Demande faite : ${r.title}`, link: "/demandes" } });
    }
  }
  await prisma.task.update({
    where: { id },
    data: {
      ...(patch.label !== undefined ? { label: patch.label.trim() || t.label } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: day(patch.dueDate) } : {}),
      ...(patch.done !== undefined ? { done: patch.done, doneAt: patch.done ? new Date() : null } : {}),
      ...(patch.listId !== undefined ? { listId: patch.listId || null } : {}),
      // Changer d'édition détache l'action : elle appartenait à l'ancienne.
      ...(patch.editionId !== undefined ? { editionId: patch.editionId || null, actionId: patch.actionId !== undefined ? patch.actionId || null : null } : patch.actionId !== undefined ? { actionId: patch.actionId || null } : {}),
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTask(id: string): Promise<Result> {
  const t = await mine(id);
  if (!t) return { ok: false, error: "Tâche introuvable." };
  await prisma.task.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Créneau de travail : une journée entière, ou une date avec heure de début et de fin (« 23/09/2026, 9 h – 11 h »), en heure locale du poste.
export async function addSlot(taskId: string, input: { date: string; start?: string | null; end?: string | null; allDay?: boolean }): Promise<Result<{ id: string }>> {
  const t = await mine(taskId);
  if (!t) return { ok: false, error: "Tâche introuvable." };
  const d = dayjs(input.date, "YYYY-MM-DD", true);
  if (!d.isValid()) return { ok: false, error: "Date invalide." };
  let startAt = d.startOf("day");
  let endAt = d.add(1, "day").startOf("day");
  const allDay = Boolean(input.allDay) || !input.start || !input.end;
  if (!allDay) {
    startAt = dayjs(`${input.date} ${input.start}`, "YYYY-MM-DD HH:mm", true);
    endAt = dayjs(`${input.date} ${input.end}`, "YYYY-MM-DD HH:mm", true);
    if (!startAt.isValid() || !endAt.isValid()) return { ok: false, error: "Heure invalide." };
    if (!endAt.isAfter(startAt)) return { ok: false, error: "La fin doit suivre le début." };
    if (endAt.diff(startAt, "hour", true) > 12) return { ok: false, error: "Un créneau ne dépasse pas 12 heures : découpez-le, ou posez la journée entière." };
  }
  const s = await prisma.workSlot.create({ data: { taskId, startAt: startAt.toDate(), endAt: endAt.toDate(), allDay } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: s.id } };
}

export async function deleteSlot(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const s = await prisma.workSlot.findUnique({ where: { id }, include: { task: true } });
  if (!s || s.task.personId !== me.id) return { ok: false, error: "Créneau introuvable." };
  await prisma.workSlot.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Listes de tâches : catégories avec ou sans projet ; visibilité au choix de l'auteur ; seul l'auteur écrit.
const VIS = ["private", "pole_lead", "pole", "all"];

export async function addList(input: { name: string; visibility?: string; editionId?: string | null; color?: string | null }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Donnez un nom à la liste." };
  if (input.visibility && !VIS.includes(input.visibility)) return { ok: false, error: "Visibilité inconnue." };
  const count = await prisma.taskList.count({ where: { personId: me.id } });
  if (input.color && !NOTE_COLORS.some((c) => c.value === input.color)) return { ok: false, error: "Couleur inconnue." };
  const l = await prisma.taskList.create({ data: { personId: me.id, name, visibility: input.visibility ?? "private", editionId: input.editionId || null, color: input.color || null, order: count } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: l.id } };
}

export async function updateList(id: string, patch: { name?: string; visibility?: string; editionId?: string | null; color?: string | null }): Promise<Result> {
  const me = await getCurrentPerson();
  const l = await prisma.taskList.findUnique({ where: { id } });
  if (!l || l.personId !== me.id) return { ok: false, error: "Liste introuvable." };
  if (patch.visibility && !VIS.includes(patch.visibility)) return { ok: false, error: "Visibilité inconnue." };
  if (patch.color && !NOTE_COLORS.some((c) => c.value === patch.color)) return { ok: false, error: "Couleur inconnue." };
  await prisma.taskList.update({ where: { id }, data: { ...(patch.name !== undefined ? { name: patch.name.trim() || l.name } : {}), ...(patch.visibility ? { visibility: patch.visibility } : {}), ...(patch.editionId !== undefined ? { editionId: patch.editionId || null } : {}), ...(patch.color !== undefined ? { color: patch.color || null } : {}) } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Supprimer une liste ne supprime pas ses tâches : elles reviennent dans « À trier ».
export async function deleteList(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const l = await prisma.taskList.findUnique({ where: { id } });
  if (!l || l.personId !== me.id) return { ok: false, error: "Liste introuvable." };
  await prisma.taskList.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// « Reporter à aujourd'hui » (vue À faire, groupe En retard) : toutes mes tâches en retard passent à la date du jour.
export async function postponeLate(ids: string[]): Promise<Result<{ moved: number }>> {
  const me = await getCurrentPerson();
  const today = dayjs().startOf("day").toDate();
  const r = await prisma.task.updateMany({ where: { id: { in: ids }, personId: me.id, done: false, dueDate: { lt: today } }, data: { dueDate: today } });
  revalidatePath("/", "layout");
  return { ok: true, data: { moved: r.count } };
}
