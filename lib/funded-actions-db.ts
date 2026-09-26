import { prisma } from "./db";
import { mergeByAction, splitHours, sortFunded, type FundedAction, type TimePerson } from "./funded-actions";

const yearRange = (y: number) => ({ gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) });

// Les actions financées par ces lignes, chacune sur l'année de sa ligne. `canSee` décide, personne par personne, si ses heures
// sortent en détail (canSeeTimeOf pour une session ; tout pour le jeton d'API) : le filtre se fait ICI, avant de rendre quoi
// que ce soit — un appelant ne reçoit jamais les heures d'une personne qu'il ne peut pas voir.
export async function loadFundedActions(lineIds: string[], canSee: (p: TimePerson) => boolean): Promise<FundedAction[]> {
  if (lineIds.length === 0) return [];
  const links = await prisma.actionFunding.findMany({
    where: { fundingLineId: { in: lineIds } },
    select: { amount: true, fundingLineId: true, fundingLine: { select: { edition: { select: { year: true } } } }, action: { select: { id: true, name: true, project: { select: { name: true } } } } },
  });
  if (links.length === 0) return [];
  const years = [...new Set(links.map((l) => l.fundingLine.edition.year))];
  const idsOf = (y: number) => [...new Set(links.filter((l) => l.fundingLine.edition.year === y).map((l) => l.action.id))];
  const allIds = [...new Set(links.map((l) => l.action.id))];

  // Heures, jalons faits, réalisations : par action et par année (celle de la ligne), une requête par année au plus.
  const [hoursByYear, milestones, achievements] = await Promise.all([
    Promise.all(years.map(async (y) => ({ y, rows: await prisma.timeEntry.groupBy({ by: ["actionId", "personId"], where: { actionId: { in: idsOf(y) }, date: yearRange(y) }, _sum: { hours: true } }) }))),
    prisma.milestone.findMany({ where: { actionId: { in: allIds }, done: true, OR: years.map((y) => ({ date: yearRange(y) })) }, select: { actionId: true, date: true } }),
    prisma.achievement.findMany({ where: { actionId: { in: allIds }, edition: { year: { in: years } } }, select: { actionId: true, edition: { select: { year: true } } } }),
  ]);
  const personIds = [...new Set(hoursByYear.flatMap((h) => h.rows.map((r) => r.personId)))];
  // Noms pris dans toutes les personnes (une personne partie garde ses heures), comme la page de l'action.
  const people = personIds.length === 0 ? [] : await prisma.person.findMany({ where: { id: { in: personIds } }, select: { id: true, name: true, poleId: true } });

  // Une action liée à deux lignes de la même année (même dossier) ne compte qu'une fois, montants additionnés.
  return sortFunded(mergeByAction(links.map((l) => {
    const year = l.fundingLine.edition.year;
    const rows = hoursByYear.find((h) => h.y === year)!.rows.filter((r) => r.actionId === l.action.id);
    const hours = rows.map((r) => ({ person: people.find((p) => p.id === r.personId) ?? null, hours: r._sum.hours ?? 0 }));
    return {
      lineId: l.fundingLineId,
      year,
      amount: l.amount,
      action: { id: l.action.id, name: l.action.name, projectName: l.action.project?.name ?? "" },
      ...splitHours(hours, canSee),
      milestonesDone: milestones.filter((m) => m.actionId === l.action.id && m.date.getUTCFullYear() === year).length,
      achievements: achievements.filter((a) => a.actionId === l.action.id && a.edition.year === year).length,
    };
  })));
}
