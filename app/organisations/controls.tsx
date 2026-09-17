"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createOrganisation, setOrganisationKind } from "@/app/actions/organisations";
import { ORGANISATION_KINDS, type OrganisationKind } from "@/lib/organisations";
import { cn } from "@/lib/utils";

// Filtre par genre (pastilles) et recherche par nom, dans l'adresse (?genre=&q=).
export function KindFilter({ current, q, counts }: { current: OrganisationKind | null; q: string; counts: Record<string, number> }) {
  const router = useRouter();
  const href = (k: OrganisationKind | null, query = q) => `/organisations${k || query ? `?${new URLSearchParams({ ...(k ? { genre: k } : {}), ...(query ? { q: query } : {}) }).toString()}` : ""}`;
  const pill = (k: OrganisationKind | null, label: string, n?: number) => (
    <Link key={k ?? "all"} href={href(k)} className={cn("inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium", current === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")} data-testid={`kind-${k ?? "all"}`}>{label}{n !== undefined && <span className="ml-1 opacity-70">({n})</span>}</Link>
  );
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {pill(null, "Toutes")}
      {ORGANISATION_KINDS.map((k) => pill(k.key, k.plural, counts[k.key] ?? 0))}
      <form className="ml-auto" onSubmit={(e) => { e.preventDefault(); const v = (new FormData(e.currentTarget).get("q") as string) ?? ""; router.push(href(current, v.trim())); }}>
        <Input name="q" defaultValue={q} placeholder="Rechercher un nom…" className="h-8 w-56 text-xs" aria-label="Rechercher une organisation" data-testid="organisation-search" />
      </form>
    </div>
  );
}

// Créer : un nom et des genres cochés.
export function CreateOrganisationForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kinds, setKinds] = useState<string[]>(["partner"]);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button size="sm" data-testid="organisation-add-open"><Plus />Nouvelle organisation</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await createOrganisation(name, kinds); if (!r.ok) { toast.error(r.error); return; } toast.success("Organisation ajoutée"); setOpen(false); setName(""); router.push(`/organisations?organisation=${r.data!.id}`); router.refresh(); }); }}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'organisation" className="h-8" data-testid="organisation-add-name" />
          <div className="grid gap-1">
            {ORGANISATION_KINDS.map((k) => (
              <label key={k.key} className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={kinds.includes(k.key)} onChange={(e) => setKinds((s) => (e.target.checked ? [...s, k.key] : s.filter((x) => x !== k.key)))} className="mt-0.5 size-3.5 accent-primary" data-testid={`organisation-add-kind-${k.key}`} />
                <span><b className="font-medium">{k.label}</b> <span className="text-muted-foreground">· {k.hint}</span></span>
              </label>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={pending || !name.trim()} data-testid="organisation-add-submit">Créer</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// Genres d'une organisation existante (fiche) : cocher / décocher, avec les garde-fous côté serveur.
export function KindToggles({ id, kinds, readOnly }: { id: string; kinds: string[]; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="organisation-kinds">
      {ORGANISATION_KINDS.map((k) => {
        const on = kinds.includes(k.key);
        return (
          <label key={k.key} title={k.hint} data-testid={`organisation-kind-${k.key}`} data-on={on ? "1" : "0"} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", on ? "border-primary bg-info-soft text-primary" : "bg-card text-muted-foreground", (readOnly || pending) && "cursor-default opacity-80")}>
            <input type="checkbox" className="sr-only" checked={on} disabled={readOnly || pending} onChange={(e) => start(async () => { const r = await setOrganisationKind(id, k.key, e.target.checked); if (!r.ok) toast.error(r.error); router.refresh(); })} />
            {k.label}
          </label>
        );
      })}
    </div>
  );
}
