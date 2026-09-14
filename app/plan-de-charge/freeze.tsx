"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { freezeLoad } from "@/app/actions/load";

// Figer le plan de charge d'une année (au séminaire) : après, on modifie encore, mais tracé et signalé — rien ne bouge en silence.
export function FreezeControl({ year, frozen, canFreeze }: { year: number; frozen: { at: string; by: string; note: string | null } | null; canFreeze: boolean }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const router = useRouter();
  const run = (freeze: boolean) => start(async () => { const r = await freezeLoad(year, freeze, note); if (!r.ok) toast.error(r.error); else { toast.success(freeze ? `Plan de charge ${year} figé` : `Plan de charge ${year} rouvert`); router.refresh(); } });
  if (frozen) {
    return (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/60 px-3.5 py-2 text-xs" data-testid="load-frozen">
        <span className="inline-flex items-center gap-1.5"><Lock className="size-3.5 text-muted-foreground" /><b>Plan de charge {year} validé le {frozen.at}</b> par {frozen.by}{frozen.note ? ` — ${frozen.note}` : ""}. Les modifications restent possibles ; chacune est tracée dans l'historique de l'édition et signalée à la RAF et à la direction.</span>
        {canFreeze && <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(false)} data-testid="load-unfreeze"><LockOpen />Rouvrir</Button>}
      </div>
    );
  }
  if (!canFreeze) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3.5 py-2 text-xs" data-testid="load-freeze-bar">
      <span className="text-muted-foreground">Plan de charge {year} non figé : après le séminaire, figez-le pour que chaque modification soit tracée.</span>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (séminaire du 10/12…)" aria-label="Note" className="h-7 rounded-md border bg-card px-2 text-xs" />
      <Button size="xs" disabled={pending} onClick={() => run(true)} data-testid="load-freeze"><Lock />Figer le plan de charge {year}</Button>
    </div>
  );
}
