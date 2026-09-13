"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canLockMonths } from "@/lib/rights";
import { dayjs, monthLabel } from "@/lib/format";
import { weekKey } from "@/lib/time";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Relance de temps (EF-D5) : une notification datée pour la personne, visible par la RAF dans la clôture. Pas de mail dans le prototype.
export async function remindTime(personId: string, month: string): Promise<Result<{ at: Date }>> {
  const me = await getCurrentPerson();
  if (!canLockMonths(me.role)) return { ok: false, error: "Seule la RAF (ou la direction) relance." };
  const n = await prisma.notification.create({
    data: { personId, senderId: me.id, kind: "time_reminder", title: `Temps de ${monthLabel(month).toLowerCase()} à compléter`, body: `${me.name} vous demande de compléter et déclarer vos semaines de ${monthLabel(month).toLowerCase()} avant la clôture.`, link: `/temps?semaine=${weekKey(dayjs(month + "-01"))}` },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { at: n.createdAt } };
}

export async function markNotificationsRead(ids?: string[]): Promise<Result> {
  const me = await getCurrentPerson();
  await prisma.notification.updateMany({ where: { personId: me.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}
