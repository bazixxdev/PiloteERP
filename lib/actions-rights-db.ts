import { prisma } from "./db";
import { actionRights, canEditAction } from "./rights";
import { inMyPole, type Viewer } from "./scope";
import { runsIn } from "./actions";

// Droits sur une action (spec actions § 2), chargés une fois avant toute lecture ou écriture : les commandes de l'action
// (app/actions/actions.ts), saveField (branche « action ») et le point de contrôle de
// la délégation passent tous par ici. Pas de « use server » : ce n'est pas une commande appelable du navigateur, seulement la
// règle partagée côté serveur. Une action sans projet ni période n'est dans aucune année : personne ne la modifie (a = null).
// `can` : modifier contenu, période, jalons ; `canManagePeople` : la liste des associés ; `canDelete` : supprimer.
export async function actionCtx(actionId: string, me: Viewer) {
  const a = await prisma.action.findUnique({
    where: { id: actionId },
    include: {
      people: { select: { personId: true } },
      project: { include: { secondaryPoles: { select: { poleId: true } }, editions: { select: { year: true, team: { select: { personId: true } } } } } },
    },
  });
  if (!a || !a.project || !a.startDate || !a.endDate) return { a: null, can: false, canManagePeople: false, canDelete: false } as const;
  const period = { startDate: a.startDate, endDate: a.endDate };
  const r = actionRights(me, {
    isPilot: a.project.pilotId === me.id,
    isTeamOfCoveredYear: a.project.editions.some((e) => runsIn(period, e.year) && e.team.some((t) => t.personId === me.id)),
    samePole: inMyPole(me, a.project),
    isOwner: a.ownerId === me.id,
    isAssociate: a.people.some((p) => p.personId === me.id),
  });
  return { a: { ...a, startDate: a.startDate, endDate: a.endDate, projectId: a.project.id }, can: r.edit, canManagePeople: r.managePeople, canDelete: r.delete } as const;
}

// Ajouter une action à une année : le droit sur l'année (pilote, équipe de cette année, pôle, direction). Chargé avant toute
// écriture, par createAction et par l'objectif de délégation.
export async function editionActionCtx(editionId: string, me: Viewer) {
  const ed = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: { select: { poleId: true } } } }, team: { select: { personId: true } } } });
  if (!ed) return { ed: null, can: false } as const;
  const isPilot = ed.project.pilotId === me.id;
  const can = canEditAction(me, { isPilot, isTeamOfCoveredYear: ed.team.some((t) => t.personId === me.id), samePole: inMyPole(me, ed.project), isOwnerOrAssociate: false });
  return { ed, can, isPilot } as const;
}
