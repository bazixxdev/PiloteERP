"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { FIELDS, coerce, type Model } from "@/lib/fields";
import { canAdmin, canEditActions, canEditFunding, canWriteLayer } from "@/lib/rights";
import { projectPoleIds } from "@/lib/scope";
import { allocationCheck } from "@/lib/conventions";
import { isLocked } from "@/lib/lock";

export type SaveResult = { ok: true } | { ok: false; error: string };

async function editionContext(editionId: string, personId: string) {
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: true } });
  if (!e) throw new Error("Édition introuvable");
  return { edition: e, isPilot: e.project.pilotId === personId, isTeam: e.team.some((t) => t.personId === personId), poleIds: projectPoleIds(e.project) };
}

// Vérifie que la personne courante a le droit d'écrire ce champ (EF-K1, EF-B1b).
async function allowed(model: Model, id: string, field: string, personId: string, role: string, myPoleId: string | null): Promise<string | null> {
  const def = FIELDS[model][field];
  if (model === "edition") {
    const ctx = await editionContext(id, personId);
    const layer = def.layer ?? "proposal";
    if (field === "status" || field === "decisionDate" || field === "conditionalStart") {
      return role === "director" || role === "raf" ? null : "Seules la direction et la RAF changent le statut.";
    }
    // Fiche validée : les couches 1 à 3 ne se modifient plus en direct, seulement par proposition acceptée (retour du 14/09).
    if (isLocked(ctx.edition) && ["strategic", "means", "proposal"].includes(layer)) return "Fiche validée : proposez une modification, elle sera acceptée par le pilote ou la direction et tracée.";
    return canWriteLayer(role, layer, ctx.isPilot, ctx.isTeam, (myPoleId !== null && ctx.poleIds.includes(myPoleId))) ? null : "Vous n'avez pas le droit d'écrire cette couche.";
  }
  if (model === "action") {
    const a = await prisma.action.findUnique({ where: { id } });
    if (!a) return "Action introuvable";
    const ctx = await editionContext(a.editionId, personId);
    const own = a.ownerId === personId;
    return canEditActions(role, ctx.isPilot, ctx.isTeam, (myPoleId !== null && ctx.poleIds.includes(myPoleId))) || own ? null : "Vous ne pouvez pas modifier cette action.";
  }
  if (model === "call") return canEditFunding(role) || role === "pole_lead" ? null : "Un appel à projets se modifie par la RAF, la direction ou un responsable de pôle.";
  if (model === "fundingLine" || model === "deliverable" || model === "payment" || model === "convention" || model === "funder" || model === "funderContact") return canEditFunding(role) ? null : "Seule la RAF (ou la direction) modifie les financements et les financeurs.";
  if (model === "expense") return canEditFunding(role) ? null : "Seule la RAF (ou la direction) met à jour les dépenses.";
  if (model === "indicator") {
    const ind = await prisma.indicator.findUnique({ where: { id } });
    if (!ind) return "Indicateur introuvable";
    const ctx = await editionContext(ind.editionId, personId);
    return canWriteLayer(role, "year", ctx.isPilot, ctx.isTeam, (myPoleId !== null && ctx.poleIds.includes(myPoleId))) ? null : "Vous ne pouvez pas modifier ces indicateurs.";
  }
  if (model === "editionPersonDays") {
    if (role === "raf" || role === "director" || role === "pole_lead") return null;
    if (field === "plannedDays") {
      const d = await prisma.editionPersonDays.findUnique({ where: { id } });
      if (d) { const ctx = await editionContext(d.editionId, personId); if (ctx.isPilot) return null; }
      return "La charge planifiée est proposée par le pilote et ajustée par la RAF ou le responsable de pôle.";
    }
    return "Les jours conventionnés sont saisis par la RAF et les responsables de pôle.";
  }
  if (model === "docLink") {
    const d = await prisma.docLink.findUnique({ where: { id } });
    if (!d) return "Lien introuvable";
    const ctx = await editionContext(d.editionId, personId);
    return canWriteLayer(role, "year", ctx.isPilot, ctx.isTeam, (myPoleId !== null && ctx.poleIds.includes(myPoleId))) ? null : "Vous ne pouvez pas modifier ce lien.";
  }
  return canAdmin(role) ? null : "Réservé à l'administration (direction, RAF).";
}

export async function saveField(model: Model, id: string, field: string, raw: unknown, revalidate?: string): Promise<SaveResult> {
  try {
    const def = FIELDS[model]?.[field];
    if (!def) return { ok: false, error: `Champ non modifiable : ${model}.${field}` };
    const me = await getCurrentPerson();
    const denied = await allowed(model, id, field, me.id, me.role, me.poleId);
    if (denied) return { ok: false, error: denied };
    const value = coerce(def.type, raw);

    if (model === "edition") {
      const before = await prisma.edition.findUnique({ where: { id } });
      const prev = before ? (before as Record<string, unknown>)[field] : null;
      await prisma.edition.update({ where: { id }, data: { [field]: value } });
      if (String(prev ?? "") !== String(value ?? "")) {
        await prisma.changeLog.create({
          data: { editionId: id, field, before: prev == null ? null : String(prev instanceof Date ? prev.toISOString() : prev).slice(0, 500), after: value == null ? null : String(value instanceof Date ? value.toISOString() : value).slice(0, 500), authorId: me.id },
        });
      }
    } else if (model === "fundingLine" && (field === "amountGranted" || field === "conventionId")) {
      // Affectation d'une convention partagée : la somme des montants obtenus ne dépasse pas le notifié.
      const line = await prisma.fundingLine.findUnique({ where: { id } });
      if (!line) return { ok: false, error: "Ligne introuvable" };
      const conventionId = field === "conventionId" ? (value as string | null) : line.conventionId;
      if (conventionId) {
        const conv = await prisma.convention.findUnique({ where: { id: conventionId }, include: { lines: true } });
        if (!conv) return { ok: false, error: "Convention introuvable" };
        if (conv.funderId !== line.funderId) return { ok: false, error: "Cette convention est celle d'un autre financeur." };
        const granted = field === "amountGranted" ? (value as number | null) : line.amountGranted;
        const check = allocationCheck(conv, id, granted);
        if (!check.ok) return check;
      }
      await prisma.fundingLine.update({ where: { id }, data: { [field]: value } });
    } else if (model === "deliverable" && field === "done") {
      await prisma.deliverable.update({ where: { id }, data: { done: value as boolean, doneAt: value ? new Date() : null } });
    } else if (model === "person" && field === "active" && value === false) {
      // Garde-fous : on ne se désactive pas soi-même, et il reste toujours une direction active.
      if (id === me.id) return { ok: false, error: "Vous ne pouvez pas vous désactiver vous-même." };
      const target = await prisma.person.findUnique({ where: { id } });
      if (target?.role === "director" && (await prisma.person.count({ where: { role: "director", active: true, id: { not: id } } })) === 0) return { ok: false, error: "Il doit rester au moins une personne active avec le rôle Direction." };
      // Désactiver = plus d'accès : les sessions ouvertes du compte tombent tout de suite (lot F).
      await prisma.person.update({ where: { id }, data: { active: false } });
      if (target?.userId) await prisma.session.deleteMany({ where: { userId: target.userId } });
    } else if (model === "person" && field === "email") {
      // L'adresse est aussi l'identifiant de connexion : on la normalise et on la propage au compte.
      const email = value ? String(value).trim().toLowerCase() : null;
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Adresse e-mail invalide." };
      const target = await prisma.person.findUnique({ where: { id } });
      if (email && (await prisma.person.findFirst({ where: { email, id: { not: id } } }))) return { ok: false, error: "Cette adresse est déjà celle d'une autre personne." };
      if (email && target?.userId && (await prisma.user.findFirst({ where: { email, id: { not: target.userId } } }))) return { ok: false, error: "Cette adresse est déjà celle d'un autre compte." };
      await prisma.person.update({ where: { id }, data: { email } });
      if (target?.userId && email) await prisma.user.update({ where: { id: target.userId }, data: { email } });
    } else if (model === "settings") {
      await prisma.settings.update({ where: { id: 1 }, data: { [field]: value } });
    } else {
      // Les autres modèles : mise à jour directe.
      const delegate = (prisma as unknown as Record<string, { update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> }>)[model];
      await delegate.update({ where: { id }, data: { [field]: value } });
    }

    revalidatePath(revalidate ?? "/", revalidate ? undefined : "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
