"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addFundingLineFromConvention, detachFundingLineFromConvention } from "@/app/actions/edition";
import { SearchableSelect } from "@/components/common/searchable-select";
import { V, cap, un, au, pl } from "@/lib/vocab";

type R = { ok: true; data?: { deleted: boolean } } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: (r: R) => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error); return; } after?.(r); router.refresh(); });
  return { pending, run };
}

// Rattacher une édition depuis la convention (le miroir de « Rattacher une convention » dans l'onglet Financements).
export function AttachEditionForm({ conventionId, editions }: { conventionId: string; editions: { id: string; label: string }[] }) {
  const [id, setId] = useState("");
  const { pending, run } = useRun();
  if (editions.length === 0) return <p className="text-xs text-muted-foreground">{`Toutes les ${pl(V.edition)} couvertes par la période sont déjà rattachées.`}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      <SearchableSelect options={editions.map((e) => ({ value: e.id, label: e.label }))} value={id} onChange={setId} placeholder={`Rattacher ${un(V.edition)}…`} aria-label={`${cap(V.edition)} à rattacher`} data-testid="attach-edition-select" className="w-[320px]" />
      <Button size="sm" variant="outline" disabled={pending || !id} onClick={() => run(() => addFundingLineFromConvention(id, conventionId), () => { toast.success(`${cap(V.edition)} rattachée : sa ligne de financement suit désormais ce dossier`); setId(""); })} data-testid="attach-edition-submit"><Link2 />Rattacher</Button>
    </div>
  );
}

// Détacher : la ligne redevient un financement annuel propre à l'édition (ou disparaît si elle est vide).
export function DetachButton({ lineId, editionLabel }: { lineId: string; editionLabel: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="xs" variant="ghost" disabled={pending} title={`Détacher ${editionLabel} de cette convention`} data-testid={`detach-${lineId}`}
      onClick={() => { if (!confirm(`Détacher « ${editionLabel} » de cette convention ?\nLa ligne de financement redevient annuelle, propre ${au(V.edition)} ; vide, elle est supprimée.`)) return; run(() => detachFundingLineFromConvention(lineId), (r) => toast.success(r.ok && r.data?.deleted ? "Ligne vide supprimée" : `${cap(V.edition)} détachée : sa ligne redevient un financement annuel`)); }}>
      <Unlink />Détacher
    </Button>
  );
}
