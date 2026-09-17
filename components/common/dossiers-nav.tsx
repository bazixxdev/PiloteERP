import Link from "next/link";
import { cn } from "@/lib/utils";
import { getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";

// Sous-navigation « Projets et financements » : projets et éditions, conventions, financeurs — une entrée de barre latérale, trois onglets ;
// un quatrième, « Appels à projets », quand le module veille est allumé (lot 0 / lot B). Composant serveur : il lit les réglages lui-même.
export async function DossiersNav({ current }: { current: "projets" | "conventions" | "financeurs" | "organisations" | "matrice" | "appels" }) {
  const veille = instanceHas(await getSettings(), "veille");
  const tab = (key: typeof current, label: string, href: string) => (
    <Link key={key} href={href} data-testid={`dossiers-nav-${key}`} aria-current={current === key ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", current === key ? "border-coral text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</Link>
  );
  return (
    <nav className="subnav mb-4 flex flex-wrap gap-1 border-b" data-testid="dossiers-nav" aria-label="Projets et financements">
      {tab("projets", "Projets et éditions", "/projets")}
      {tab("conventions", "Conventions", "/conventions")}
      {tab("financeurs", "Financeurs", "/financeurs")}
      {tab("organisations", "Organisations", "/organisations")}
      {tab("matrice", "Qui finance quoi", "/matrice")}
      {veille && tab("appels", "Appels à projets", "/appels")}
    </nav>
  );
}
