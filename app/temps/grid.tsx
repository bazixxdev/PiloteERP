"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, MessageSquare, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { saveTime, copyPreviousWeek } from "@/app/actions/time";
import { dayjs, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GridRow = { label: string; sub: string; projectId: string | null; actionId: string | null; timeCodeId: string | null; kind: "project" | "action" | "code" };
type Entry = { date: string; projectId: string | null; actionId: string | null; timeCodeId: string | null; hours: number; comment: string | null };

const rowKey = (r: { projectId: string | null; actionId: string | null; timeCodeId: string | null }) => `${r.projectId ?? ""}|${r.actionId ?? ""}|${r.timeCodeId ?? ""}`;

export function TimeGrid(p: { personId: string; weekStart: string; days: string[]; rows: GridRow[]; entries: Entry[]; lockedMonths: string[]; expectedWeek: number; readOnly: boolean; canCopyPrevious: boolean }) {
  const [cells, setCells] = useState<Record<string, { hours: number; comment: string | null }>>(() => {
    const m: Record<string, { hours: number; comment: string | null }> = {};
    for (const e of p.entries) m[`${rowKey(e)}@${e.date}`] = { hours: e.hours, comment: e.comment };
    return m;
  });
  const [pending, start] = useTransition();
  const router = useRouter();
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  // Une sauvegarde en cours ne doit pas être perdue en quittant la page.
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  const locked = (date: string) => p.lockedMonths.includes(date.slice(0, 7));
  const isFuture = (date: string) => dayjs(date).isAfter(dayjs(), "day");

  const dayTotals = useMemo(() => p.days.map((d) => p.rows.reduce((s, r) => s + (cells[`${rowKey(r)}@${d}`]?.hours ?? 0), 0)), [cells, p.days, p.rows]);
  const weekTotal = dayTotals.reduce((s, x) => s + x, 0);
  const expectedDay = p.expectedWeek / 5;

  const save = (r: GridRow, date: string, hours: number, comment?: string | null) => {
    const k = `${rowKey(r)}@${date}`;
    const prev = cells[k];
    if (prev?.hours === hours && comment === undefined) return;
    setCells((c) => ({ ...c, [k]: { hours, comment: comment === undefined ? (prev?.comment ?? null) : comment } }));
    start(async () => {
      const res = await saveTime({ personId: p.personId, date, projectId: r.projectId, actionId: r.actionId, timeCodeId: r.timeCodeId, hours, comment });
      if (!res.ok) { toast.error(res.error); setCells((c) => ({ ...c, [k]: prev ?? { hours: 0, comment: null } })); }
    });
  };

  const move = (ri: number, di: number, dr: number, dd: number) => {
    const nr = Math.max(0, Math.min(p.rows.length - 1, ri + dr));
    const nd = Math.max(0, Math.min(p.days.length - 1, di + dd));
    inputs.current[`${nr}:${nd}`]?.focus();
    inputs.current[`${nr}:${nd}`]?.select();
  };

  if (p.rows.length === 0) {
    return <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">Aucun projet ni code de temps pour cette personne cette semaine. Le pilote ajoute les membres de l'équipe depuis la fiche de l'édition ; l'admin règle les codes de temps par poste.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card" data-testid="time-grid">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="w-[320px] px-4 py-2 text-left">Projet / action / code</th>
            {p.days.map((d) => {
              const dj = dayjs(d);
              const today = dj.isSame(dayjs(), "day");
              return (
                <th key={d} className={cn("w-24 px-2 py-2 text-center", today && "text-primary")}>
                  <div>{dj.format("ddd")}</div>
                  <div className={cn("text-[11px] font-normal normal-case", today && "font-semibold")}>{dj.format("D MMM")}{locked(d) && <Lock className="ml-1 inline size-3" />}</div>
                </th>
              );
            })}
            <th className="w-24 px-2 py-2 text-right">Semaine</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {p.rows.map((r, ri) => {
            const rowTotal = p.days.reduce((s, d) => s + (cells[`${rowKey(r)}@${d}`]?.hours ?? 0), 0);
            return (
              <tr key={rowKey(r)} className={cn("hover:bg-muted/30", r.kind === "action" && "bg-muted/10")} data-testid={`time-row-${ri}`}>
                <td className={cn("px-4 py-1", r.kind === "action" && "pl-8")} title={r.sub}>
                  <div className={cn("truncate", r.kind === "project" && "font-medium", r.kind === "code" && "text-muted-foreground")}>{r.label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{r.sub}</div>
                </td>
                {p.days.map((d, di) => {
                  const k = `${rowKey(r)}@${d}`;
                  const cell = cells[k];
                  const ro = p.readOnly || locked(d) || isFuture(d);
                  return (
                    <td key={d} className="px-1 py-1">
                      <div className="relative">
                        <input
                          ref={(el) => { inputs.current[`${ri}:${di}`] = el; }}
                          data-testid={`cell-${ri}-${di}`}
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          inputMode="decimal"
                          readOnly={ro}
                          defaultValue={cell?.hours ? String(cell.hours) : ""}
                          key={`${k}:${cell?.hours ?? 0}`}
                          placeholder=""
                          title={r.sub}
                          className={cn(
                            "h-8 w-full rounded-lg border border-transparent bg-transparent text-center tabular transition-colors focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20",
                            !ro && "hover:border-border",
                            ro && "cursor-not-allowed text-muted-foreground",
                            cell?.hours && "font-medium",
                          )}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => { if (ro) return; const v = Number(e.target.value.replace(",", ".")); save(r, d, Number.isFinite(v) ? v : 0); }}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowRight") { e.preventDefault(); move(ri, di, 0, 1); }
                            else if (e.key === "ArrowLeft") { e.preventDefault(); move(ri, di, 0, -1); }
                            else if (e.key === "ArrowDown") { e.preventDefault(); move(ri, di, 1, 0); }
                            else if (e.key === "ArrowUp") { e.preventDefault(); move(ri, di, -1, 0); }
                            else if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); move(ri, di, 1, 0); }
                          }}
                        />
                        {cell?.hours ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button type="button" className={cn("absolute top-1/2 right-0.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:text-primary", cell.comment && "text-coral")} title={cell.comment ?? "Ajouter un commentaire"} tabIndex={-1}>
                                <MessageSquare className="size-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2" align="end">
                              <textarea
                                className="w-full rounded-lg border p-2 text-sm"
                                rows={3}
                                defaultValue={cell.comment ?? ""}
                                placeholder="Commentaire optionnel"
                                readOnly={ro}
                                onBlur={(e) => { if (!ro) save(r, d, cell.hours, e.target.value.trim() || null); }}
                              />
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right tabular font-medium">{rowTotal ? `${fmtNumber(rowTotal, 1)} h` : ""}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 text-sm font-semibold">
            <td className="px-4 py-2">
              <div className="flex items-center gap-2">
                Total
                {p.canCopyPrevious && (
                  <Button size="xs" variant="outline" disabled={pending} data-testid="copy-previous" onClick={() => start(async () => { const r = await copyPreviousWeek(p.weekStart); if (!r.ok) toast.error(r.error); else { toast.success(`${r.data!.copied} saisie(s) reprise(s) de la semaine précédente`); router.refresh(); } })}>
                    <History />Reprendre la semaine précédente
                  </Button>
                )}
              </div>
            </td>
            {dayTotals.map((t, i) => (
              <td key={i} className={cn("px-2 py-2 text-center tabular", t > expectedDay + 1 && "text-warning", t > 0 && t < expectedDay - 1 && "text-muted-foreground")}>{t ? `${fmtNumber(t, 1)} h` : "—"}</td>
            ))}
            <td className="px-2 py-2 text-right tabular" data-testid="week-total">
              {fmtNumber(weekTotal, 1)} h <span className="font-normal text-muted-foreground">/ {p.expectedWeek} h</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
