"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export const TABS = [
  { key: "fiche", label: "Fiche" },
  { key: "actions", label: "Actions" },
  { key: "financements", label: "Financements" },
  { key: "temps", label: "Temps" },
  { key: "budget", label: "Budget" },
  { key: "validations", label: "Validations" },
  { key: "documents", label: "Documents" },
  { key: "bilan", label: "Bilan" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

// Onglets V2 : soulignement corail, compteur discret, défilement horizontal si l'écran est étroit.
export function TabsNav({ editionId, current, counts }: { editionId: string; current: TabKey; counts: Partial<Record<TabKey, number>> }) {
  return (
    <nav className="-mx-4 mb-5 flex overflow-x-auto border-b px-[6px] md:-mx-6 md:px-[14px]" role="tablist" aria-label="Contenu de l'édition" data-testid="edition-tabs">
      {TABS.map((t) => (
        <Link
          key={t.key}
          role="tab"
          aria-selected={t.key === current}
          href={`/edition/${editionId}?onglet=${t.key}`}
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 px-[13px] py-3 text-xs whitespace-nowrap transition-colors",
            t.key === current ? "border-coral font-bold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {counts[t.key] ? <small className="text-[10px] font-normal text-muted-foreground">{counts[t.key]}</small> : null}
        </Link>
      ))}
    </nav>
  );
}
