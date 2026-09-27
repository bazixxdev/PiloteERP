import type { PageTab } from "@/components/shell/page-tabs";
import { V, pl } from "@/lib/vocab";

// « Tous les {projets} » et, à côté, la vue par personne : « Portefeuille » pour le {CODIR}, « Mes {projets} » pour les autres
// (même page /portefeuille, spec menu § 6.4).
export function projectTabs(current: "tous" | "portefeuille", codir: boolean): PageTab[] {
  return [
    { href: "/projets", label: `Tous les ${pl(V.projet)}`, active: current === "tous" },
    { href: "/portefeuille", label: codir ? "Portefeuille" : `Mes ${pl(V.projet)}`, active: current === "portefeuille" },
  ];
}
