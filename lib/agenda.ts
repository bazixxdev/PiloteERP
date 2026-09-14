import { prisma } from "./db";
import { dayjs, daysFromNow } from "./format";

// Données communes à « Ma semaine » (EF-G2) et à l'écran café (EF-H1).
export async function loadAgenda(horizonDays: number) {
  const limit = dayjs().add(horizonDays, "day").endOf("day").toDate();
  const [actions, deliverables, validations, people, entries] = await Promise.all([
    prisma.action.findMany({
      where: { state: { not: "done" }, milestoneDate: { lte: limit }, edition: { status: { in: ["in_progress", "validated"] } } },
      include: { owner: true, edition: { include: { project: { include: { pilot: true, pole: true } } } } },
      orderBy: { milestoneDate: "asc" },
    }),
    prisma.deliverable.findMany({
      where: { done: false, dueDate: { lte: limit }, fundingLine: { edition: { status: { in: ["in_progress", "validated"] } } } },
      include: { fundingLine: { include: { funder: true, edition: { include: { project: { include: { pilot: true } } } } } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.validationRequest.findMany({ where: { status: "pending" }, include: { requester: true, edition: { include: { project: { include: { pilot: true, pole: true } } } }, action: true }, orderBy: { createdAt: "asc" } }),
    // Les personnes à part fixe (lettre de mission) n'ont rien à répartir : hors relances.
    prisma.person.findMany({ where: { active: true, role: { not: "assistant" }, fixedShare: false }, include: { pole: true }, orderBy: { order: "asc" } }),
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
    milestones: actions.map((a) => ({ ...a, daysLeft: daysFromNow(a.milestoneDate!) })),
    deliverables: deliverables.map((d) => ({ ...d, daysLeft: daysFromNow(d.dueDate) })),
    validations: validations.map((v) => ({ ...v, age: dayjs().diff(dayjs(v.createdAt), "day") })),
    missingTime,
    people,
  };
}

export type Agenda = Awaited<ReturnType<typeof loadAgenda>>;
