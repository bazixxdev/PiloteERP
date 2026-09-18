"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
import { V, cap, de, pl } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export type DepartureInput = {
  personId: string;
  leftAt: string | null; // date de départ posée sur la fiche
  pilotTo: string | null; // reprend les projets pilotés
  guarantorTo: string | null; // reprend les garanties de projet
  poleLeadTo: string | null; // reprend la responsabilité de pôle
  sponsorTo: string | null; // reprend le parrainage des éditions
  actionsTo: string | null; // reprend les actions non faites
  requestsTo: string | null; // reprend les demandes ouvertes
  leaveTeams: boolean; // retirer des équipes des éditions en cours
  deactivate: boolean; // désactiver dans la foulée (accès coupé, sessions fermées)
};

// « Préparer un départ » (lot E1, EF-K3) : tout ce que la personne porte passe à quelqu'un d'autre en une fois, puis la fiche
// est datée et, si on le demande, désactivée. Rien n'est effacé : l'historique (temps, validations, remarques) reste à son nom.
export async function prepareDeparture(input: DepartureInput): Promise<Result<{ moved: number }>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: `Réservé à l'administration (${V.direction.one}, ${V.raf.one}).` };
  const p = await prisma.person.findUnique({ where: { id: input.personId } });
  if (!p) return { ok: false, error: "Personne introuvable." };
  if (input.deactivate && p.id === me.id) return { ok: false, error: "Vous ne pouvez pas vous désactiver vous-même." };
  if (input.deactivate && p.role === "director" && p.active && (await prisma.person.count({ where: { role: "director", active: true, id: { not: p.id } } })) === 0) return { ok: false, error: `Il doit rester au moins une personne active avec le rôle ${cap(V.direction)}.` };
  const targets = [input.pilotTo, input.guarantorTo, input.poleLeadTo, input.sponsorTo, input.actionsTo, input.requestsTo].filter((x): x is string => Boolean(x));
  if (targets.includes(p.id)) return { ok: false, error: "Le repreneur ne peut pas être la personne qui part." };
  const found = await prisma.person.findMany({ where: { id: { in: targets }, active: true }, select: { id: true } });
  if (found.length !== new Set(targets).size) return { ok: false, error: "Un repreneur est introuvable ou désactivé." };
  const leftAt = input.leftAt ? new Date(input.leftAt) : null;
  if (input.leftAt && Number.isNaN(leftAt!.getTime())) return { ok: false, error: "Date de départ invalide." };

  const LIVE = ["in_progress", "validated", "proposed", "rechallenged"];
  let moved = 0;
  await prisma.$transaction(async (tx) => {
    if (input.pilotTo) moved += (await tx.project.updateMany({ where: { pilotId: p.id }, data: { pilotId: input.pilotTo } })).count;
    if (input.guarantorTo) moved += (await tx.project.updateMany({ where: { guarantorId: p.id }, data: { guarantorId: input.guarantorTo } })).count;
    if (input.poleLeadTo) moved += (await tx.pole.updateMany({ where: { leadId: p.id }, data: { leadId: input.poleLeadTo } })).count;
    if (input.sponsorTo) moved += (await tx.edition.updateMany({ where: { sponsorId: p.id, status: { in: LIVE } }, data: { sponsorId: input.sponsorTo } })).count;
    if (input.actionsTo) moved += (await tx.action.updateMany({ where: { ownerId: p.id, state: { not: "done" }, edition: { status: { in: LIVE } } }, data: { ownerId: input.actionsTo } })).count;
    if (input.requestsTo) moved += (await tx.request.updateMany({ where: { assigneeId: p.id, status: { in: ["open", "doing"] } }, data: { assigneeId: input.requestsTo } })).count;
    if (input.leaveTeams) moved += (await tx.editionTeam.deleteMany({ where: { personId: p.id, edition: { status: { in: LIVE } } } })).count;
    await tx.person.update({ where: { id: p.id }, data: { ...(leftAt ? { leftAt } : {}), ...(input.deactivate ? { active: false } : {}) } });
    if (input.deactivate && p.userId) await tx.session.deleteMany({ where: { userId: p.userId } });
  });
  // Les repreneurs sont prévenus de ce qui leur arrive.
  const notify = async (to: string | null, what: string) => { if (to) await prisma.notification.create({ data: { personId: to, senderId: me.id, kind: "info", title: `Départ de ${p.name} : ${what} vous reviennent`, link: "/ma-semaine" } }); };
  await Promise.all([notify(input.pilotTo, "les projets pilotés"), notify(input.guarantorTo, "les garanties de projet"), notify(input.poleLeadTo, `la responsabilité ${de(V.pole)}`), notify(input.sponsorTo, `le parrainage des ${pl(V.edition)}`), notify(input.actionsTo, "les actions en cours"), notify(input.requestsTo, "les demandes ouvertes")]);
  revalidatePath("/", "layout");
  return { ok: true, data: { moved } };
}
