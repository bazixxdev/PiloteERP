"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setNoteShares } from "@/app/actions/notes";
import { cn } from "@/lib/utils";

export type PersonOpt = { id: string; name: string; poleName: string | null };

// Partage nominatif (retour du 14/09 : « on peut partager nominativement ? ») : cocher des collègues, en plus de la visibilité.
// Chaque personne ajoutée reçoit une notification en cloche.
export function ShareWith({ noteId, people, sharedWith, disabled }: { noteId: string | null; people: PersonOpt[]; sharedWith: { id: string }[]; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<Set<string>>(new Set(sharedWith.map((p) => p.id)));
  const [q, setQ] = useState("");
  const toggle = (id: string) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id); else next.add(id);
    setIds(next);
    if (!noteId) return;
    start(async () => {
      const r = await setNoteShares(noteId, [...next]);
      if (!r.ok) { toast.error(r.error); return; }
      if (r.data!.added) toast.success(r.data!.added > 1 ? `${r.data!.added} personnes prévenues` : "Personne prévenue");
      router.refresh();
    });
  };
  const shown = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  const names = people.filter((p) => ids.has(p.id)).map((p) => p.name.split(" ")[0]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled || !noteId} title={noteId ? "Partager avec des collègues nommés" : "Écrivez d'abord un titre : la note sera créée, puis partageable"} className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50", ids.size > 0 && "border-primary/40 text-primary")} data-testid="note-share">
          <UserPlus className="size-3" />{ids.size === 0 ? "Partager avec…" : names.length <= 2 ? names.join(", ") : `${names[0]} +${names.length - 1}`}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="mb-1 text-[11px] font-semibold">Partager nominativement</div>
        <p className="mb-2 text-[10px] text-muted-foreground">En plus de la visibilité. La personne est prévenue et lit la note, sans la modifier.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un collègue…" aria-label="Chercher un collègue" className="mb-1.5 h-7 w-full rounded-md border bg-background px-2 text-[11px]" />
        <div className="max-h-56 overflow-y-auto" data-testid="note-share-list">
          {shown.map((p) => (
            <button key={p.id} type="button" disabled={pending} onClick={() => toggle(p.id)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-muted" data-testid={`note-share-${p.id}`} aria-pressed={ids.has(p.id)}>
              <span className={cn("grid size-4 shrink-0 place-items-center rounded border", ids.has(p.id) && "border-primary bg-primary text-white")}>{ids.has(p.id) && <Check className="size-3" />}</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.poleName && <span className="truncate text-[10px] text-muted-foreground">{p.poleName}</span>}
            </button>
          ))}
          {shown.length === 0 && <p className="px-1.5 py-1 text-[11px] text-muted-foreground">Personne ne correspond.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
