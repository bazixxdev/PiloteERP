"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEXIQUE } from "@/lib/lexique";

// « On parle de la même chose » : le lexique de l'outil. Transverse, il s'ouvre depuis le bouton Aide en bas de la barre
// latérale (retour de Gaël, 17/09) — plus depuis les en-têtes de page.
export function LexiqueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" data-testid="lexique">
        <DialogHeader><DialogTitle>Lexique</DialogTitle><DialogDescription>Ce que chaque mot veut dire dans l&apos;outil. Vocabulaire à valider avec la CRESS (question 1 du cahier des charges).</DialogDescription></DialogHeader>
        <dl className="grid gap-3 text-sm">
          {LEXIQUE.map((x) => (
            <div key={x.term} className="grid gap-0.5 border-t pt-2 first:border-t-0 first:pt-0 sm:grid-cols-[150px_1fr]">
              <dt className="font-semibold">{x.term}</dt>
              <dd><span>{x.def}</span><span className="block text-xs text-muted-foreground">Ex. {x.example}</span></dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
