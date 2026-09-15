import { DEADLINE_KIND } from "./deadline-notifications";

// Familles de notifications, déduites de la nature et du lien (les producteurs n'écrivent qu'un `kind` grossier) :
// c'est le filtre de /notifications. Une famille absente de la liste tombe dans « autres ».
export type NotificationFamily = "echeances" | "temps" | "demandes" | "projets" | "notes" | "autres";

export const FAMILY_LABEL: Record<NotificationFamily, string> = {
  echeances: "Échéances",
  temps: "Temps",
  demandes: "Demandes",
  projets: "Projets",
  notes: "Notes",
  autres: "Autres",
};

export function familyOf(n: { kind: string; link: string | null; title: string }): NotificationFamily {
  if (n.kind === DEADLINE_KIND) return "echeances";
  if (n.kind === "time_reminder" || n.link?.startsWith("/temps")) return "temps";
  if (n.link?.startsWith("/demandes") || n.link?.startsWith("/validations") || /^Demande\b/.test(n.title)) return "demandes";
  if (n.link?.startsWith("/notes")) return "notes";
  if (n.link?.startsWith("/edition") || n.link?.startsWith("/projets")) return "projets";
  return "autres";
}
