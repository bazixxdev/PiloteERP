"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PROJECT_STATES } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { V } from "@/lib/vocab";

// Recherche et filtre par état (dans l'adresse : ?q=&etat=).
export function ProjectsToolbar({ q, etat, counts }: { q: string; etat: string; counts: Record<string, number> }) {
  const router = useRouter();
  const go = (patch: Record<string, string>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ q, etat, ...patch })) if (v) p.set(k, v); router.push(`/projets${p.toString() ? `?${p.toString()}` : ""}`); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form className="relative" onSubmit={(e) => { e.preventDefault(); go({ q: ((new FormData(e.currentTarget).get("q") as string) ?? "").trim() }); }}>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder={`Projet, code, ${V.pole.one}, ${V.pilote.one}…`} className="h-8 w-56 pl-8 text-xs" aria-label="Rechercher un projet" data-testid="projects-search" />
      </form>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => go({ etat: "" })} className={cn("rounded-full border px-2 py-0.5 text-[11px]", !etat ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")} data-testid="projects-state-all">Actifs</button>
        {Object.entries(PROJECT_STATES).map(([k, s]) => <button key={k} type="button" title={s.hint} onClick={() => go({ etat: etat === k ? "" : k })} className={cn("rounded-full border px-2 py-0.5 text-[11px]", etat === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")} data-testid={`projects-state-${k}`}>{s.label}{counts[k] ? ` · ${counts[k]}` : ""}</button>)}
      </div>
    </div>
  );
}
