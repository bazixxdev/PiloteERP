import Link from "next/link";
import { cn } from "@/lib/utils";

export type PageTab = { href: string; label: string; active: boolean; count?: number; testId?: string };

// Onglets d'une page (spec menu § 2 : une vue d'une même liste = un onglet, pas une entrée de menu). Pilotés par l'adresse :
// chaque onglet est un lien, l'actif est calculé par la page serveur. Même dessin que les onglets d'une année (tabs-nav.tsx).
export function PageTabs({ tabs, testId }: { tabs: PageTab[]; testId?: string }) {
  if (tabs.length < 2) return null;
  return (
    <nav role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b" data-testid={testId}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          role="tab"
          aria-selected={t.active}
          data-testid={t.testId}
          className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", t.active ? "border-coral font-bold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          {t.label}{t.count !== undefined && <span className="ml-1 text-xs text-muted-foreground">({t.count})</span>}
        </Link>
      ))}
    </nav>
  );
}
