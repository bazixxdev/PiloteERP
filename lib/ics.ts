import { prisma } from "./db";
import { dayjs } from "./format";
import { actorOf } from "./roles";
import { canDecideValidation, canEditFunding, validationLevelOf } from "./rights";
import { randomBytes } from "node:crypto";
import { V } from "@/lib/vocab";
import { milestonesInEditions } from "./actions-db";
import { milestoneTitle } from "./actions";

// Flux agenda iCal (sens outil → Outlook). Événements « journée entière », format standard, sans dépendance Microsoft.

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => "\\" + m);
}

function fold(line: string): string {
  // RFC 5545 : lignes de 75 octets maximum, repli avec un espace.
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 73) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

// Un événement est « journée entière » par défaut (échéance) ; avec `end`, c'est une plage horaire (créneau de travail), marquée occupée.
export type IcsEvent = { uid: string; date: Date; end?: Date; busy?: boolean; summary: string; description?: string; location?: string; url?: string; category?: string };

export function buildIcs(name: string, events: IcsEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${V.orgLong}//Pilote//FR`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:Europe/Paris", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    const d = dayjs(e.date);
    const utc = (x: Date) => new Date(x).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@pilote.cress`,
      `DTSTAMP:${stamp}`,
      ...(e.end ? [`DTSTART:${utc(e.date)}`, `DTEND:${utc(e.end)}`] : [`DTSTART;VALUE=DATE:${d.format("YYYYMMDD")}`, `DTEND;VALUE=DATE:${d.add(1, "day").format("YYYYMMDD")}`]),
      `SUMMARY:${esc(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      ...(e.category ? [`CATEGORIES:${esc(e.category)}`] : []),
      e.busy ? "TRANSP:OPAQUE" : "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function newToken(): string {
  return randomBytes(18).toString("base64url");
}

const LIVE = ["in_progress", "validated"];

// Événements d'une personne : ses jalons, les livrables des projets qu'elle pilote (tous pour la RAF), ses validations à traiter.
export async function personEvents(personId: string, base: string): Promise<{ name: string; events: IcsEvent[] } | null> {
  const raw = await prisma.person.findUnique({ where: { id: personId } });
  if (!raw) return null;
  const p = await actorOf(raw);
  const from = dayjs().subtract(60, "day").toDate();
  const [milestones, deliverables, validations, tasks] = await Promise.all([
    // Jalons des actions dont la personne est responsable ou associée.
    milestonesInEditions({ done: false, date: { gte: from }, action: { state: { notIn: ["done", "abandoned"] }, OR: [{ ownerId: p.id }, { people: { some: { personId: p.id } } }] } }, LIVE),
    prisma.deliverable.findMany({ where: { done: false, dueDate: { gte: from }, fundingLine: { edition: { status: { in: LIVE }, ...(canEditFunding(p) ? {} : { project: { pilotId: p.id } }) } } }, include: { fundingLine: { include: { funder: true, edition: { include: { project: true } } } } } }),
    validationLevelOf(p) >= 1
      ? prisma.validationRequest.findMany({ where: { status: "pending" }, include: { edition: { include: { project: true } } } })
      : Promise.resolve([]),
    prisma.task.findMany({ where: { personId: p.id, done: false }, include: { edition: { include: { project: true } }, slots: { where: { endAt: { gte: from } } } } }),
  ]);
  const events: IcsEvent[] = [
    // Tâches personnelles : l'échéance en journée entière, chaque créneau posé en plage horaire occupée (ou journée occupée).
    ...tasks.filter((t) => t.dueDate && t.dueDate >= from).map((t) => ({ uid: `task-${t.id}`, date: t.dueDate!, summary: `Tâche · ${t.label}`, description: t.edition ? `${t.edition.project.name} · ${t.edition.year}` : "Tâche personnelle", url: `${base}/ma-semaine`, category: "Pilote · tâche" })),
    ...tasks.flatMap((t) => t.slots.map((s) => ({ uid: `slot-${s.id}`, date: s.startAt, end: s.allDay ? undefined : s.endAt, busy: true, summary: `Travail · ${t.label}`, description: t.edition ? `${t.edition.project.name} · ${t.edition.year}` : "Créneau de travail", url: `${base}/ma-semaine`, category: "Pilote · créneau" }))),
    ...milestones.map((m) => ({ uid: `milestone-${m.id}`, date: m.date, summary: `Jalon · ${milestoneTitle(m.action.name, m.label)}`, description: `${m.edition.project.name} · ${m.edition.year}`, url: `${base}/edition/${m.edition.id}?onglet=actions`, category: "Pilote · jalon" })),
    ...deliverables.map((d) => ({ uid: `deliv-${d.id}`, date: d.dueDate, summary: `Livrable ${d.fundingLine.funder.name} · ${d.label}`, description: `${d.fundingLine.edition.project.name} · ${d.fundingLine.edition.year}`, url: `${base}/edition/${d.fundingLine.editionId}?onglet=financements`, category: "Pilote · livrable financeur" })),
    ...validations
      .filter((v) => canDecideValidation(p, v))
      .map((v) => ({ uid: `valid-${v.id}`, date: dayjs(v.createdAt).add(v.targetDelayDays, "day").toDate(), summary: `À valider · ${v.label}`, description: `${v.edition.project.name} · délai cible`, url: `${base}/validations`, category: "Pilote · validation" })),
  ];
  return { name: `Pilote · échéances de ${p.name}`, events };
}

// Événements de toute l'équipe : jalons et livrables des éditions en cours.
export async function teamEvents(base: string): Promise<{ name: string; events: IcsEvent[] }> {
  const from = dayjs().subtract(60, "day").toDate();
  const [milestones, deliverables] = await Promise.all([
    milestonesInEditions({ done: false, date: { gte: from }, action: { state: { notIn: ["done", "abandoned"] } } }, LIVE),
    prisma.deliverable.findMany({ where: { done: false, dueDate: { gte: from }, fundingLine: { edition: { status: { in: LIVE } } } }, include: { fundingLine: { include: { funder: true, edition: { include: { project: { include: { pilot: true } } } } } } } }),
  ]);
  return {
    name: "Pilote · échéances de l'équipe",
    events: [
      ...milestones.map((m) => ({ uid: `milestone-${m.id}`, date: m.date, summary: `Jalon · ${milestoneTitle(m.action.name, m.label)} (${m.action.owner?.name ?? "—"})`, description: `${m.edition.project.name} · ${m.edition.year}`, url: `${base}/edition/${m.edition.id}?onglet=actions`, category: "Pilote · jalon" })),
      ...deliverables.map((d) => ({ uid: `deliv-${d.id}`, date: d.dueDate, summary: `Livrable ${d.fundingLine.funder.name} · ${d.label} (${d.fundingLine.edition.project.pilot.name})`, description: `${d.fundingLine.edition.project.name} · ${d.fundingLine.edition.year}`, url: `${base}/edition/${d.fundingLine.editionId}?onglet=financements`, category: "Pilote · livrable financeur" })),
    ],
  };
}

// Événements publics (site internet) : jalons cochés « public » des actions des années en cours, sans jeton. Titre = action ·
// libellé du jalon, lieu = celui du jalon.
export async function publicEvents(): Promise<{ name: string; events: IcsEvent[] }> {
  const from = dayjs().subtract(30, "day").toDate();
  const milestones = await milestonesInEditions({ isPublic: true, date: { gte: from }, action: { state: { not: "abandoned" } } }, LIVE);
  return {
    name: `${V.orgLong} · agenda`,
    events: milestones.map((m) => ({ uid: `public-${m.id}`, date: m.date, summary: milestoneTitle(m.action.name, m.label), description: m.edition.project.name, location: m.venue ?? undefined, category: V.org.one })),
  };
}
