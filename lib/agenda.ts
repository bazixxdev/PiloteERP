import { prisma } from "./db";
import { dayjs, daysFromNow } from "./format";
import { milestonesInEditions } from "./actions-db";
import { milestoneTitle } from "./actions";

// Données communes à « Ma semaine » (EF-G2) et à l'écran café (EF-H1).
export async function loadAgenda(horizonDays: number) {
  const limit = dayjs().add(horizonDays, "day").endOf("day").toDate();
  const [milestones, deliverables, validations, people, entries] = await Promise.all([
    // Jalons non faits des actions en cours, dans les années en cours ou validées (un jalon une seule fois, même pluriannuel).
    milestonesInEditions({ done: false, date: { lte: limit }, action: { state: { notIn: ["done", "abandoned"] } } }, ["in_progress", "validated"]),
    prisma.deliverable.findMany({
      where: { done: false, dueDate: { lte: limit }, fundingLine: { edition: { status: { in: ["in_progress", "validated"] } } } },
      include: { fundingLine: { include: { funder: true, edition: { include: { project: { include: { pilot: true } } } } } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.validationRequest.findMany({ where: { status: "pending" }, include: { requester: true, edition: { include: { project: { include: { pilot: true, pole: true } } } }, action: true }, orderBy: { createdAt: "asc" } }),
    // Les personnes à part fixe (lettre de mission) n'ont rien à répartir : hors relances. Idem qui ne suit pas son temps
    // (CA, bénévole, 26/09) : la relance de saisie ne la concerne pas.
    prisma.person.findMany({ where: { active: true, role: { not: "assistant" }, fixedShare: false, tracksTime: true }, include: { pole: true }, orderBy: { order: "asc" } }),
    prisma.timeEntry.findMany({ where: { date: { gte: dayjs().subtract(14, "day").startOf("day").toDate() } }, select: { personId: true, date: true } }),
  ]);

  // Jours ouvrés des deux dernières semaines sans saisie, par personne.
  const workDays: string[] = [];
  for (let i = 14; i >= 1; i--) {
    const d = dayjs().subtract(i, "day");
    if (d.isoWeekday() <= 5) workDays.push(d.format("YYYY-MM-DD"));
  }
  const done = new Map<string, Set<string>>();
  for (const t of entries) {
    const s = done.get(t.personId) ?? new Set<string>();
    s.add(dayjs(t.date).format("YYYY-MM-DD"));
    done.set(t.personId, s);
  }
  const missingTime = people.map((p) => ({ person: p, missing: workDays.filter((d) => !done.get(p.id)?.has(d)) })).filter((x) => x.missing.length > 0);

  return {
    // Une ligne par jalon, au nom de l'action (« action · libellé ») ; `ownerId`, `peopleIds` et `state` sont ceux de l'action.
    milestones: milestones.map((m) => ({ id: m.id, actionId: m.actionId, name: milestoneTitle(m.action.name, m.label), date: m.date, state: m.action.state, ownerId: m.action.ownerId, owner: m.action.owner, peopleIds: m.action.people.map((p) => p.personId), edition: m.edition, editionId: m.edition.id, daysLeft: daysFromNow(m.date) })),
    deliverables: deliverables.map((d) => ({ ...d, daysLeft: daysFromNow(d.dueDate) })),
    validations: validations.map((v) => ({ ...v, age: dayjs().diff(dayjs(v.createdAt), "day") })),
    missingTime,
    people,
  };
}

export type Agenda = Awaited<ReturnType<typeof loadAgenda>>;
