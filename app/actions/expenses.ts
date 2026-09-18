"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canActAsPilot, canEditFunding, canTrackExpenses } from "@/lib/rights";
import { fmtEuro } from "@/lib/format";
import { V, cap, le } from "@/lib/vocab";

type Result = { ok: true } | { ok: false; error: string };

// Circuit facture (retour du 14/09) : la RAF (ou l'assistante) marque « reçue » puis « payée » ; le pilote apprend chaque étape et
// dit si la prestation est conforme — sans bloquer le paiement. Pas de fichier facture dans l'outil.
async function load(id: string) {
  return prisma.expense.findUnique({ where: { id }, include: { edition: { include: { project: true, team: true } } } });
}

export async function markInvoice(id: string, step: "received" | "paid", undo = false): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me) && !canTrackExpenses(me)) return { ok: false, error: `${cap(le(V.raf))}, ${le(V.direction)} ou l'assistante suivent les factures.` };
  const x = await load(id);
  if (!x) return { ok: false, error: "Dépense introuvable." };
  if (step === "paid" && !x.invoiceReceivedAt && !undo) return { ok: false, error: "Marquez d'abord la facture reçue." };
  await prisma.expense.update({ where: { id }, data: step === "received" ? { invoiceReceivedAt: undo ? null : new Date(), ...(undo ? { paidAt: null } : {}) } : { paidAt: undo ? null : new Date() } });
  const pilotId = x.edition.project.pilotId;
  if (!undo && pilotId !== me.id) {
    await prisma.notification.create({ data: { personId: pilotId, senderId: me.id, kind: "info",
      title: step === "received" ? `Facture reçue · ${x.label}${x.supplier ? ` (${x.supplier})` : ""}` : `Facture payée · ${x.label}`,
      body: step === "received" ? (x.serviceDoneAt ? `${fmtEuro(x.spent || x.committed)} · service fait déjà confirmé.` : `${fmtEuro(x.spent || x.committed)} · la prestation est-elle conforme ? Dites-le dans l'onglet Budget (sans bloquer le paiement).`) : `${fmtEuro(x.spent || x.committed)} réglés par ${le(V.org)}.`,
      link: `/edition/${x.editionId}?onglet=budget` } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Service fait : le pilote ou l'équipe (ou la direction). Informatif : la RAF paie même sans réponse.
export async function markServiceDone(id: string, done: boolean): Promise<Result> {
  const me = await getCurrentPerson();
  const x = await load(id);
  if (!x) return { ok: false, error: "Dépense introuvable." };
  const allowed = canActAsPilot(me, x.edition.project.pilotId === me.id, x.edition.team.some((t) => t.personId === me.id));
  if (!allowed) return { ok: false, error: `${cap(le(V.pilote))} ou l'équipe confirme le service fait.` };
  await prisma.expense.update({ where: { id }, data: { serviceDoneAt: done ? new Date() : null, serviceDoneById: done ? me.id : null } });
  revalidatePath("/", "layout");
  return { ok: true };
}
