// Modules activables par personne (Mon compte) : un module coupé disparaît de la navigation et de Ma semaine.
// « Simon n'a pas besoin de to-do : pourquoi l'embêter ? » (retour du 14/09).
import { has, leadsPole, type Actor } from "./rights";
import { V, cap, le, de, mon, tout } from "@/lib/vocab";

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

// Modules activables par installation (lot 0, docs/produit.md) : réglés dans l'admin, pour toute la structure. Un module
// éteint disparaît de la navigation et répond « introuvable » à ses adresses ; ses données restent en base.
export const INSTANCE_MODULES = [
  { key: "veille", label: "Appels à projets (veille)", hint: "Les appels à projets repérés par financeur, le statut d'équipe (à étudier, on dépose, écarté) et la promotion en convention. Onglet dans Projets et financements." },
  { key: "adherents", label: "Adhérents", hint: "Les adhésions par année (structures ou personnes de l'annuaire, collège, cotisation, règlement), la reconduction, le connecteur HelloAsso. Rubrique « Adhérents » dans le menu." },
  { key: "tresorerie", label: "Trésorerie", hint: `Plan de trésorerie mensuel sur douze mois : versements attendus des financeurs, factures et engagements, cotisations, règles de flux (salaires, loyer…), solde et point bas. Rubrique « Trésorerie » (${V.direction.one}, ${V.raf.one}, responsables ${de(V.pole)}).` },
  { key: "materiel", label: "Matériel et prêts", hint: "L'inventaire du matériel prêtable (vidéoprojecteur, kakemonos, enceinte…) et le registre des prêts à l'équipe, aux contacts et aux organisations, avec les retours attendus. Rubrique « Matériel »." },
] as const;

export type InstanceModuleKey = (typeof INSTANCE_MODULES)[number]["key"];

export function instanceHas(settings: { modules: string }, key: InstanceModuleKey): boolean {
  return modulesOf(settings).has(key);
}

// Visibilité d'une liste ou d'une note : qui peut la lire, en plus de son auteur.
export const VISIBILITIES = [
  { value: "private", label: "Privée", hint: "Moi seul·e" },
  { value: "pole_lead", label: "Mon responsable", hint: `Moi et le responsable de ${mon(V.pole)} (ou ${le(V.direction)} si je suis transversal·e)` },
  { value: "pole", label: cap(mon(V.pole)), hint: `Toute l'équipe de ${mon(V.pole)}` },
  { value: "all", label: cap(tout(V.org)), hint: "Tout le monde" },
] as const;

export function canReadShared(
  viewer: Actor & { id: string; poleId: string | null },
  owner: { id: string; poleId: string | null },
  visibility: string,
): boolean {
  if (viewer.id === owner.id) return true;
  if (visibility === "all") return true;
  if (visibility === "pole") return owner.poleId !== null && viewer.poleId === owner.poleId || (owner.poleId === null && has(viewer, "scope.all"));
  if (visibility === "pole_lead") return leadsPole(viewer, owner.poleId !== null && viewer.poleId === owner.poleId) || has(viewer, "edition.edit_all") || (owner.poleId === null && has(viewer, "time.view_all"));
  return false;
}
