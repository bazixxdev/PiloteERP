"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { dayjs } from "@/lib/format";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Tâches personnelles : toujours celles de la personne connectée. Aucune action ne prend de personne en paramètre.
async function mine(taskId: string) {
  const me = await getCurrentPerson();
  const t = await prisma.task.findUnique({ where: { id: taskId } });
  if (!t || t.personId !== me.id) return null;
  return t;
}

const day = (d: string | null | undefined) => (d ? dayjs(d, "YYYY-MM-DD").startOf("day").toDate() : null);

export async function addTask(input: { label: string; dueDate?: string | null; editionId?: string | null; actionId?: string | null }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Écrivez la tâche." };
  const t = await prisma.task.create({ data: { personId: me.id, label, dueDate: day(input.dueDate), editionId: input.editionId || null, actionId: input.actionId || null } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: t.id } };
}

export async function updateTask(id: string, patch: { label?: string; dueDate?: string | null; done?: boolean }): Promise<Result> {
  const t = await mine(id);
  if (!t) return { ok: false, error: "Tâche introuvable." };
  await prisma.task.update({
    where: { id },
    data: {
      ...(patch.label !== undefined ? { label: patch.label.trim() || t.label } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: day(patch.dueDate) } : {}),
      ...(patch.done !== undefined ? { done: patch.done, doneAt: patch.done ? new Date() : null } : {}),
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
