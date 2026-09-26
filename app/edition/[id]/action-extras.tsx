"use client";

import { RowPanel } from "@/components/common/row-panel";
import { V, ce } from "@/lib/vocab";

// Le détail d'une action s'ouvre en panneau (revue du 15/09) : contenu, lieu, participants, ligne de financement, public,
// tâches liées, réalisations, temps par personne.
export function ActionPanel({ name, index, hints = [], children }: { name: string; index: number; hints?: string[]; children: React.ReactNode }) {
  return (
    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
      <RowPanel testId={`${V.action.one}-extras-${index}`} openTestId={`${V.action.one}-details-${index}`} title={name} description={`Contenu, lieu, participants, ligne de financement, tâches, réalisations et temps de ${ce(V.action)}.`} label="détail" className="px-1 py-0 text-[10px]" hint="Contenu, lieu, participants, ligne de financement, public" wide>
        {children}
      </RowPanel>
      {hints.length > 0 && <span className="truncate text-muted-foreground/80">· {hints.join(" · ")}</span>}
    </div>
  );
}
