"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setPlannedLoad } from "@/app/actions/load";
import { dayjs, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// Répartir par mois les jours prévus d'une personne sur l'édition : un total et une période (l'outil lisse), puis mois par mois.
export function LoadPlanner({ editionId, personId, personName, year, plannedDays, loads, readOnly }: { editionId: string; personId: string; personName: string; year: number; plannedDays: number; loads: Record<string, number>; readOnly: boolean }) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const ventilated = Object.keys(loads).length > 0;
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(months.map((m) => [m, loads[m] ? String(loads[m]) : ""])));
  const [total, setTotal] = useState(String(plannedDays || ""));
  const [from, setFrom] = useState(months[0]);
  const [to, setTo] = useState(months[11]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const sum = Math.round(months.reduce((s, m) => s + (Number(String(vals[m]).replace(",", ".")) || 0), 0) * 10) / 10;
  const spread = () => {
    const t = Number(total.replace(",", ".")) || 0;
    const span = months.filter((m) => m >= from && m <= to);
    if (!t || span.length === 0) return;
    const per = Math.round((t / span.length) * 10) / 10;
    setVals(Object.fromEntries(months.map((m) => [m, span.includes(m) ? String(per) : ""])));
  };
  const save = () => start(async () => {
    const r = await setPlannedLoad(editionId, personId, Object.fromEntries(months.map((m) => [m, Number(String(vals[m]).replace(",", ".")) || 0])));
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`${fmtNumber(r.data!.total, 1)} j répartis pour ${personName}`);
    setOpen(false); router.refresh();
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-px text-[10px] hover:bg-muted", ventilated ? "text-primary" : "border border-dashed text-muted-foreground")} title={ventilated ? "Ventilation mensuelle : modifier" : "Répartir les jours prévus par mois"} data-testid={`load-plan-${personId}`}>
          <CalendarRange className="size-3" aria-hidden />{ventilated ? "par mois" : readOnly ? "lissé" : "Répartir par mois"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px]" align="start">
        <div className="text-xs font-semibold">{personName} · {year} · jours prévus par mois</div>
        {readOnly ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{ventilated ? "Répartition posée par le pilote ou la RAF." : "Total annuel lissé sur 12 mois (pas de répartition posée)."}</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-muted/50 p-2 text-[11px]">
            <span>Répartir</span><Input value={total} onChange={(e) => setTotal(e.target.value)} className="h-7 w-16 text-xs" aria-label="Total de jours" inputMode="decimal" data-testid="load-total" /><span>j de</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 rounded border bg-card px-1 text-xs" aria-label="Premier mois">{months.map((m) => <option key={m} value={m}>{dayjs(m + "-01").format("MMM")}</option>)}</select>
            <span>à</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="h-7 rounded border bg-card px-1 text-xs" aria-label="Dernier mois">{months.map((m) => <option key={m} value={m}>{dayjs(m + "-01").format("MMM")}</option>)}</select>
            <Button type="button" size="xs" variant="outline" onClick={spread} data-testid="load-spread">Lisser</Button>
          </div>
        )}
        <div className="mt-2 grid grid-cols-6 gap-1">
          {months.map((m) => (
            <label key={m} className="grid gap-0.5 text-center text-[10px] text-muted-foreground">
              {dayjs(m + "-01").format("MMM")}
              <Input value={vals[m]} onChange={(e) => setVals({ ...vals, [m]: e.target.value })} readOnly={readOnly} className="h-7 px-1 text-center text-xs tabular" inputMode="decimal" aria-label={`Jours en ${dayjs(m + "-01").format("MMMM")}`} data-testid={`load-month-${m}`} />
            </label>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span>Total : <b className="tabular" data-testid="load-sum">{fmtNumber(sum, 1)} j</b>{plannedDays && sum !== plannedDays ? <span className="text-muted-foreground"> (annuel actuel {fmtNumber(plannedDays, 1)} j → sera mis à jour)</span> : null}</span>
          {!readOnly && <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button size="sm" disabled={pending} onClick={save} data-testid="load-save">Enregistrer</Button></div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
