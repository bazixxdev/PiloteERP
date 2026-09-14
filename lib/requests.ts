import { prisma } from "./db";
import { dayjs } from "./format";

// Demandes internes (retour du 14/09) : un seul canal pour « retour sur le site », « j'ai besoin de chiffres », « réserve-moi une salle »…
export const REQUEST_KINDS = [
  { value: "site", label: "Site internet", hint: "correction, mise à jour, nouvelle page" },
  { value: "com", label: "Communication", hint: "visuel, post, newsletter" },
  { value: "data", label: "Chiffres / données", hint: "une donnée de l'Observatoire" },
  { value: "assistant", label: "Logistique / administratif", hint: "salle, déplacement, courrier" },
  { value: "work", label: "Travail à faire", hint: "une contribution à un projet" },
  { value: "other", label: "Autre", hint: "" },
] as const;
export const kindLabel = (v: string) => REQUEST_KINDS.find((k) => k.value === v)?.label ?? v;

export const REQUEST_STATUSES = [
  { value: "open", label: "À traiter", color: "warning" },
  { value: "doing", label: "En cours", color: "info" },
  { value: "done", label: "Faite", color: "mint" },
  { value: "declined", label: "Déclinée", color: "muted" },
] as const;
export const statusOf = (v: string) => REQUEST_STATUSES.find((s) => s.value === v) ?? REQUEST_STATUSES[0];

export const requestInclude = { requester: true, assignee: true, pole: true, edition: { include: { project: true } } };
export type RequestRow = Awaited<ReturnType<typeof loadRequests>>[number];

export async function loadRequests() {
  return prisma.request.findMany({ include: requestInclude, orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }] });
}

// Une demande « me concerne » si elle m'est adressée, ou adressée à mon pôle (son responsable la voit d'abord).
export function isForMe(me: { id: string; role: string; poleId: string | null }, r: { assigneeId: string | null; poleId: string | null }): boolean {
  if (r.assigneeId) return r.assigneeId === me.id;
  if (r.poleId) return me.poleId === r.poleId || me.role === "director";
  return false;
}

export const ageDays = (d: Date) => dayjs().diff(dayjs(d), "day");
