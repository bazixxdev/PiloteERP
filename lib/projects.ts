// Projets (lot 1 du 19/09, retour de Gaël) : la liste dit l'état, la fiche porte le reste. L'état se déduit des éditions :
// en cours (une édition validée ou en cours cette année ou après), à l'étude (seulement des éditions proposées ou
// re-challengées à venir), terminé (des éditions, toutes closes, aucune à venir), sans édition, ou archivé (rangé à la main).
export const PROJECT_STATES: Record<string, { label: string; color: string; hint: string }> = {
  active: { label: "En cours", color: "primary", hint: "Une édition validée ou en cours, cette année ou après." },
  study: { label: "À l'étude", color: "info", hint: "Seulement des éditions proposées ou re-challengées : on décide." },
  done: { label: "Terminé", color: "muted", hint: "Des éditions, toutes closes, aucune à venir." },
  none: { label: "Sans édition", color: "warning", hint: "Le projet existe, aucune édition n'est ouverte." },
  archived: { label: "Archivé", color: "muted", hint: "Rangé : ses éditions restent lisibles." },
};

export function projectState(p: { archived: boolean; editions: { year: number; status: string }[] }, year = new Date().getFullYear()): keyof typeof PROJECT_STATES {
  if (p.archived) return "archived";
  const coming = p.editions.filter((e) => e.year >= year);
  if (coming.some((e) => e.status === "in_progress" || e.status === "validated")) return "active";
  if (coming.some((e) => e.status === "proposed" || e.status === "rechallenged")) return "study";
  if (p.editions.length === 0) return "none";
  return coming.length === 0 ? "done" : "study";
}
