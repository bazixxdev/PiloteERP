import { prisma } from "./db";
import { dayjs } from "./format";
import { canDecideValidation, canTreatAllRequests, has, type Actor } from "./rights";
import { V, cap, tout } from "@/lib/vocab";

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

type Viewer = Actor & { id: string; poleId: string | null };

// Périmètre (retour de Gaël, 14/09 : « tout le monde ne doit pas voir les demandes de tout le monde »).
// Je vois une demande si j'y suis partie prenante (demandeur, destinataire, pôle destinataire), si je pilote l'édition concernée,
// si je suis responsable du pôle du demandeur, du destinataire ou du projet ; qui traite toute demande (direction, RAF) voit tout.
export function canSeeRequest(me: Viewer, r: { requesterId: string; assigneeId: string | null; poleId: string | null; requester: { poleId: string | null }; assignee: { poleId: string | null } | null; edition: { project: { pilotId: string; poleId: string; secondaryPoles: { poleId: string }[] } } | null }): boolean {
  if (canTreatAllRequests(me)) return true;
  if (r.requesterId === me.id || isForMe(me, r)) return true;
  if (r.edition?.project.pilotId === me.id) return true;
  if (has(me, "pole.manage") && me.poleId) {
    const poles = [r.poleId, r.requester.poleId, r.assignee?.poleId, r.edition?.project.poleId, ...(r.edition?.project.secondaryPoles ?? []).map((x) => x.poleId)];
    return poles.includes(me.poleId);
  }
  return false;
}

// Même logique pour une validation : le demandeur, qui peut la décider, le pilote de l'édition, le responsable du pôle du projet ; direction et RAF.
export function canSeeValidation(me: Viewer, v: { requesterId: string; requiredLevel: number; edition: { project: { pilotId: string; poleId: string; secondaryPoles?: { poleId: string }[] } } }): boolean {
  if (canTreatAllRequests(me)) return true;
  if (v.requesterId === me.id || v.edition.project.pilotId === me.id) return true;
  if (has(me, "pole.manage") && me.poleId) return [v.edition.project.poleId, ...(v.edition.project.secondaryPoles ?? []).map((x) => x.poleId)].includes(me.poleId);
  return canDecideValidation(me, v);
}

// Troisième onglet de /demandes : « Toute la CRESS », pour la direction seulement (retour de Gaël, 18/09) — la seule action y
// est le réaiguillage. Les responsables de pôle et les pilotes voient leurs demandes dans les deux premiers onglets.
export function wideViewLabel(me: Actor & { role?: string }): string | null {
  return me.role === "director" ? cap(tout(V.org)) : null;
}

export async function loadRequests(me: Viewer) {
  const rows = await prisma.request.findMany({ include: requestInclude, orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }] });
  return rows.filter((r) => canSeeRequest(me, r));
}

// Une demande « me concerne » si elle m'est adressée, ou adressée à mon pôle (son responsable la voit d'abord).
export function isForMe(me: Viewer, r: { assigneeId: string | null; poleId: string | null }): boolean {
  if (r.assigneeId) return r.assigneeId === me.id;
  if (r.poleId) return me.poleId === r.poleId || canTreatAllRequests(me);
  return false;
}

// « À traiter par moi » : ce qui me concerne, plus tout pour la direction et les demandes du pôle pour son responsable.
// Même règle pour la vue de la page et le badge de la barre latérale : les deux nombres doivent être identiques.
export function canTreatRequest(me: Viewer, r: { assigneeId: string | null; poleId: string | null }): boolean {
  return isForMe(me, r) || canTreatAllRequests(me) || (Boolean(r.poleId) && has(me, "pole.manage") && me.poleId === r.poleId);
}

export const ageDays = (d: Date) => dayjs().diff(dayjs(d), "day");
