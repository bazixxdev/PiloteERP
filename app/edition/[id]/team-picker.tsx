"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setTeam } from "@/app/actions/edition";
import { cn } from "@/lib/utils";

export function TeamPicker({ editionId, people, selected, readOnly }: { editionId: string; people: { id: string; name: string }[]; selected: string[]; readOnly: boolean }) {
  const [sel, setSel] = useState(new Set(selected));
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = (id: string) => {
    if (readOnly) return;
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSel(next);
    start(async () => {
      const res = await setTeam(editionId, [...next]);
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
      {readOnly && sel.size === 0 && <span className="text-sm text-muted-foreground">Aucune personne.</span>}
    </div>
  );
}
