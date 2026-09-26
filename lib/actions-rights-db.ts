import { prisma } from "./db";
import { canEditAction } from "./rights";
import { inMyPole, type Viewer } from "./scope";
import { runsIn } from "./actions";

// Droits sur une action (spec actions § 2), chargés une fois avant toute lecture ou écriture : les commandes de l'action
// (app/actions/actions.ts), saveField (branche « action ») et la cellule provisoire du prochain jalon passent toutes par ici.
// Pas de « use server » : ce n'est pas une commande appelable du navigateur, seulement la règle partagée côté serveur.
// Une action sans projet ni période n'est dans aucune année : personne ne la modifie (a = null).
export async function actionCtx(actionId: string, me: Viewer) {
  const a = await prisma.action.findUnique({
    where: { id: actionId },
    include: {
      people: { select: { personId: true } },
      project: { include: { secondaryPoles: { select: { poleId: true } }, editions: { select: { year: true, team: { select: { personId: true } } } } } },
    },
  });
  if (!a || !a.project || !a.startDate || !a.endDate) return { a: null, can: false } as const;
  const period = { startDate: a.startDate, endDate: a.endDate };
  const isTeamOfCoveredYear = a.project.editions.some((e) => runsIn(period, e.year) && e.team.some((t) => t.personId === me.id));
  const can = canEditAction(me, {
    isPilot: a.project.pilotId === me.id,
    isTeamOfCoveredYear,
    samePole: inMyPole(me, a.project),
    isOwnerOrAssociate: a.ownerId === me.id || a.people.some((p) => p.personId === me.id),
  });
  return { a: { ...a, startDate: a.startDate, endDate: a.endDate, projectId: a.project.id }, can } as const;
}
