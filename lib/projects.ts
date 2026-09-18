// Projets (lot 1 du 19/09, retour de Gaël) : la liste dit l'état, la fiche porte le reste. L'état se déduit des éditions :
// en cours (une édition validée ou en cours cette année ou après), à l'étude (seulement des éditions proposées ou
// re-challengées à venir), terminé (des éditions, toutes closes, aucune à venir), sans édition, ou archivé (rangé à la main).
import { V, cap, un, aucun, e, pl } from "@/lib/vocab";
export const PROJECT_STATES: Record<string, { label: string; color: string; hint: string }> = {
  active: { label: "En cours", color: "primary", hint: `${cap(un(V.edition))} validé${e(V.edition)} ou en cours, cette année ou après.` },
  study: { label: "À l'étude", color: "info", hint: `Seulement des ${pl(V.edition)} proposé${e(V.edition)}s ou re-challengé${e(V.edition)}s : on décide.` },
  done: { label: "Terminé", color: "muted", hint: `Des ${pl(V.edition)}, ${V.edition.gender === "f" ? "toutes closes, aucune" : "tous clos, aucun"} à venir.` },
  none: { label: `Sans ${V.edition.one}`, color: "warning", hint: `Le ${V.projet.one} existe, ${aucun(V.edition)} n'est ouvert${e(V.edition)}.` },
  archived: { label: "Archivé", color: "muted", hint: `Rangé : ses ${pl(V.edition)} restent lisibles.` },
};

export function projectState(p: { archived: boolean; editions: { year: number; status: string }[] }, year = new Date().getFullYear()): keyof typeof PROJECT_STATES {
  if (p.archived) return "archived";
  const coming = p.editions.filter((e) => e.year >= year);
  if (coming.some((e) => e.status === "in_progress" || e.status === "validated")) return "active";
  if (coming.some((e) => e.status === "proposed" || e.status === "rechallenged")) return "study";
  if (p.editions.length === 0) return "none";
  return coming.length === 0 ? "done" : "study";
}
