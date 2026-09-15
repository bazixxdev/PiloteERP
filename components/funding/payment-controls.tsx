"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/common/reveal";
import { addPayment, deletePayment, markPaymentReceived } from "@/app/actions/payments";

type R = { ok: true } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error); return; } after?.(); router.refresh(); });
  return { pending, run };
}

// « Reçu » : une case, posée par la RAF ou la direction. Décocher retire la réception (le versement redevient attendu).
// Optimiste : la case bascule tout de suite et revient en arrière si le serveur refuse.
export function PaymentReceived({ id, received, readOnly, label }: { id: string; received: boolean; readOnly: boolean; label: string }) {
  const [value, setValue] = useState(received);
  useEffect(() => setValue(received), [received]);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <input
      type="checkbox"
      className="size-4 accent-primary"
      checked={value}
      disabled={readOnly || pending}
      aria-label={value ? `Reçu : ${label}` : `Marquer reçu : ${label}`}
      title={value ? "Reçu — décocher pour retirer la réception" : "Marquer comme reçu aujourd'hui"}
      data-testid={`payment-received-${id}`}
      onChange={(e) => {
        const next = e.target.checked;
        setValue(next);
        start(async () => {
          const r = await markPaymentReceived(id, next);
          if (!r.ok) { setValue(!next); toast.error(r.error); return; }
          toast.success(next ? "Versement reçu" : "Réception retirée : le versement redevient attendu");
          router.refresh();
        });
      }}
    />
  );
}

export function DeletePaymentButton({ id, label }: { id: string; label: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="xs" variant="ghost" disabled={pending} title={`Supprimer « ${label} »`} aria-label={`Supprimer le versement ${label}`} data-testid={`payment-delete-${id}`}
      onClick={() => { if (!confirm(`Supprimer le versement « ${label} » ?`)) return; run(() => deletePayment(id), () => toast.success("Versement supprimé")); }}>
      <Trash2 />
    </Button>
  );
}

// Ajouter un versement attendu : libellé, montant, date attendue ; une case pour l'enregistrer déjà reçu (régularisation).
export function AddPaymentForm({ fundingLineId, conventionId, suggestedAmount, testId = "add-payment" }: { fundingLineId?: string; conventionId?: string; suggestedAmount?: number | null; testId?: string }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(suggestedAmount && suggestedAmount > 0 ? String(Math.round(suggestedAmount)) : "");
  const [expectedAt, setExpectedAt] = useState("");
  const [received, setReceived] = useState(false);
  const { pending, run } = useRun();
  const valid = label.trim() && Number(amount) > 0 && expectedAt;
  return (
    <Reveal label="Versement" size="xs" testId={`${testId}-open`}>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!valid) return; run(() => addPayment({ fundingLineId, conventionId, label, amount: Number(amount), expectedAt, received }), () => { setLabel(""); setAmount(""); setExpectedAt(""); setReceived(false); toast.success(received ? "Versement enregistré comme reçu" : "Versement attendu ajouté"); }); }}>
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Acompte, solde, tranche 2027…" className="h-7 w-48 text-xs" data-testid={`${testId}-label`} aria-label="Libellé du versement" />
        <Input type="number" min={0} step={100} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant €" className="h-7 w-28 text-xs" data-testid={`${testId}-amount`} aria-label="Montant" />
        <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} className="h-7 w-36 text-xs" data-testid={`${testId}-date`} aria-label="Date attendue" />
        <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} className="accent-primary" data-testid={`${testId}-received`} /> déjà reçu</label>
        <Button type="submit" size="xs" variant="outline" disabled={pending || !valid} data-testid={`${testId}-submit`}><Plus />Ajouter</Button>
      </form>
    </Reveal>
  );
}
