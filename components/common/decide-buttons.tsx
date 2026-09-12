"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decideValidation } from "@/app/actions/edition";

export function DecideButtons({ id }: { id: string }) {
  const [comment, setComment] = useState("");
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
      <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentaire (facultatif)" className="h-8 max-w-xs" />
      <Button size="sm" className="bg-mint text-white hover:bg-mint/90" disabled={pending} onClick={() => go("approved")} data-testid="approve"><Check />Approuver</Button>
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => go("refused")}><X />Refuser</Button>
    </div>
  );
}
