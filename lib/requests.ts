import { prisma } from "./db";
import { dayjs } from "./format";
import { canDecideValidation } from "./rights";

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

export const requestInclude = { requester: true, assignee: true, pole: true, edition: { include: { project: { include: { secondaryPoles: true } } } }, tasks: { select: { id: true, personId: true } } };
export type RequestRow = Awaited<ReturnType<typeof loadRequests>>[number];

type Viewer = { id: string; role: string; poleId: string | null };

// Périmètre (retour de Gaël, 14/09 : « tout le monde ne doit pas voir les demandes de tout le monde »).
// Je vois une demande si j'y suis partie prenante (demandeur, destinataire, pôle destinataire), si je pilote l'édition concernée,
// si je suis responsable du pôle du demandeur, du destinataire ou du projet ; direction et RAF voient tout.
export function canSeeRequest(me: Viewer, r: { requesterId: string; assigneeId: string | null; poleId: string | null; requester: { poleId: string | null }; assignee: { poleId: string | null } | null; edition: { project: { pilotId: string; poleId: string; secondaryPoles: { poleId: string }[] } } | null }): boolean {
  if (me.role === "director" || me.role === "raf") return true;
  if (r.requesterId === me.id || isForMe(me, r)) return true;
  if (r.edition?.project.pilotId === me.id) return true;
  if (me.role === "pole_lead" && me.poleId) {
    const poles = [r.poleId, r.requester.poleId, r.assignee?.poleId, r.edition?.project.poleId, ...(r.edition?.project.secondaryPoles ?? []).map((x) => x.poleId)];
    return poles.includes(me.poleId);
  }
  return false;
}

// Même logique pour une validation : le demandeur, qui peut la décider, le pilote de l'édition, le responsable du pôle du projet ; direction et RAF.
export function canSeeValidation(me: Viewer, v: { requesterId: string; requiredLevel: number; edition: { project: { pilotId: string; poleId: string; secondaryPoles?: { poleId: string }[] } } }): boolean {
  if (me.role === "director" || me.role === "raf") return true;
  if (v.requesterId === me.id || v.edition.project.pilotId === me.id) return true;
  if (me.role === "pole_lead" && me.poleId) return [v.edition.project.poleId, ...(v.edition.project.secondaryPoles ?? []).map((x) => x.poleId)].includes(me.poleId);
  return canDecideValidation(me, v);
}

// Libellé du troisième onglet de /demandes selon ce que la personne peut voir ; null quand il n'apporterait rien de plus.
export function wideViewLabel(role: string): string | null {
  if (role === "director" || role === "raf") return "Toute la CRESS";
  if (role === "pole_lead") return "Mon pôle";
  if (role === "pilot") return "Mes projets";
  return null;
}

export async function loadRequests(me: Viewer) {
  const rows = await prisma.request.findMany({ include: requestInclude, orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }] });
  return rows.filter((r) => canSeeRequest(me, r));
}

// Une demande « me concerne » si elle m'est adressée, ou adressée à mon pôle (son responsable la voit d'abord).
export function isForMe(me: { id: string; role: string; poleId: string | null }, r: { assigneeId: string | null; poleId: string | null }): boolean {
  if (r.assigneeId) return r.assigneeId === me.id;
  if (r.poleId) return me.poleId === r.poleId || me.role === "director";
  return false;
}

export const ageDays = (d: Date) => dayjs().diff(dayjs(d), "day");
