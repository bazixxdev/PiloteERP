"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decideValidation } from "@/app/actions/edition";

// Compact (critique du 16/09) : Approuver et Refuser seulement ; le champ de commentaire s'ouvre à la demande, ou au premier
// clic sur Refuser (un refus mérite un mot, on le propose sans l'imposer). Onze demandes affichées ne font plus onze formulaires.
export function DecideButtons({ id }: { id: string }) {
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (decision: "approved" | "refused") =>
    start(async () => {
      const res = await decideValidation(id, decision, comment);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(decision === "approved" ? "Approuvée : le montant est engagé sur l'édition." : "Refusée.");
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showComment && <Input autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder={refusing ? "Motif du refus (facultatif)" : "Commentaire (facultatif)"} className="h-8 w-full max-w-xs" onKeyDown={(e) => { if (e.key === "Escape") { setShowComment(false); setRefusing(false); } }} />}
      {!refusing && <Button size="sm" className="bg-mint text-white hover:bg-mint/90" disabled={pending} onClick={() => go("approved")} data-testid="approve"><Check />Approuver</Button>}
      <Button size="sm" variant={refusing ? "destructive" : "outline"} disabled={pending} onClick={() => { if (refusing) go("refused"); else { setRefusing(true); setShowComment(true); } }} data-testid={refusing ? "refuse-confirm" : "refuse"}><X />{refusing ? "Confirmer le refus" : "Refuser"}</Button>
      {refusing ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setRefusing(false); setShowComment(false); }}>Annuler</Button>
      ) : !showComment && (
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setShowComment(true)} data-testid="decide-comment">Commenter</Button>
      )}
    </div>
  );
}
