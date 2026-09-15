"use client";

import { BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LEXIQUE } from "@/lib/lexique";

// « On parle de la même chose » : le lexique de l'outil, ouvert depuis les pages qui croisent projets, éditions et financements.
export function LexiqueDialog({ size = "sm" }: { size?: "xs" | "sm" }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline" size={size} data-testid="lexique-open"><BookOpenText />Lexique</Button></DialogTrigger>
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
