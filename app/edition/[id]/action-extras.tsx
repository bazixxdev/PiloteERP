"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { duplicateAction } from "@/app/actions/edition";
import { RowPanel } from "@/components/common/row-panel";

// Le détail d'une action s'ouvre en panneau (revue du 15/09) : contenu, lieu, participants, ligne de financement, public,
// tâches liées, réalisations, temps par personne ; « Dupliquer » y vit aussi (occurrences : petits-déjeuners, forums SPRO).
export function ActionPanel({ actionId, name, index, hints = [], canDuplicate, children }: { actionId: string; name: string; index: number; hints?: string[]; canDuplicate: boolean; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
      <RowPanel testId={`action-extras-${index}`} openTestId={`action-details-${index}`} title={name} description="Contenu, lieu, participants, ligne de financement, tâches, réalisations et temps de cette action." label="détail" className="px-1 py-0 text-[10px]" hint="Contenu, lieu, participants, ligne de financement, public" wide>
        {children}
        {canDuplicate && (
          <button type="button" disabled={pending} onClick={() => start(async () => { const r = await duplicateAction(actionId); if (!r.ok) toast.error(r.error); else { toast.success("Action dupliquée : renommez-la et posez son jalon"); router.refresh(); } })} className="inline-flex w-fit items-center gap-1 rounded-sm px-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-primary" data-testid={`action-duplicate-${index}`} title="Dupliquer (même contenu, lieu, participants ; jalon à poser)">
            <Copy className="size-3" />Dupliquer cette action
          </button>
        )}
      </RowPanel>
      {hints.length > 0 && <span className="truncate text-muted-foreground/80">· {hints.join(" · ")}</span>}
    </div>
  );
}

export function DuplicateActionButton({ actionId }: { actionId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button type="button" disabled={pending} onClick={() => start(async () => { const r = await duplicateAction(actionId); if (!r.ok) toast.error(r.error); else router.refresh(); })} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Copy className="size-3" />Dupliquer</button>;
}
