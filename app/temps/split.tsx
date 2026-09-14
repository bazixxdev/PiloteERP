"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveWeekSplit } from "@/app/actions/time";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GridRow } from "./grid";

// « Répartir ma semaine » : des parts de mon temps par projet, pas des heures par jour (retour du 14/09, S14 Simon).
// Le camembert se remplit au fur et à mesure ; l'enregistrement convertit en heures sur les jours attendus du rythme.
const COLORS = ["#004D6D", "#3b8ea5", "#8fb8c8", "#c9a227", "#b86b3a", "#6e8f5b", "#a0a89a", "#5c5c8a", "#d98f7a", "#7fa3b3"];

export function WeekSplit({ rows, weekStart, expectedWeek, currentHours, readOnly }: { rows: GridRow[]; weekStart: string; expectedWeek: number | null; currentHours: Record<string, number>; readOnly: boolean }) {
  const key = (r: GridRow) => `${r.projectId ?? ""}|${r.actionId ?? ""}|${r.timeCodeId ?? ""}`;
  const initial = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[key(r)] = expectedWeek ? Math.round(((currentHours[key(r)] ?? 0) / expectedWeek) * 100) : 0;
    return m;
  }, [rows, currentHours, expectedWeek]);
  const [parts, setParts] = useState<Record<string, number>>(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const total = rows.reduce((s, r) => s + (parts[key(r)] ?? 0), 0);
  const rest = Math.max(0, 100 - total);
  const set = (r: GridRow, v: number) => setParts((p) => ({ ...p, [key(r)]: Math.max(0, Math.min(100, Math.round(v))) }));

  // Camembert en CSS (conic-gradient) : pas de bibliothèque, lisible en projection.
  const gradient = (() => {
    let acc = 0; const stops: string[] = [];
    rows.forEach((r, i) => { const v = parts[key(r)] ?? 0; if (v <= 0) return; stops.push(`${COLORS[i % COLORS.length]} ${acc}% ${acc + v}%`); acc += v; });
    stops.push(`#eceee6 ${acc}% 100%`);
    return `conic-gradient(${stops.join(", ")})`;
  })();

  if (expectedWeek === null) return <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">Rythme non configuré : la répartition en parts a besoin des heures attendues de la semaine.</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]" data-testid="week-split">
      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div><h4 className="text-[13px] font-bold">Parts de ma semaine</h4><p className="text-[10px] text-muted-foreground">100 % = {fmtNumber(expectedWeek, 1)} h attendues par mon rythme. Une part, c'est une clé de répartition, pas un pointage.</p></div>
          <span className={cn("rounded-sm px-2 py-0.5 text-[11px] font-semibold tabular", total > 100 ? "bg-danger-soft text-danger" : total === 100 ? "bg-mint-soft text-mint" : "bg-muted text-muted-foreground")} data-testid="split-total"><span className="whitespace-nowrap">{total} %</span></span>
        </div>
        <ul className="divide-y">
          {rows.map((r, i) => {
            const v = parts[key(r)] ?? 0;
            return (
              <li key={key(r)} className={cn("grid grid-cols-[14px_1fr_auto_auto] items-center gap-3 px-4 py-2.5", r.kind === "action" && "pl-8")} data-testid={`split-row-${i}`}>
                <span className="size-3 rounded-sm" style={{ background: v > 0 ? COLORS[i % COLORS.length] : "#eceee6" }} aria-hidden />
                <div className="min-w-0">
                  <div className={cn("truncate text-xs font-semibold", r.kind === "code" && "font-normal text-muted-foreground")}>{r.kind === "action" ? "↳ " : ""}{r.label}</div>
                  <input type="range" min={0} max={100} step={5} value={v} disabled={readOnly || pending} onChange={(e) => set(r, Number(e.target.value))} aria-label={`Part de ${r.label}`} className="mt-1 w-full accent-primary" />
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <input type="number" min={0} max={100} step={5} value={v || ""} placeholder="0" disabled={readOnly || pending} onChange={(e) => set(r, Number(e.target.value))} aria-label={`Pourcentage de ${r.label}`} className="h-8 w-16 rounded-md border bg-card px-2 text-center tabular" data-testid={`split-pct-${i}`} />
                  <span className="text-muted-foreground">%</span>
                </div>
                <span className="w-14 text-right text-[11px] tabular text-muted-foreground">{v ? `${fmtNumber(expectedWeek * v / 100, 1)} h` : ""}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-[11px] text-muted-foreground">
          <span>{rest > 0 ? `Reste ${rest} % à répartir (${fmtNumber(expectedWeek * rest / 100, 1)} h).` : total > 100 ? "Le total dépasse 100 %." : "Toute la semaine est répartie."}</span>
          {!readOnly && (
            <Button size="sm" disabled={pending || total > 100} data-testid="split-save" onClick={() => start(async () => { const r = await saveWeekSplit(weekStart, rows.map((row) => ({ projectId: row.projectId, actionId: row.actionId, timeCodeId: row.timeCodeId, percent: parts[key(row)] ?? 0 }))); if (!r.ok) toast.error(r.error); else { toast.success(`Répartition enregistrée : ${fmtNumber(r.data!.hours, 1)} h posées sur la semaine`); router.refresh(); } })}>
              <Save />Enregistrer la répartition
            </Button>
          )}
        </div>
      </div>
      <div className="grid content-start justify-items-center gap-3 rounded-md border bg-card p-4">
        <div className="relative size-40 rounded-full" style={{ background: gradient }} aria-label={`Camembert : ${total} % réparti`} data-testid="split-pie">
          <div className="absolute inset-[26%] grid place-items-center rounded-full bg-card text-center"><b className="text-lg tabular">{total} %</b><span className="text-[9px] text-muted-foreground">réparti</span></div>
        </div>
        <ul className="w-full text-[10px]">
          {rows.filter((r) => (parts[key(r)] ?? 0) > 0).map((r) => { const i = rows.indexOf(r); return <li key={key(r)} className="flex items-center gap-1.5 py-0.5"><span className="size-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} /><span className="truncate">{r.label}</span><span className="ml-auto tabular">{parts[key(r)]} %</span></li>; })}
          {total === 0 && <li className="flex items-center gap-1.5 text-muted-foreground"><PieChart className="size-3" />Poussez les curseurs.</li>}
        </ul>
      </div>
    </div>
  );
}
