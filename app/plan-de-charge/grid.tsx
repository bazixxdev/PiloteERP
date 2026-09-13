"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setPlannedLoadMonth } from "@/app/actions/load";
import { dayjs, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PersonLoad } from "@/lib/load";

type Row = PersonLoad;
export type EditionOpt = { id: string; label: string; year: number; editable: boolean };

const tone = (planned: number, capacity: number) => {
  if (!capacity) return "bg-muted text-muted-foreground";
  const r = planned / capacity;
  if (r > 1) return "bg-danger-soft text-danger font-semibold";
  if (r >= 0.85) return "bg-warning-soft text-warning-foreground";
  if (r === 0) return "text-muted-foreground/70";
  return "bg-mint-soft/60 text-foreground";
};

// Grille personnes × mois : jours prévus colorés face à la capacité ; clic sur une cellule → détail par édition et réalisé.
export function LoadGrid({ rows, months, today, groupByPole, editions }: { rows: Row[]; months: string[]; today: string; groupByPole: boolean; editions: EditionOpt[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const editable = new Map(editions.map((e) => [e.id, e.editable]));
  const save = (editionId: string, personId: string, month: string, days: number, after?: () => void) => start(async () => {
    const r = await setPlannedLoadMonth(editionId, personId, month, days);
    if (!r.ok) { toast.error(r.error); return; }
    after?.(); router.refresh();
  });
  const groups = groupByPole ? [...new Map(rows.map((r) => [r.person.poleId ?? "—", r.person.poleName ?? "Transversal"])).entries()] : [["all", ""] as [string, string]];
  const totals = (list: Row[]) => months.map((m) => ({ planned: Math.round(list.reduce((s, r) => s + r.months[m].planned, 0) * 10) / 10, capacity: Math.round(list.reduce((s, r) => s + r.months[m].capacity, 0) * 10) / 10 }));
  return (
    <div className="overflow-auto rounded-md border bg-card" tabIndex={0} aria-label="Plan de charge, défilement horizontal">
      <table className="w-full text-[12px]" style={{ minWidth: 160 + months.length * 72 }} data-testid="load-grid">
        <thead className="sticky top-0 z-[2] bg-[#f1f5f6] text-[10px] font-semibold text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-[3] bg-[#f1f5f6] px-3 py-2.5 text-left">Personne</th>
            {months.map((m) => <th key={m} className={cn("px-1 py-2.5 text-center whitespace-nowrap", m === today && "bg-[#f5f1e4] text-foreground")}>{dayjs(m + "-01").format("MMM YY")}</th>)}
            <th className="px-2 py-2.5 text-right whitespace-nowrap">Total · capacité</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap(([gid, gname]) => {
            const list = groupByPole ? rows.filter((r) => (r.person.poleId ?? "—") === gid) : rows;
            const sub = totals(list);
            return [
              ...(groupByPole ? [<tr key={`g-${gid}`} className="bg-muted/40"><td colSpan={months.length + 2} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{gname} · {list.length}</td></tr>] : []),
              ...list.map((r) => {
                const tp = months.reduce((s, m) => s + r.months[m].planned, 0);
                const tc = months.reduce((s, m) => s + r.months[m].capacity, 0);
                return (
                  <tr key={r.person.id} className="border-t border-[#e3e9eb]" data-testid={`load-row-${r.person.id}`}>
                    <td className="sticky left-0 z-[1] bg-card px-3 py-1.5 font-medium whitespace-nowrap">{r.person.name}<small className="block text-[10px] font-normal text-muted-foreground">{r.person.availableDays} j / an</small></td>
                    {months.map((m) => {
                      const c = r.months[m];
                      const key = `${r.person.id}:${m}`;
                      return (
                        <td key={m} className={cn("p-0.5 text-center", m === today && "bg-[#f5f1e4]/60")}>
                          <Popover open={open === key} onOpenChange={(o) => setOpen(o ? key : null)}>
                            <PopoverTrigger asChild>
                              <button type="button" className={cn("h-9 w-full rounded-sm px-1 tabular hover:ring-2 hover:ring-ring/40", tone(c.planned, c.capacity))} title={`${fmtNumber(c.planned, 1)} j prévus sur ${fmtNumber(c.capacity, 1)} j de capacité`} data-testid={`load-cell-${r.person.id}-${m}`}>
                                <span className="block leading-tight">{c.planned ? fmtNumber(c.planned, 1) : "·"}</span>
                                {c.realized !== null && <span className="block text-[9px] font-normal opacity-70">réel {fmtNumber(c.realized, 1)}</span>}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="center">
                              <div className="text-xs font-semibold">{r.person.name} · {dayjs(m + "-01").format("MMMM YYYY")}</div>
                              <div className="mt-0.5 text-[11px] text-muted-foreground">{fmtNumber(c.planned, 1)} j prévus · capacité {fmtNumber(c.capacity, 1)} j{c.realized !== null ? ` · réalisé ${fmtNumber(c.realized, 1)} j` : ""}</div>
                              {c.cells.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Rien de prévu ce mois-ci.</p> : (
                                <ul className="mt-2 divide-y text-xs">
                                  {[...c.cells].sort((a, b) => b.days - a.days).map((x) => (
                                    <li key={x.editionId} className="flex items-center justify-between gap-2 py-1">
                                      <Link href={`/edition/${x.editionId}?onglet=temps`} className="min-w-0 truncate text-primary hover:underline">{x.project} · {x.year}{x.status !== "in_progress" && <span className="ml-1 text-[10px] text-muted-foreground">à venir</span>}</Link>
                                      {editable.get(x.editionId) ? (
                                        <span className="flex shrink-0 items-center gap-1">
                                          <DaysInput key={`${x.editionId}:${x.days}`} value={x.days} disabled={pending} onCommit={(d) => { if (d !== x.days) save(x.editionId, r.person.id, m, d); }} label={`Jours sur ${x.project} en ${dayjs(m + "-01").format("MMMM")}`} testId={`load-edit-${r.person.id}-${m}-${x.editionId}`} />
                                          <span className="text-[10px] text-muted-foreground">j{!x.ventilated && <span title="Total annuel lissé sur 12 mois ; modifier ce mois pose la ventilation"> · lissé</span>}</span>
                                        </span>
                                      ) : (
                                        <span className="shrink-0 tabular">{fmtNumber(x.days, 1)} j{!x.ventilated && <span className="ml-1 text-[10px] text-muted-foreground" title="Total annuel lissé sur 12 mois">lissé</span>}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <AddLoad editions={editions.filter((e) => e.editable && e.year === Number(m.slice(0, 4)) && !c.cells.some((x) => x.editionId === e.id))} pending={pending} onAdd={(editionId, days) => save(editionId, r.person.id, m, days)} />
                            </PopoverContent>
                          </Popover>
                        </td>
                      );
                    })}
                    <td className={cn("px-2 py-1.5 text-right whitespace-nowrap tabular", tp > tc && "font-semibold text-danger")}>{fmtNumber(tp, 0)} / {fmtNumber(tc, 0)} j</td>
                  </tr>
                );
              }),
              <tr key={`t-${gid}`} className="border-t bg-[#eef1e8] font-semibold">
                <td className="sticky left-0 z-[1] bg-[#eef1e8] px-3 py-1.5">{groupByPole ? "Total du pôle" : "Total"}</td>
                {sub.map((t, i) => <td key={i} className={cn("px-1 py-1.5 text-center tabular", t.planned > t.capacity && "text-danger")}>{fmtNumber(t.planned, 0)}<small className="block text-[9px] font-normal text-muted-foreground">/ {fmtNumber(t.capacity, 0)}</small></td>)}
                <td className="px-2 py-1.5 text-right tabular">{fmtNumber(sub.reduce((s, t) => s + t.planned, 0), 0)} / {fmtNumber(sub.reduce((s, t) => s + t.capacity, 0), 0)} j</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

// Champ de jours : enregistre à la sortie du champ ou avec Entrée.
function DaysInput({ value, disabled, onCommit, label, testId }: { value: number; disabled: boolean; onCommit: (d: number) => void; label: string; testId: string }) {
  const [v, setV] = useState(String(value));
  const commit = () => { const d = Number(v.replace(",", ".")); if (Number.isFinite(d) && d >= 0) onCommit(Math.round(d * 10) / 10); else setV(String(value)); };
  return <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} disabled={disabled} inputMode="decimal" aria-label={label} className="h-7 w-14 px-1 text-right text-xs tabular" data-testid={testId} />;
}

// Ajouter une édition à ce mois : la personne y est rattachée si elle n'y était pas.
function AddLoad({ editions, pending, onAdd }: { editions: EditionOpt[]; pending: boolean; onAdd: (editionId: string, days: number) => void }) {
  const [id, setId] = useState("");
  const [days, setDays] = useState("");
  if (editions.length === 0) return null;
  return (
    <form className="mt-2 flex items-center gap-1 border-t pt-2" onSubmit={(e) => { e.preventDefault(); const d = Number(days.replace(",", ".")); if (!id || !Number.isFinite(d) || d <= 0) return; onAdd(id, d); setId(""); setDays(""); }}>
      <select value={id} onChange={(e) => setId(e.target.value)} className="h-7 min-w-0 flex-1 rounded border bg-card px-1 text-xs" aria-label="Ajouter une édition" data-testid="load-add-edition">
        <option value="">+ Ajouter une édition…</option>
        {editions.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
      </select>
      <Input value={days} onChange={(e) => setDays(e.target.value)} placeholder="j" inputMode="decimal" aria-label="Jours" className="h-7 w-14 px-1 text-right text-xs" data-testid="load-add-days" />
      <Button type="submit" size="xs" variant="outline" disabled={pending || !id || !days} data-testid="load-add-submit"><Plus /></Button>
    </form>
  );
}
