"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { duplicateAction } from "@/app/actions/edition";
import { cn } from "@/lib/utils";

// Sous une action : sa petite fiche (contenu, lieu, participants) et « Dupliquer » pour les occurrences (petits-déjeuners, forums SPRO).
export function ActionExtrasToggle({ actionId, filled, index, canDuplicate, children }: { actionId: string; filled: number; index: number; canDuplicate: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-0.5 rounded-sm px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-primary" aria-expanded={open} data-testid={`action-details-${index}`} title="Contenu, lieu, participants">
          <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />{filled ? `${filled}/3` : "détails"}
        </button>
        {canDuplicate && (
          <button type="button" disabled={pending} onClick={() => start(async () => { const r = await duplicateAction(actionId); if (!r.ok) toast.error(r.error); else { toast.success("Action dupliquée : renommez-la et posez son jalon"); router.refresh(); } })} className="inline-flex items-center gap-0.5 rounded-sm px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-primary" data-testid={`action-duplicate-${index}`} title="Dupliquer (même contenu, lieu, participants ; jalon à poser)">
            <Copy className="size-3" />dupliquer
          </button>
        )}
      </div>
      {open && <div className="mt-1 grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-3" data-testid={`action-extras-${index}`}>{children}</div>}
    </>
  );
}

export function DuplicateActionButton({ actionId }: { actionId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <Button size="xs" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await duplicateAction(actionId); if (!r.ok) toast.error(r.error); else router.refresh(); })}><Copy />Dupliquer</Button>;
}
