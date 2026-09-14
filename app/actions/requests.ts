"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { dayjs } from "@/lib/format";
import { isForMe, REQUEST_KINDS, REQUEST_STATUSES, kindLabel } from "@/lib/requests";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Nouvelle demande : type, destinataire (une personne ou un pôle), pour quand, objet ; l'achat / devis passe par la validation.
export async function addRequest(input: { kind: string; title: string; body?: string; assigneeId?: string | null; poleId?: string | null; editionId?: string | null; dueDate?: string | null }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Dites ce que vous demandez." };
  if (!REQUEST_KINDS.some((k) => k.value === input.kind)) return { ok: false, error: "Type inconnu." };
  if (!input.assigneeId && !input.poleId) return { ok: false, error: "À qui ? Une personne ou un pôle." };
  const dueDate = input.dueDate ? dayjs(input.dueDate, "YYYY-MM-DD", true) : null;
  if (dueDate && !dueDate.isValid()) return { ok: false, error: "Date invalide." };
  const r = await prisma.request.create({ data: { kind: input.kind, title, body: input.body?.trim() || null, requesterId: me.id, assigneeId: input.assigneeId || null, poleId: input.assigneeId ? null : input.poleId || null, editionId: input.editionId || null, dueDate: dueDate ? dueDate.startOf("day").toDate() : null }, include: { pole: true } });
  // Le destinataire est prévenu ; pour un pôle, son responsable.
  const targets = new Set<string>();
  if (r.assigneeId) targets.add(r.assigneeId);
  else if (r.pole?.leadId) targets.add(r.pole.leadId);
  targets.delete(me.id);
  await prisma.notification.createMany({ data: [...targets].map((personId) => ({ personId, senderId: me.id, kind: "info", title: `Demande · ${kindLabel(r.kind)} : ${title}`, body: `${me.name}${dueDate ? ` · pour le ${dueDate.format("D MMM")}` : ""}`, link: "/demandes" })) });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: r.id } };
}

// Le destinataire (ou son pôle, ou la direction) fait avancer la demande ; le demandeur peut la retirer.
export async function setRequestStatus(id: string, status: string, answer?: string): Promise<Result> {
  const me = await getCurrentPerson();
  const r = await prisma.request.findUnique({ where: { id } });
  if (!r) return { ok: false, error: "Demande introuvable." };
  if (!REQUEST_STATUSES.some((s) => s.value === status)) return { ok: false, error: "État inconnu." };
  const canTreat = isForMe(me, r) || me.role === "director" || me.role === "raf" || (r.poleId && me.role === "pole_lead" && me.poleId === r.poleId);
  if (!canTreat && !(r.requesterId === me.id && status === "declined")) return { ok: false, error: "Seul le destinataire fait avancer cette demande (le demandeur peut la retirer)." };
  await prisma.request.update({ where: { id }, data: { status, answer: answer?.trim() || r.answer, doneAt: status === "done" || status === "declined" ? new Date() : null, ...(status !== "open" && !r.assigneeId ? { assigneeId: me.id } : {}) } });
  if (r.requesterId !== me.id && (status === "done" || status === "declined")) {
    await prisma.notification.create({ data: { personId: r.requesterId, senderId: me.id, kind: "info", title: `Demande ${status === "done" ? "faite" : "déclinée"} : ${r.title}`, body: answer?.trim() || null, link: "/demandes" } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function assignRequest(id: string, assigneeId: string | null): Promise<Result> {
  const me = await getCurrentPerson();
  const r = await prisma.request.findUnique({ where: { id } });
  if (!r) return { ok: false, error: "Demande introuvable." };
  const canTreat = isForMe(me, r) || me.role === "director" || (r.poleId && me.role === "pole_lead" && me.poleId === r.poleId) || r.requesterId === me.id;
  if (!canTreat) return { ok: false, error: "Vous ne pouvez pas réattribuer cette demande." };
  await prisma.request.update({ where: { id }, data: { assigneeId } });
  if (assigneeId && assigneeId !== me.id) await prisma.notification.create({ data: { personId: assigneeId, senderId: me.id, kind: "info", title: `Demande confiée : ${r.title}`, link: "/demandes" } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Une tâche naît d'une demande : dans ma liste, avec l'échéance et l'édition de la demande.
export async function taskFromRequest(id: string): Promise<Result<{ taskId: string }>> {
  const me = await getCurrentPerson();
  const r = await prisma.request.findUnique({ where: { id }, include: { requester: true } });
  if (!r) return { ok: false, error: "Demande introuvable." };
  const t = await prisma.task.create({ data: { personId: me.id, label: `${r.title} (demande de ${r.requester.name})`, dueDate: r.dueDate, editionId: r.editionId } });
  if (r.status === "open") await prisma.request.update({ where: { id }, data: { status: "doing", assigneeId: r.assigneeId ?? me.id } });
  revalidatePath("/", "layout");
  return { ok: true, data: { taskId: t.id } };
}
