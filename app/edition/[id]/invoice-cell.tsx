"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markInvoice, markServiceDone } from "@/app/actions/expenses";
import { cn } from "@/lib/utils";
import { V, le } from "@/lib/vocab";

// Cellule « Facture » d'une dépense : reçue → payée (RAF, assistante), service fait (pilote, équipe), chaque étape datée.
export function InvoiceCell({ id, receivedAt, paidAt, serviceDoneAt, serviceDoneBy, canTrack, canConfirm }: { id: string; receivedAt: string | null; paidAt: string | null; serviceDoneAt: string | null; serviceDoneBy: string | null; canTrack: boolean; canConfirm: boolean }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(Boolean(serviceDoneAt));
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => start(async () => { const r = await fn(); if (!r.ok) toast.error(r.error); else { toast.success(msg); router.refresh(); } });
  return (
    <div className="grid gap-1 text-[11px]" data-testid={`invoice-${id}`}>
      <div className="flex flex-wrap items-center gap-1">
        <span className={cn("rounded-sm px-1.5 py-px", paidAt ? "bg-mint-soft text-mint" : receivedAt ? "bg-info-soft text-primary" : "bg-muted text-muted-foreground")} data-testid={`invoice-state-${id}`}>{paidAt ? `Payée le ${paidAt}` : receivedAt ? `Reçue le ${receivedAt}` : "Facture non reçue"}</span>
        {canTrack && !receivedAt && <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => markInvoice(id, "received"), `Facture reçue : ${le(V.pilote)} est prévenu`)} data-testid={`invoice-received-${id}`}>Reçue</Button>}
        {canTrack && receivedAt && !paidAt && <Button size="xs" className="bg-mint text-white hover:bg-mint/90" disabled={pending} onClick={() => run(() => markInvoice(id, "paid"), `Facture payée : ${le(V.pilote)} est prévenu`)} data-testid={`invoice-paid-${id}`}>Payée</Button>}
        {canTrack && paidAt && <button type="button" disabled={pending} onClick={() => run(() => markInvoice(id, "paid", true), "Paiement annulé")} className="text-[10px] text-muted-foreground hover:underline">annuler</button>}
      </div>
      <label className={cn("inline-flex items-center gap-1.5", !canConfirm && "text-muted-foreground")}>
        <input type="checkbox" checked={done} disabled={!canConfirm || pending} onChange={(e) => { const v = e.target.checked; setDone(v); run(() => markServiceDone(id, v), v ? "Service fait confirmé" : "Service fait retiré"); }} className="size-3.5 rounded border-border accent-primary" data-testid={`service-done-${id}`} />
        {serviceDoneAt ? `Service fait · ${serviceDoneBy ?? ""} le ${serviceDoneAt}` : "Service fait ?"}
      </label>
    </div>
  );
}
