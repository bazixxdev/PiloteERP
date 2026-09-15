"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Ed = { id: string; year: number; statusLabel: string };

// Choix de l'édition : des puces tant que le projet a trois éditions au plus, un sélecteur au-delà
// (un projet récurrent accumule une édition par an ; à huit ans, les puces déborderaient).
export function EditionPicker({ editions, currentId }: { editions: Ed[]; currentId: string }) {
  const router = useRouter();
  const sorted = [...editions].sort((a, b) => b.year - a.year);
  if (sorted.length <= 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[5px] border bg-card px-1.5 py-1 text-[11px]" data-testid="edition-years">
        {/* « Édition » écrit une fois, puis les années : l'en-tête tient sur une ligne (revue du 15/09). */}
        <span className="pl-0.5 text-muted-foreground">Édition</span>
        {[...sorted].reverse().map((x) => (
          <Link key={x.id} href={`/edition/${x.id}`} aria-current={x.id === currentId ? "page" : undefined} aria-label={`Édition ${x.year}`} title={`Édition ${x.year} · ${x.statusLabel}`} className={cn("rounded-sm px-1.5 py-0.5", x.id === currentId ? "bg-primary font-semibold text-white" : "text-muted-foreground hover:bg-muted")}>{x.year}</Link>
        ))}
      </span>
    );
  }
  return (
    <label className="inline-flex items-center gap-1.5 rounded-[5px] border bg-card px-2 py-1 text-[11px]" data-testid="edition-years">
      <span className="text-muted-foreground">{sorted.length} éditions</span>
      <select className="border-0 bg-transparent text-[11px] font-semibold text-primary focus:outline-none" value={currentId} onChange={(ev) => router.push(`/edition/${ev.target.value}`)} aria-label="Choisir l'édition">
        {sorted.map((x) => <option key={x.id} value={x.id}>Édition {x.year} · {x.statusLabel}</option>)}
      </select>
    </label>
  );
}
