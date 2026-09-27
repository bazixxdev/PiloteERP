import type { PageTab } from "@/components/shell/page-tabs";

// Onglets de « Matériel et prêts » (spec menu § 2) : les prêts (en cours, terminés), puis l'inventaire — même barre sur
// /materiel/prets et /materiel, pour ne pas écrire la liste deux fois.
export function materielTabs(current: "encours" | "termines" | "inventaire"): PageTab[] {
  return [
    { href: "/materiel/prets", label: "Prêts en cours", active: current === "encours" },
    { href: "/materiel/prets?vue=termines", label: "Prêts terminés", active: current === "termines" },
    { href: "/materiel", label: "Inventaire", active: current === "inventaire" },
  ];
}
