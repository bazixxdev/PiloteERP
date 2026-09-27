// « Mes actions » (26/09, fin de la délégation comme objet à part, docs/superpowers/specs/2026-09-26-vocabulaire-
// gouvernance-design.md § 4) : les actions dont une personne est responsable ou associée, avec ce qui leur est confié
// (`entrusted`), leur marge de décision (`latitude`) et leurs jalons — filtrées par année puis par une période (les
// périodes de l'admin actuelles, `lib/delegation.ts`, gardées). Remplace lib/delegation-db.ts (feuille de délégation) :
// plus aucune lecture de la table Delegation ici.
import { prisma } from "./db";
import { attachYearActions } from "./actions-db";
import { runsInRange, milestoneTitle } from "./actions";
import { dueInPeriod, periodFor, periodsOf } from "./delegation";

const editionSelect = { id: true, year: true, projectId: true, project: { select: { name: true } } };

// La feuille « Mes actions » d'une personne pour une année et une période. `isSelf` décide si ses tâches sortent : elles
// sont personnelles, jamais montrées pour un tiers (règle héritée de la délégation). Renvoie null si la personne n'existe pas.
export async function loadMesActions(personId: string, year: number, periodKey: string | undefined, isSelf: boolean) {
  const [person, settings, editions] = await Promise.all([
    prisma.person.findUnique({ where: { id: personId }, select: { id: true, name: true, jobTitle: true } }),
    prisma.settings.findUnique({ where: { id: 1 }, select: { delegationPeriods: true } }),
    prisma.edition.findMany({ where: { year }, select: editionSelect, orderBy: { project: { name: "asc" } } }),
  ]);
  if (!person) return null;
  const periods = periodsOf(settings?.delegationPeriods ?? "01-06,07-12", year);
  const period = periodFor(periodKey, periods, new Date());
  const years = await attachYearActions(editions, { lean: true });

  const actionIds: string[] = [];
  const projects = years
    .map((e) => {
      // Mode léger (attachYearActions lean) : les personnes associées ne portent que `person` (pas `personId` à plat).
      const mine = e.actions.filter((a) => (a.ownerId === personId || a.people.some((p) => p.person.id === personId)) && runsInRange(a, period.from, period.to));
      for (const a of mine) actionIds.push(a.id);
      return {
        id: e.id,
        name: e.project.name,
        actions: mine.map((a) => {
          const dueMilestones = a.milestones.filter((m) => dueInPeriod(m.date, period)).sort((x, y) => x.date.getTime() - y.date.getTime());
          return {
            id: a.id,
            name: a.name,
            startDate: a.startDate,
            endDate: a.endDate,
            entrusted: a.entrusted,
            latitude: a.latitude,
            milestones: dueMilestones.map((m) => ({ id: m.id, name: milestoneTitle(a.name, m.label), date: m.date, done: m.done, isCheckpoint: m.isCheckpoint })),
          };
        }),
      };
    })
    .filter((p) => p.actions.length > 0);

  // Tâches personnelles de la période, sur les projets montrés — seulement pour la personne elle-même (jamais un tiers).
  const tasks = isSelf
    ? await prisma.task
        .findMany({ where: { personId, editionId: { in: projects.map((p) => p.id) } }, select: { id: true, label: true, dueDate: true, done: true, editionId: true }, orderBy: [{ done: "asc" }, { dueDate: "asc" }] })
        .then((rows) => rows.filter((t) => !t.done || (t.dueDate && dueInPeriod(t.dueDate, period))))
    : null;

  return { person, year, periods, period, projects, tasks };
}

export type MesActionsSheet = NonNullable<Awaited<ReturnType<typeof loadMesActions>>>;
