"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListTodo, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assignRequest, setRequestStatus, taskFromRequest } from "@/app/actions/requests";

// Boutons de traitement d'une demande : prendre, faire, décliner, en faire une tâche ; réattribuer.
export function RequestActions({ id, status, canTreat, canWithdraw, people, assigneeId }: { id: string; status: string; canTreat: boolean; canWithdraw: boolean; people: { id: string; name: string }[]; assigneeId: string | null }) {
  const [pending, start] = useTransition();
  const [answer, setAnswer] = useState("");
  const router = useRouter();
  const go = (s: string, msg: string) => start(async () => { const r = await setRequestStatus(id, s, answer); if (!r.ok) toast.error(r.error); else { toast.success(msg); router.refresh(); } });
  if (status === "done" || status === "declined") return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {canTreat && (
        <>
          {status === "open" && <Button size="xs" variant="outline" disabled={pending} onClick={() => go("doing", "Demande prise")} data-testid={`request-take-${id}`}><Play />Je m'en occupe</Button>}
          <Button size="xs" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await taskFromRequest(id); if (!r.ok) toast.error(r.error); else { toast.success("Tâche créée dans votre liste"); router.refresh(); } })} data-testid={`request-task-${id}`}><ListTodo />En faire une tâche</Button>
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Un mot au demandeur (facultatif)" aria-label="Réponse" className="h-7 min-w-[180px] rounded-md border bg-card px-2 text-xs" />
          <Button size="xs" className="bg-mint text-white hover:bg-mint/90" disabled={pending} onClick={() => go("done", "Demande faite, le demandeur est prévenu")} data-testid={`request-done-${id}`}><Check />Faite</Button>
          <Button size="xs" variant="ghost" disabled={pending} onClick={() => go("declined", "Demande déclinée")} data-testid={`request-decline-${id}`}><X />Décliner</Button>
          <select value={assigneeId ?? ""} disabled={pending} onChange={(e) => start(async () => { const r = await assignRequest(id, e.target.value || null); if (!r.ok) toast.error(r.error); else router.refresh(); })} aria-label="Confier à" className="h-7 rounded-md border bg-card px-1.5 text-[11px] text-muted-foreground">
            <option value="">Confier à…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </>
      )}
      {!canTreat && canWithdraw && <Button size="xs" variant="ghost" disabled={pending} onClick={() => go("declined", "Demande retirée")}><X />Retirer ma demande</Button>}
    </div>
  );
}
