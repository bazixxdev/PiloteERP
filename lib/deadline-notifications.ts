import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { computeReminders, type Reminder } from "./alerts";
import { dayjs, fmtDate } from "./format";

// Passerelle échéances → notifications. En V1, c'est le cron quotidien qui envoie les mails J-30 / J-7 / retard
// (docs/integrations.md) ; dans le prototype, la même passe tourne à chaque chargement et dépose la notification dans la
// cloche. Idempotente grâce à `Notification.dedupeKey` (personne + palier), et datée du jour où le mail serait parti,
// pour que la cloche raconte une histoire cohérente même sur un jeu de données fraîchement semé.
export const DEADLINE_KIND = "deadline";

export function deadlineKey(r: Reminder): string {
  return `deadline:${r.kind}:${r.editionId}:${r.label}:${dayjs(r.dueDate).format("YYYY-MM-DD")}:${r.stage}`;
}

// Date d'envoi : le matin du palier (J-30, J-7, lendemain de l'échéance), jamais avant le dernier passage — une échéance
// saisie alors qu'elle est déjà dans la fenêtre part au passage suivant, comme un mail — et jamais dans le futur.
function sentAt(r: Reminder, lastSync: Date | null): Date {
  const stage = (r.stage === "retard" ? dayjs(r.dueDate).add(1, "day") : dayjs(r.dueDate).subtract(r.stage, "day")).startOf("day").add(8, "hour");
  const floor = lastSync && dayjs(lastSync).isAfter(stage) ? dayjs(lastSync) : stage;
  return (floor.isAfter(dayjs()) ? dayjs() : floor).toDate();
}

function titleOf(r: Reminder): string {
  const what = r.kind === "deliverable" ? "Livrable" : r.kind === "payment" ? "Versement" : "Jalon";
  return r.stage === "retard" ? `${what} en retard : ${r.label}` : `${what} à J-${r.stage} : ${r.label}`;
}

const KIND_LABEL: Record<Reminder["kind"], string> = { deliverable: "livrable financeur", milestone: "jalon interne", payment: "versement attendu", call: "dépôt d'appel à projets" };

// Renvoie aussi les rappels calculés, pour que le layout ne refasse pas la requête.
export async function syncDeadlineNotifications(): Promise<{ reminders: Reminder[]; created: number }> {
  const [settings, editions, raf, director] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.edition.findMany({
      where: { status: { in: ["in_progress", "validated"] } },
      include: { project: { include: { pilot: true } }, actions: true, fundingLines: { include: { funder: true, deliverables: true, payments: true } }, validations: true, expenses: true },
    }),
    prisma.person.findFirst({ where: { role: "raf", active: true }, orderBy: { order: "asc" } }),
    prisma.person.findFirst({ where: { role: "director", active: true }, orderBy: { order: "asc" } }),
  ]);
  const reminders = computeReminders(editions, raf ? { id: raf.id, name: raf.name } : null, settings.reminderDaysBefore.split(",").map(Number), settings.horizonDays, director ? { id: director.id, name: director.name } : null);
  const year = new Map(editions.map((e) => [e.id, e.year]));
  const wanted = reminders.flatMap((r) => r.whoIds.map((personId) => ({
    personId,
    kind: DEADLINE_KIND,
    dedupeKey: deadlineKey(r),
    title: titleOf(r),
    body: `${r.project} · ${year.get(r.editionId)} — ${KIND_LABEL[r.kind]} au ${fmtDate(r.dueDate)}.`,
    link: `/edition/${r.editionId}?onglet=${r.kind === "milestone" ? "actions" : "budget"}`,
    createdAt: sentAt(r, settings.deadlineSyncAt),
  })));
  // L'horodatage du passage n'est réécrit qu'une fois par minute : le layout appelle cette passe à chaque requête, et SQLite
  // n'aime pas les écritures concurrentes inutiles.
  const stale = !settings.deadlineSyncAt || dayjs().diff(settings.deadlineSyncAt, "second") > 60;
  const stamp = stale ? prisma.settings.update({ where: { id: 1 }, data: { deadlineSyncAt: new Date() } }) : Promise.resolve();
  if (wanted.length === 0) { await stamp; return { reminders, created: 0 }; }
  const existing = await prisma.notification.findMany({ where: { kind: DEADLINE_KIND, dedupeKey: { in: [...new Set(wanted.map((w) => w.dedupeKey))] } }, select: { personId: true, dedupeKey: true } });
  const have = new Set(existing.map((n) => `${n.personId}|${n.dedupeKey}`));
  const missing = wanted.filter((w) => !have.has(`${w.personId}|${w.dedupeKey}`));
  const created = missing.length > 0 ? await createMissing(missing) : 0;
  await stamp;
  return { reminders, created };
}

type Missing = Prisma.NotificationCreateManyInput & { dedupeKey: string };

// Deux requêtes du même chargement (layout + page) font cette passe en parallèle : chacune calcule les mêmes manquants et
// la seconde heurte la contrainte unique (personId, dedupeKey). SQLite n'a pas `skipDuplicates` et n'aime pas les écritures
// concurrentes : on relit ce que l'autre a posé, on réinsère le reste en une seule fois, et si ça heurte encore, l'autre a
// fini le travail — la notification existe, c'est le résultat voulu.
async function createMissing(missing: Missing[]): Promise<number> {
  try {
    await prisma.notification.createMany({ data: missing });
    return missing.length;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const existing = await prisma.notification.findMany({ where: { kind: DEADLINE_KIND, dedupeKey: { in: [...new Set(missing.map((m) => m.dedupeKey))] } }, select: { personId: true, dedupeKey: true } });
  const have = new Set(existing.map((n) => `${n.personId}|${n.dedupeKey}`));
  const rest = missing.filter((m) => !have.has(`${m.personId}|${m.dedupeKey}`));
  if (rest.length === 0) return 0;
  try {
    await prisma.notification.createMany({ data: rest });
    return rest.length;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return 0;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
