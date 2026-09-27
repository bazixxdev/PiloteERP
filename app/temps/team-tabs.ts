import type { PageTab } from "@/components/shell/page-tabs";

// Onglets de « Temps de l'équipe » (spec menu § 6.3 et § 6.6) : chacun selon son droit, jamais selon le fait de saisir soi-même.
export function teamTabs(current: "equipe" | "cloture", can: { team: boolean; close: boolean }): PageTab[] {
  return [
    ...(can.team ? [{ href: "/temps?equipe=1", label: "Temps de l'équipe", active: current === "equipe" }] : []),
    ...(can.close ? [{ href: "/cloture", label: "Clôture", active: current === "cloture" }] : []),
  ];
}
