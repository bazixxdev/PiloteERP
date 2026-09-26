"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin, has } from "@/lib/rights";
import { isPermissionKey } from "@/lib/permissions";
import { reportInternalError } from "@/lib/errors";
import { asDecisions, decisionLevel, DECISION_LABEL, ficheDecisionRefusal, FICHE_LEVEL_PERMISSIONS, isFicheDecision, isLevelPermission, statusAfter, type FicheDecision } from "@/lib/fiche-validation";
import { V, cap } from "@/lib/vocab";

type Result = { ok: true } | { ok: false; code?: string; error: string };
type Me = Awaited<ReturnType<typeof getCurrentPerson>>;
const holdsOf = (me: Me) => (permission: string) => isPermissionKey(permission) && has(me, permission);

// Décider la fiche d'une année au niveau du circuit qui l'attend (spec vocabulaire § 3).
// Qui peut écrire : qui tient le droit du niveau à décider (fiche.validate.N), jamais le pilote du projet (sa propre fiche) ;
// les niveaux se prennent dans l'ordre, calculés ici (le client n'envoie pas de niveau). « À retravailler » et « Refuser »
// exigent un commentaire. Une transaction : la décision, le statut de l'année s'il change, l'historique.
export async function decideFiche(editionId: string, decision: FicheDecision, comment: string): Promise<Result> {
  const me = await getCurrentPerson();
  if (typeof editionId !== "string" || !isFicheDecision(decision) || typeof comment !== "string") return { ok: false, error: "Demande invalide." };
  // Garde avant toute lecture : sans aucun droit du circuit, rien à décider nulle part.
  if (!FICHE_LEVEL_PERMISSIONS.some((p) => has(me, p))) return { ok: false, error: "Vous ne décidez à aucun niveau du circuit de validation des fiches." };
  const text = comment.trim().slice(0, 2000);
  try {
    const refused = await prisma.$transaction(async (tx) => {
      // Verrou de ligne sur l'année (SEC-29) : deux décisions simultanées se sérialisent, la seconde relit le circuit à jour
      // et ne décide pas deux fois le même niveau.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Edition" WHERE "id" = ${editionId} FOR UPDATE`;
      if (locked.length === 0) return `${cap(V.edition)} introuvable.`;
      const [e, levels] = await Promise.all([
        tx.edition.findUniqueOrThrow({ where: { id: editionId }, select: { status: true, project: { select: { pilotId: true } }, ficheValidations: { select: { levelId: true, decision: true, decidedAt: true } } } }),
        tx.ficheValidationLevel.findMany({ select: { id: true, order: true, label: true, permission: true, active: true } }),
      ]);
      const decisions = asDecisions(e.ficheValidations);
      const refusal = ficheDecisionRefusal({ levels, decisions, status: e.status, isPilot: e.project.pilotId === me.id, holds: holdsOf(me), decision, comment: text });
      if (refusal) return refusal;
      const level = decisionLevel(levels, decisions, decision)!;
      const row = await tx.ficheValidation.create({ data: { editionId, levelId: level.id, decision, comment: text || null, deciderId: me.id } });
      const status = statusAfter(levels, [...decisions, { levelId: level.id, decision, decidedAt: row.decidedAt }], e.status);
      if (status !== e.status) {
        await tx.edition.update({ where: { id: editionId }, data: { status } });
        await tx.changeLog.create({ data: { editionId, field: "status", before: e.status, after: status, authorId: me.id } });
      }
      await tx.changeLog.create({ data: { editionId, field: "validation", before: null, after: `${level.label} : ${DECISION_LABEL[decision]}`, authorId: me.id } });
      return null;
    });
    if (refused) return { ok: false, error: refused };
  } catch (err) {
    return { ok: false, ...reportInternalError("decideFiche", err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export type LevelInput = { id?: string; label: string; permission: string; active: boolean };

// Régler le circuit (Admin › Paramètres). Qui peut écrire : l'administration (canAdmin). L'ordre = la position dans la liste.
// Un niveau retiré de la liste est supprimé s'il n'a aucune décision, sinon passé inactif (ses décisions restent lisibles).
// Une transaction : tout le circuit change, ou rien.
export async function saveLevels(input: LevelInput[]): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Le circuit de validation des fiches se règle par l'administration." };
  if (!Array.isArray(input) || input.length > 10) return { ok: false, error: "Demande invalide." };
  const levels: LevelInput[] = [];
  for (const l of input) {
    if (!l || typeof l !== "object" || typeof l.label !== "string" || typeof l.permission !== "string" || typeof l.active !== "boolean" || (l.id !== undefined && typeof l.id !== "string")) return { ok: false, error: "Demande invalide." };
    const label = l.label.trim().slice(0, 80);
    if (!label) return { ok: false, error: "Chaque niveau a un libellé." };
    if (!isLevelPermission(l.permission)) return { ok: false, error: `Droit inconnu pour le niveau « ${label} ».` };
    levels.push({ id: l.id || undefined, label, permission: l.permission, active: l.active });
  }
  if (!levels.some((l) => l.active)) return { ok: false, error: "Au moins un niveau actif : sans niveau, aucune fiche ne se valide." };
  const ids = levels.flatMap((l) => (l.id ? [l.id] : []));
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Demande invalide." };
  try {
    const refused = await prisma.$transaction(async (tx) => {
      const existing = await tx.ficheValidationLevel.findMany({ select: { id: true } });
      if (ids.some((id) => !existing.some((x) => x.id === id))) return "Niveau introuvable : rechargez la page.";
      for (let i = 0; i < levels.length; i++) {
        const l = levels[i];
        const data = { order: i + 1, label: l.label, permission: l.permission, active: l.active };
        if (l.id) await tx.ficheValidationLevel.update({ where: { id: l.id }, data });
        else await tx.ficheValidationLevel.create({ data });
      }
      // Retirés de la liste : tous passent inactifs, puis seuls ceux sans aucune décision sont supprimés — jamais un niveau qui
      // a des décisions (FK Restrict), même si une décision arrive entre-temps.
      const removed = existing.filter((x) => !ids.includes(x.id)).map((x) => x.id);
      if (removed.length) {
        await tx.ficheValidationLevel.updateMany({ where: { id: { in: removed } }, data: { active: false, order: levels.length + 1 } });
        await tx.ficheValidationLevel.deleteMany({ where: { id: { in: removed }, validations: { none: {} } } });
      }
      return null;
    });
    if (refused) return { ok: false, error: refused };
  } catch (err) {
    return { ok: false, ...reportInternalError("saveLevels", err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
