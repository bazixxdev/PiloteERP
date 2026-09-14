// Modules activables par personne (Mon compte) : un module coupé disparaît de la navigation et de Ma semaine.
// « Simon n'a pas besoin de to-do : pourquoi l'embêter ? » (retour du 14/09).
export const MODULES = [
  { key: "tasks", label: "Tâches", hint: "Listes de tâches, échéances et créneaux, avec ou sans projet." },
  { key: "notes", label: "Notes", hint: "Notes de réunion, rattachées à un projet ou transverses." },
  { key: "split", label: "Répartition en parts", hint: "Répartir la semaine en parts de mon temps plutôt qu'en heures par jour." },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export function modulesOf(p: { modules: string }): Set<string> {
  return new Set(p.modules.split(",").map((x) => x.trim()).filter(Boolean));
}

export function hasModule(p: { modules: string }, key: ModuleKey): boolean {
  return modulesOf(p).has(key);
}

// Visibilité d'une liste ou d'une note : qui peut la lire, en plus de son auteur.
export const VISIBILITIES = [
  { value: "private", label: "Privée", hint: "Moi seul·e" },
  { value: "pole_lead", label: "Mon responsable", hint: "Moi et le responsable de mon pôle (ou la direction si je suis transversal·e)" },
  { value: "pole", label: "Mon pôle", hint: "Toute l'équipe de mon pôle" },
  { value: "all", label: "Toute la CRESS", hint: "Tout le monde" },
] as const;

export function canReadShared(
  viewer: { id: string; role: string; poleId: string | null },
  owner: { id: string; poleId: string | null },
  visibility: string,
): boolean {
  if (viewer.id === owner.id) return true;
  if (visibility === "all") return true;
  if (visibility === "pole") return owner.poleId !== null && viewer.poleId === owner.poleId || (owner.poleId === null && ["director", "raf", "assistant"].includes(viewer.role));
  if (visibility === "pole_lead") return (viewer.role === "pole_lead" && owner.poleId !== null && viewer.poleId === owner.poleId) || viewer.role === "director" || (owner.poleId === null && viewer.role === "raf");
  return false;
}
