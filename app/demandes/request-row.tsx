"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListTodo, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assignRequest, setRequestStatus, taskFromRequest } from "@/app/actions/requests";
import Link from "next/link";

// Boutons de traitement d'une demande (rangés le 15/09) : prendre (= une tâche liée dans mes tâches), faire ou décliner avec un mot, confier à quelqu'un.
export function RequestActions({ id, status, canTreat, canWithdraw, people, assigneeId, hasTask }: { id: string; status: string; canTreat: boolean; canWithdraw: boolean; people: { id: string; name: string }[]; assigneeId: string | null; hasTask?: boolean }) {
  const [pending, start] = useTransition();
  const [answer, setAnswer] = useState("");
  const router = useRouter();
  const go = (s: string, msg: string) => start(async () => { const r = await setRequestStatus(id, s, answer); if (!r.ok) toast.error(r.error); else { toast.success(msg); router.refresh(); } });
  if (status === "done" || status === "declined") return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {canTreat && (
        <>
          {!hasTask ? (
            <Button size="xs" variant="outline" disabled={pending} title="La demande passe en cours à votre nom et arrive dans vos tâches, avec son échéance" onClick={() => start(async () => { const r = await taskFromRequest(id); if (!r.ok) toast.error(r.error); else { toast.success("Demande prise : elle est dans vos tâches"); router.refresh(); } })} data-testid={`request-take-${id}`}><ListTodo />Je m'en occupe</Button>
          ) : (
            <Link href="/taches" className="inline-flex h-7 items-center gap-1 rounded-md bg-info-soft px-2 text-[11px] text-primary hover:underline" data-testid={`request-task-link-${id}`}><ListTodo className="size-3" />Dans mes tâches</Link>
          )}
          <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Un mot au demandeur…" aria-label="Réponse au demandeur (part avec Faite ou Décliner)" title="Part avec la notification « Faite » ou « Déclinée »" className="h-7 w-[170px] rounded-md border bg-card px-2 text-xs" />
          <Button size="xs" className="bg-mint text-white hover:bg-mint/90" disabled={pending} onClick={() => go("done", "Demande faite, le demandeur est prévenu")} data-testid={`request-done-${id}`}><Check />Faite</Button>
          <Button size="xs" variant="ghost" disabled={pending} onClick={() => go("declined", "Demande déclinée")} data-testid={`request-decline-${id}`}><X />Décliner</Button>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Réattribuer la demande : la personne est prévenue">
            <UserPlus className="size-3" aria-hidden />
            <select value={assigneeId ?? ""} disabled={pending} onChange={(e) => start(async () => { const r = await assignRequest(id, e.target.value || null); if (!r.ok) toast.error(r.error); else { toast.success("Demande confiée"); router.refresh(); } })} aria-label="Confier à" className="h-7 rounded-md border bg-transparent px-1 text-[11px] text-muted-foreground" data-testid={`request-assign-${id}`}>
              <option value="">Confier à…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.id === assigneeId ? `${p.name} (en charge)` : p.name}</option>)}
            </select>
          </span>
        </>
      )}
      {!canTreat && canWithdraw && <Button size="xs" variant="ghost" disabled={pending} onClick={() => go("declined", "Demande retirée")}><X />Retirer ma demande</Button>}
    </div>
  );
}
