"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { FIELDS, coerce, type Model } from "@/lib/fields";
import { canAdmin, canEditActions, canEditCalls, canEditFunding, canManageEquipment, canManageMembers, canPlanLoad, canSetEditionStatus, canWriteLayer, type Actor } from "@/lib/rights";
import { projectPoleIds } from "@/lib/scope";
import { allocationCheck } from "@/lib/conventions";
import { callFieldInvariant } from "@/lib/calls";
import { isLocked } from "@/lib/lock";
import { V, cap, le, de, ce, seul } from "@/lib/vocab";
import { reportInternalError } from "@/lib/errors";

export type SaveResult = { ok: true } | { ok: false; code?: string; error: string };

async function editionContext(editionId: string, personId: string) {
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: true } });
  if (!e) throw new Error(`${cap(V.edition)} introuvable`);
  return { edition: e, isPilot: e.project.pilotId === personId, isTeam: e.team.some((t) => t.personId === personId), poleIds: projectPoleIds(e.project) };
}

// Vérifie que la personne courante a le droit d'écrire ce champ (EF-K1, EF-B1b).
async function allowed(model: Model, id: string, field: string, personId: string, me: Actor, myPoleId: string | null): Promise<string | null> {
  const def = FIELDS[model][field];
  if (model === "edition") {
    const ctx = await editionContext(id, personId);
    const layer = def.layer ?? "proposal";
    if (field === "status" || field === "decisionDate" || field === "conditionalStart") {
      return canSetEditionStatus(me) ? null : `${cap(le(V.direction))} et ${le(V.raf)} changent le statut.`;
    }
    // Fiche validée : les couches 1 à 3 ne se modifient plus en direct, seulement par proposition acceptée (retour du 14/09).
    if (isLocked(ctx.edition) && ["strategic", "means", "proposal"].includes(layer)) return `Fiche validée : proposez une modification, elle sera acceptée par ${le(V.pilote)} ou ${le(V.direction)} et tracée.`;
    return canWriteLayer(me, layer, ctx.isPilot, ctx.isTeam, (myPoleId !== null && ctx.poleIds.includes(myPoleId))) ? null : "Vous n'avez pas le droit d'écrire cette couche.";
  }
  if (model === "action") {
    const a = await prisma.action.findUnique({ where: { id } });
    if (!a) return `${cap(V.action)} introuvable`;
    const ctx = await editionContext(a.editionId, personId);
    const own = a.ownerId === personId;
    return canEditActions(me, ctx.isPilot, ctx.isTeam, (myPoleId !== null && ctx.poleIds.includes(myPoleId))) || own ? null : `Vous ne pouvez pas modifier ${ce(V.action)}.`;
  }
  if (model === "call") return canEditCalls(me) ? null : `Un appel à projets se modifie par ${le(V.raf)}, ${le(V.direction)} ou un responsable ${de(V.pole)}.`;
  // Les contacts (lot Contacts et listes) sont un annuaire commun : chacun les tient à jour.
  if (model === "contact") return null;
  if (model === "loan") {
    const l = await prisma.loan.findUnique({ where: { id } });
    if (!l) return "Prêt introuvable";
    return l.createdById === personId || l.personId === personId || canManageEquipment(me) ? null : `Ce prêt a été enregistré par quelqu'un d'autre ; l'inventaire (${V.direction.one}, ${V.raf.one}, assistant·e) peut le modifier.`;
  }
  if (model === "equipment") return canManageEquipment(me) ? null : `L'inventaire se tient par ${le(V.direction)}, ${le(V.raf)} ou l'assistant·e (droit « Tient l'inventaire du matériel »).`;
  if (model === "membership") return canManageMembers(me) ? null : `Les adhésions se tiennent par ${le(V.raf)} ou ${le(V.direction)} (droit « Gère les adhésions »).`;
  if (model === "fundingLine" || model === "deliverable" || model === "payment" || model === "convention" || model === "funder" || model === "organisation") return canEditFunding(me) ? null : `${cap(seul(V.raf))} (ou ${le(V.direction)}) modifie les financements et les financeurs.`;
  if (model === "expense") return canEditFunding(me) ? null : `${cap(seul(V.raf))} (ou ${le(V.direction)}) met à jour les dépenses.`;
  if (model === "indicator") {
    const ind = await prisma.indicator.findUnique({ where: { id } });
    if (!ind) return "Indicateur introuvable";
    const ctx = await editionContext(ind.editionId, personId);
    return canWriteLayer(me, "year", ctx.isPilot, ctx.isTeam, (myPoleId !== null && ctx.poleIds.includes(myPoleId))) ? null : "Vous ne pouvez pas modifier ces indicateurs.";
  }
  if (model === "editionPersonDays") {
    if (canPlanLoad(me)) return null;
    if (field === "plannedDays") {
      const d = await prisma.editionPersonDays.findUnique({ where: { id } });
      if (d) { const ctx = await editionContext(d.editionId, personId); if (ctx.isPilot) return null; }
      return `La charge planifiée est proposée par ${le(V.pilote)} et ajustée par ${le(V.raf)} ou le responsable ${de(V.pole)}.`;
    }
    return `Les jours conventionnés sont saisis par ${le(V.raf)} et les responsables ${de(V.pole)}.`;
  }
  if (model === "docLink") {
    const d = await prisma.docLink.findUnique({ where: { id } });
    if (!d) return "Lien introuvable";
    const ctx = await editionContext(d.editionId, personId);
    return canWriteLayer(me, "year", ctx.isPilot, ctx.isTeam, (myPoleId !== null && ctx.poleIds.includes(myPoleId))) ? null : "Vous ne pouvez pas modifier ce lien.";
  }
  // Chacun tient sa propre fonction et son téléphone (Mon compte) ; le reste de la fiche est à l'administration.
  if (model === "person" && id === personId && ["jobTitle", "phone"].includes(field)) return null;
  return canAdmin(me) ? null : `Réservé à l'administration (${V.direction.one}, ${V.raf.one}).`;
}

export async function saveField(model: Model, id: string, field: string, raw: unknown, revalidate?: string): Promise<SaveResult> {
  try {
    const def = FIELDS[model]?.[field];
    if (!def) return { ok: false, error: `Champ non modifiable : ${model}.${field}` };
    const me = await getCurrentPerson();
    const denied = await allowed(model, id, field, me.id, me, me.poleId);
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
      if (target?.role === "director" && (await prisma.person.count({ where: { role: "director", active: true, id: { not: id } } })) === 0) return { ok: false, error: `Il doit rester au moins une personne active avec le rôle ${cap(V.direction)}.` };
      // Désactiver = plus d'accès : les sessions ouvertes du compte tombent tout de suite (lot F).
      await prisma.person.update({ where: { id }, data: { active: false } });
      if (target?.userId) await prisma.session.deleteMany({ where: { userId: target.userId } });
    } else if (model === "person" && (field === "name" || field === "firstName" || field === "lastName")) {
      // Le nom affiché et le couple prénom / nom restent cohérents dans les deux sens : « Prénom Nom » se découpe au premier espace.
      const p = await prisma.person.findUnique({ where: { id } });
      if (!p) return { ok: false, error: "Personne introuvable." };
      const v = String(value ?? "").trim();
      let firstName = p.firstName, lastName = p.lastName;
      if (field === "name") { if (!v) return { ok: false, error: "Le nom est obligatoire." }; const i = v.indexOf(" "); firstName = i > 0 ? v.slice(0, i) : v; lastName = i > 0 ? v.slice(i + 1).trim() : ""; }
      else if (field === "firstName") firstName = v; else lastName = v;
      const name = `${firstName} ${lastName}`.trim();
      if (!name) return { ok: false, error: "Le nom est obligatoire." };
      await prisma.person.update({ where: { id }, data: { firstName, lastName, name } });
      if (p.userId) await prisma.user.update({ where: { id: p.userId }, data: { name } });
    } else if (model === "person" && field === "role") {
      // Même garde-fou qu'à la désactivation : il reste toujours une direction active (le rôle qui garde l'administration).
      const target = await prisma.person.findUnique({ where: { id } });
      if (target?.role === "director" && value !== "director" && target.active && (await prisma.person.count({ where: { role: "director", active: true, id: { not: id } } })) === 0) return { ok: false, error: `Il doit rester au moins une personne active avec le rôle ${cap(V.direction)}.` };
      if (!(await prisma.role.findUnique({ where: { code: String(value) } }))) return { ok: false, error: "Rôle inconnu." };
      await prisma.person.update({ where: { id }, data: { role: String(value) } });
    } else if (model === "person" && field === "email") {
      // L'adresse est aussi l'identifiant de connexion : on la normalise et on la propage au compte.
      const email = value ? String(value).trim().toLowerCase() : null;
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Adresse e-mail invalide." };
      const target = await prisma.person.findUnique({ where: { id } });
      if (email && (await prisma.person.findFirst({ where: { email, id: { not: id } } }))) return { ok: false, error: "Cette adresse est déjà celle d'une autre personne." };
      if (email && target?.userId && (await prisma.user.findFirst({ where: { email, id: { not: target.userId } } }))) return { ok: false, error: "Cette adresse est déjà celle d'un autre compte." };
      await prisma.person.update({ where: { id }, data: { email } });
      if (target?.userId && email) await prisma.user.update({ where: { id: target.userId }, data: { email } });
    } else if (model === "call") {
      const call = await prisma.call.findUnique({ where: { id }, select: { conventionId: true } });
      if (!call) return { ok: false, error: "Appel introuvable." };
      const bad = callFieldInvariant(field, value, call);
      if (bad) return { ok: false, error: bad };
      await prisma.call.update({ where: { id }, data: { [field]: value } });
    } else if (model === "settings") {
      await prisma.settings.update({ where: { id: 1 }, data: { [field]: value } });
    } else {
      // Les autres modèles : mise à jour directe.
      // « funder » reste le nom du modèle dans les écrans Financeurs ; en base c'est une organisation (lot E2).
      const delegate = (prisma as unknown as Record<string, { update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> }>)[model === "funder" ? "organisation" : model];
      await delegate.update({ where: { id }, data: { [field]: value } });
    }

    revalidatePath(revalidate ?? "/", revalidate ? undefined : "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, ...reportInternalError("saveField", e) };
  }
}
