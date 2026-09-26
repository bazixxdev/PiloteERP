"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setActionPeople } from "@/app/actions/actions";
import { cn } from "@/lib/utils";

// Personnes associées à l'action, sur le modèle de l'équipe d'une année (team-picker.tsx) : toutes les personnes actives, y
// compris celles qui ne suivent pas leur temps. Un clic ajoute ou retire ; la liste entière part d'un coup.
export function PeoplePicker({ actionId, people, selected, readOnly }: { actionId: string; people: { id: string; name: string }[]; selected: string[]; readOnly: boolean }) {
  const [sel, setSel] = useState(new Set(selected));
  const [pending, start] = useTransition();
  const router = useRouter();
  const key = selected.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setSel(new Set(selected)), [key]);
  const toggle = (id: string) => {
    if (readOnly) return;
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSel(next);
    start(async () => {
      const res = await setActionPeople(actionId, [...next]);
      if (!res.ok) { toast.error(res.error); setSel(new Set(selected)); return; }
      router.refresh();
    });
  };
  return (
    <div className={cn("flex flex-wrap gap-1.5", pending && "opacity-60")}>
      {people.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={readOnly}
          aria-pressed={sel.has(p.id)}
          onClick={() => toggle(p.id)}
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-colors",
            sel.has(p.id) ? "border-primary bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted",
            readOnly && !sel.has(p.id) && "hidden",
          )}
        >
          {p.name}
        </button>
      ))}
      {readOnly && sel.size === 0 && <span className="text-sm text-muted-foreground">Aucune personne associée.</span>}
    </div>
  );
}
