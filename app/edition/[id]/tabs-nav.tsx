"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { V, cap, du, pl } from "@/lib/vocab";

// Six onglets (revue du 15/09) : l'Aperçu atterrit sur l'état du projet ; Validations → Aperçu et Demandes ; Bilan → Fiche et Actions.
export const TABS = [
  { key: "apercu", label: "Aperçu" },
  { key: "fiche", label: "Fiche" },
  { key: "actions", label: `${cap(pl(V.action))}` },
  { key: "budget", label: "Budget" },
  { key: "temps", label: "Temps" },
  { key: "documents", label: "Documents" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

// Onglets V2 : soulignement corail, compteur discret, défilement horizontal si l'écran est étroit.
export function TabsNav({ editionId, current, counts }: { editionId: string; current: TabKey; counts: Partial<Record<TabKey, number>> }) {
  return (
    <nav className="-mx-4 mb-5 flex overflow-x-auto border-b px-[6px] md:-mx-6 md:px-[14px]" role="tablist" aria-label={`Contenu ${du(V.edition)}`} data-testid="edition-tabs">
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
