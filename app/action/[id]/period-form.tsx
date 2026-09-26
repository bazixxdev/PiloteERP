"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setActionPeriod } from "@/app/actions/actions";
import { plausibleDay } from "@/lib/actions";
import { useRun } from "@/components/common/use-run";

// Période de l'action : deux dates et « Enregistrer » (seulement des dates complètes et plausibles, jamais en cours de frappe). Le refus (fin avant le début, jalon laissé dehors) s'affiche tel que
// la commande le renvoie, sous les champs.
export function PeriodForm({ actionId, start, end, readOnly }: { actionId: string; start: string; end: string; readOnly: boolean }) {
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = useRun();
  useEffect(() => { setS(start); setE(end); }, [start, end]);
  if (readOnly) return null;
  const dirty = s !== start || e !== end;
  return (
    <form className="grid gap-2" onSubmit={(ev) => { ev.preventDefault(); setError(null); run(() => setActionPeriod(actionId, s, e), () => toast.success("Période enregistrée"), setError); }}>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Début<Input type="date" value={s} onChange={(x) => setS(x.target.value)} className="h-8 text-sm font-normal normal-case tracking-normal text-foreground" data-testid="period-start" required /></label>
        <label className="grid gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fin<Input type="date" value={e} onChange={(x) => setE(x.target.value)} className="h-8 text-sm font-normal normal-case tracking-normal text-foreground" data-testid="period-end" required /></label>
      </div>
      {[s, e].some((d) => /^\d{4}-/.test(d) && !plausibleDay(d)) && <p className="text-xs text-danger" data-testid="period-hint">Année entre 1900 et 2099.</p>}
      {error && <p className="text-xs text-danger" role="alert" data-testid="period-error">{error}</p>}
      <div className="flex justify-end"><Button type="submit" size="sm" variant="outline" disabled={pending || !dirty || !plausibleDay(s) || !plausibleDay(e)} data-testid="period-submit">Enregistrer</Button></div>
    </form>
  );
}
