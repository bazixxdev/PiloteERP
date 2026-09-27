import type { PageTab } from "@/components/shell/page-tabs";

// Onglets de « Temps de l'équipe » (spec menu § 6.3 et § 6.6) : chacun selon son droit, jamais selon le fait de saisir soi-même.
// Remplace l'ancien TimeNav (« Ma répartition / Temps de l'équipe / Clôture mensuelle ») : « Ma répartition » n'est plus un
// onglet — Mon temps est sa propre entrée de menu, sans barre. `teamHref` garde la cible historique du bouton « Temps de
// l'équipe » (la première personne visible, semaine courante) quand elle est connue.
export function teamTabs(current: "equipe" | "cloture", can: { team: boolean; close: boolean; teamHref?: string }): PageTab[] {
  return [
    ...(can.team ? [{ href: can.teamHref ?? "/temps?equipe=1", label: "Temps de l'équipe", active: current === "equipe", testId: "team-tab-equipe" }] : []),
    ...(can.close ? [{ href: "/cloture", label: "Clôture", active: current === "cloture", testId: "team-tab-cloture" }] : []),
  ];
}
