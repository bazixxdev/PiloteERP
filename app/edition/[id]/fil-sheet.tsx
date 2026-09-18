"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AddCommentForm } from "./add-forms";
import { V, du } from "@/lib/vocab";

export type CommentView = { id: string; author: string; when: string; body: string };

// Le fil de l'édition (revue du 15/09) : la discussion n'est pas un document. Elle s'ouvre en panneau depuis l'en-tête,
// sur tous les onglets, avec le nombre de messages ; les derniers se lisent aussi dans l'Aperçu.
export function FilSheet({ editionId, comments, defaultOpen = false }: { editionId: string; comments: CommentView[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" data-testid="fil-open" title={`Fil ${du(V.edition)} : messages à l'équipe projet`}><MessageCircle />Fil{comments.length > 0 && <span className="rounded-sm bg-info-soft px-1 text-[10px] font-semibold text-primary">{comments.length}</span>}</Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{`Fil ${du(V.edition)}`}</SheetTitle>
          <SheetDescription>Messages à l'équipe projet, en lien ou à la place du canal Teams.</SheetDescription>
        </SheetHeader>
        <ul className="flex-1 space-y-2 overflow-y-auto p-4" data-testid="comments">
          {comments.length === 0 && <li className="text-sm text-muted-foreground">Aucun message pour l'instant.</li>}
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-muted/60 p-2.5 text-sm">
              <div className="mb-0.5 text-xs text-muted-foreground"><strong className="text-foreground">{c.author}</strong> · {c.when}</div>
              <p className="whitespace-pre-line">{c.body}</p>
            </li>
          ))}
        </ul>
        <div className="border-t p-3"><AddCommentForm editionId={editionId} /></div>
      </SheetContent>
    </Sheet>
  );
}
