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
  { key: "documents", label: "Documents et discussion" },
  { key: "bilan", label: "Bilan" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export function TabsNav({ editionId, current, counts }: { editionId: string; current: TabKey; counts: Partial<Record<TabKey, number>> }) {
  return (
    <nav className="mb-5 flex flex-wrap gap-1 border-b" role="tablist" data-testid="edition-tabs">
      {TABS.map((t) => (
        <Link
          key={t.key}
          role="tab"
          aria-selected={t.key === current}
          href={`/edition/${editionId}?onglet=${t.key}`}
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            t.key === current ? "border-coral text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {counts[t.key] ? <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{counts[t.key]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
