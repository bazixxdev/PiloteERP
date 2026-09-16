"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, MessageSquare, History, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { saveTime, copyPreviousWeek, declareWeek } from "@/app/actions/time";
import { dayjs, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GridRow = { label: string; sub: string; projectId: string | null; actionId: string | null; timeCodeId: string | null; kind: "project" | "action" | "code" };
type Entry = { date: string; projectId: string | null; actionId: string | null; timeCodeId: string | null; hours: number; comment: string | null };

const rowKey = (r: { projectId: string | null; actionId: string | null; timeCodeId: string | null }) => `${r.projectId ?? ""}|${r.actionId ?? ""}|${r.timeCodeId ?? ""}`;

export function TimeGrid(p: { personId: string; weekStart: string; days: string[]; rows: GridRow[]; entries: Entry[]; lockedMonths: string[]; expectedByDay: (number | null)[]; weekKey: string; declaredAt: string | null; readOnly: boolean; canCopyPrevious: boolean }) {
  const [cells, setCells] = useState<Record<string, { hours: number; comment: string | null }>>(() => {
    const m: Record<string, { hours: number; comment: string | null }> = {};
    for (const e of p.entries) m[`${rowKey(e)}@${e.date}`] = { hours: e.hours, comment: e.comment };
    return m;
  });
  const [pending, start] = useTransition();
  const router = useRouter();
  // Mobile : jour affiché (aujourd'hui, sinon le dernier jour passé de la semaine).
  const [mobileDayIdx, setMobileDayIdx] = useState(() => { const i = p.days.findIndex((d) => dayjs(d).isSame(dayjs(), "day")); if (i >= 0) return i; const past = p.days.filter((d) => !dayjs(d).isAfter(dayjs(), "day")); return Math.max(0, past.length - 1); });
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
  const expectedWeek = p.expectedByDay.some((x) => x !== null) ? p.expectedByDay.reduce<number>((s, x) => s + (x ?? 0), 0) : null;

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
    return <div className="rounded-md border border-dashed border-[#d3dfe3] p-10 text-center text-xs text-muted-foreground">Aucun projet ni code de temps pour cette personne cette semaine. Le pilote ajoute les membres de l'équipe depuis la fiche de l'édition ; l'admin règle les codes de temps par poste.</div>;
  }

  const todayIdx = p.days.findIndex((d) => dayjs(d).isSame(dayjs(), "day"));
  const mobileDay = p.days[mobileDayIdx] ?? p.days[0];
  const mobileRo = p.readOnly || locked(mobileDay) || isFuture(mobileDay);
  const pastEmptyDays = p.days.filter((d, i) => !isFuture(d) && dayTotals[i] === 0 && (p.expectedByDay[i] ?? 0) > 0);
  const status = expectedWeek !== null && Math.abs(weekTotal - expectedWeek) < 0.01
    ? { label: "✓ Semaine entièrement répartie", color: "mint" }
    : pastEmptyDays.length > 0
      ? { label: `○ Premier jour incomplet : ${dayjs(pastEmptyDays[0]).format("dddd")}`, color: "warning" }
      : weekTotal === 0 ? { label: "○ Semaine à répartir", color: "muted" } : { label: "○ Répartition en cours", color: "info" };
  const STATUS: Record<string, string> = { mint: "bg-mint-soft text-mint", warning: "bg-warning-soft text-warning-foreground", muted: "bg-muted text-muted-foreground", info: "bg-info-soft text-primary" };

  // `data-saving` : les sauvegardes partent en file (une transition à la fois) ; les tests l'attendent avant de recharger.
  return (
    <div data-testid="time-grid" data-saving={pending ? "1" : "0"}>
      {/* Bannière de la semaine : total saisi face au total attendu, informatif seulement. Compacte sur mobile : une ligne, la jauge, l'état. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5 md:mb-5 md:gap-5 md:px-[18px] md:py-4">
        <div className="min-w-[160px] md:min-w-[200px]">
          <span className="hidden text-xs text-muted-foreground md:block">{p.readOnly ? "Sa semaine" : "Votre semaine, répartie"}</span>
          <b className="block text-[19px] leading-tight tracking-[-0.5px] tabular md:mt-0.5 md:text-[25px] md:tracking-[-0.7px]" data-testid="week-total">{fmtNumber(weekTotal, 2)} h <small className="text-[12px] font-normal tracking-normal text-muted-foreground md:text-[13px]">{expectedWeek !== null ? `/ ${fmtNumber(expectedWeek, 2)} h attendues` : "· référence non configurée"}</small></b>
          {expectedWeek !== null && <div className="mt-1.5 h-[5px] w-[140px] overflow-hidden rounded-[3px] bg-[#e8e9e1] md:w-[180px]"><i className="block h-full rounded-[3px] bg-mint" style={{ width: `${Math.min(100, (weekTotal / expectedWeek) * 100)}%` }} /></div>}
        </div>
        <div>
          <span className={cn("inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-semibold", STATUS[status.color])} data-testid="week-status">{status.label}</span>
          <p className="mt-1.5 hidden text-xs text-muted-foreground md:block">Le total attendu vient de votre rythme : une clé de répartition, pas un pointage.</p>
        </div>
        {p.canCopyPrevious ? (
          <Button size="sm" variant="outline" className="h-11 md:h-8" disabled={pending} data-testid="copy-previous" onClick={() => start(async () => { const r = await copyPreviousWeek(p.weekStart); if (!r.ok) toast.error(r.error); else { toast.success(`${r.data!.copied} saisie(s) reprise(s) de la semaine précédente`); router.refresh(); } })}>
            <History />Reprendre la semaine précédente
          </Button>
        ) : <span />}
      </div>

      {/* Mobile : les colonnes deviennent des journées ; une journée à la fois, la semaine reste visible dans la bannière. */}
      <div className="md:hidden" data-testid="time-mobile">
        <div className="mb-3 grid grid-cols-5 gap-1.5" role="group" aria-label="Choisir le jour de la semaine">
          {p.days.map((d, i) => (
            <button key={d} type="button" onClick={() => setMobileDayIdx(i)} aria-pressed={i === mobileDayIdx} aria-label={dayjs(d).format("dddd D MMMM")} className={cn("min-h-[58px] rounded-md border bg-transparent px-1 py-2 text-center text-[10px]", i === mobileDayIdx ? "border-primary bg-primary text-white" : "hover:bg-muted")}>
              {dayjs(d).format("ddd")}<b className="mt-[3px] block text-[17px] font-semibold">{dayjs(d).format("D")}</b>
              {dayTotals[i] > 0 && <span className={cn("block text-[9px]", i === mobileDayIdx ? "text-white/80" : "text-muted-foreground")}>{fmtNumber(dayTotals[i], 1)} h</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <strong className="text-xs">{dayjs(mobileDay).format("dddd D MMMM").replace(/^./, (c) => c.toUpperCase())}</strong>
          {locked(mobileDay) ? <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground"><Lock className="size-3" />Verrouillé</span>
            : dayTotals[mobileDayIdx] > 0 && p.expectedByDay[mobileDayIdx] !== null && dayTotals[mobileDayIdx] >= (p.expectedByDay[mobileDayIdx] ?? 0) ? <span className="rounded-sm bg-mint-soft px-1.5 py-0.5 text-[11px] font-semibold text-mint">✓ Ce jour est complet</span>
            : isFuture(mobileDay) ? <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">À venir</span>
            : <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">○ Ce jour est à compléter</span>}
        </div>
        <div className="mt-1">
          {p.rows.map((r) => {
            const k = `${rowKey(r)}@${mobileDay}`;
            const cell = cells[k];
            return (
              <div key={k} className="flex items-center justify-between gap-2.5 border-b py-3.5">
                <div className="min-w-0">
                  <strong className={cn("block text-xs", r.kind === "code" && "font-normal text-muted-foreground")}>{r.kind === "action" ? "↳ " : ""}{r.label}</strong>
                  <small className="mt-[3px] block truncate text-[10px] text-muted-foreground">{r.sub}</small>
                </div>
                <input
                  type="number" step="0.25" min="0" max="24" inputMode="decimal" readOnly={mobileRo}
                  defaultValue={cell?.hours ? String(cell.hours) : ""} key={`${k}:${cell?.hours ?? 0}`} placeholder="—"
                  aria-label={`${r.label}, ${dayjs(mobileDay).format("dddd D MMMM")}, heures`}
                  className={cn("min-h-11 w-[72px] shrink-0 rounded-md border border-[#b8c5b1] bg-[#f5f7ef] px-2 text-center text-xs tabular focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint", mobileRo && "cursor-not-allowed text-muted-foreground", cell?.hours && "font-semibold")}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => { if (mobileRo) return; const v = Number(e.target.value.replace(",", ".")); save(r, mobileDay, Number.isFinite(v) ? v : 0); }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs"><span>Total du jour</span><b className="text-[21px] tabular">{fmtNumber(dayTotals[mobileDayIdx], 1)} <small className="text-xs font-normal text-muted-foreground">/ {p.expectedByDay[mobileDayIdx] === null ? "—" : `${fmtNumber(p.expectedByDay[mobileDayIdx]!, 1)} h`}</small></b></div>
      </div>

      <div className="hidden overflow-x-auto rounded-md border bg-card md:block" tabIndex={0} aria-label="Grille de saisie de la semaine">
        <table className="w-full min-w-[740px] table-fixed text-xs">
          <thead>
            <tr className="bg-[#f1f5f6] text-[10px] font-semibold text-muted-foreground">
              <th className="w-[32%] px-3 py-[11px] text-left">Projet / action <small className="font-normal">· en heures</small></th>
              {p.days.map((d, i) => {
                const dj = dayjs(d);
                return (
                  <th key={d} className={cn("px-2 py-[11px] text-center whitespace-nowrap", i === todayIdx && "bg-[#f5f1e4] text-foreground")}>
                    {dj.format("ddd D")}{locked(d) && <Lock className="ml-1 inline size-3" aria-label="Mois verrouillé" />}
                  </th>
                );
              })}
              <th className="px-2 py-[11px] text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r, ri) => {
              const rowTotal = p.days.reduce((s, d) => s + (cells[`${rowKey(r)}@${d}`]?.hours ?? 0), 0);
              return (
                <tr key={rowKey(r)} className="border-t border-[#e3e9eb] hover:bg-[#f8f9f3]" data-testid={`time-row-${ri}`}>
                  <td className={cn("px-3 py-[9px]", r.kind === "action" && "pl-7")}>
                    <span className="group relative inline-flex cursor-help items-center gap-1.5" tabIndex={0} aria-label={`${r.label}. ${r.sub}`}>
                      <strong className={cn("truncate font-semibold", r.kind === "code" && "font-normal text-muted-foreground")}>{r.kind === "action" ? "↳ " : ""}{r.label}</strong>
                      {r.sub && <span className="inline-grid size-[14px] shrink-0 place-items-center rounded-full border border-[#94a28e] text-[9px] text-muted-foreground" aria-hidden>i</span>}
                      {r.sub && <span className="absolute top-full left-0 z-20 mt-2 hidden w-60 rounded-md bg-foreground p-3 text-[11px] font-normal text-white shadow-lg group-hover:block group-focus:block">{r.sub}</span>}
                    </span>
                    <small className="mt-1 block truncate text-[10px] text-muted-foreground">{r.sub}</small>
                  </td>
                  {p.days.map((d, di) => {
                    const k = `${rowKey(r)}@${d}`;
                    const cell = cells[k];
                    const ro = p.readOnly || locked(d) || isFuture(d);
                    return (
                      <td key={d} className={cn("px-2 py-[9px] text-center", di === todayIdx && "bg-[#f5f1e4]")}>
                        <div className="relative inline-block w-full max-w-[62px]">
                          <input
                            ref={(el) => { inputs.current[`${ri}:${di}`] = el; }}
                            data-testid={`cell-${ri}-${di}`}
                            type="number"
                            step="0.25"
                            min="0"
                            max="24"
                            inputMode="decimal"
                            readOnly={ro}
                            defaultValue={cell?.hours ? String(cell.hours) : ""}
                            key={`${k}:${cell?.hours ?? 0}`}
                            placeholder={ro ? "" : "—"}
                            aria-label={`${r.label}, ${dayjs(d).format("dddd D MMMM")}, heures`}
                            className={cn(
                              "h-9 w-full rounded-sm border border-transparent bg-transparent text-center tabular transition-colors placeholder:text-[#92998d] focus:border-mint focus:bg-card focus:outline-none focus:ring-2 focus:ring-mint",
                              !ro && "hover:border-[#bdc7b7] hover:bg-card",
                              ro && "cursor-not-allowed text-muted-foreground",
                              cell?.hours && "font-semibold",
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
                                <button type="button" className={cn("absolute top-1/2 -right-3 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:text-primary", cell.comment && "text-coral")} title={cell.comment ?? "Ajouter un commentaire"} tabIndex={-1}>
                                  <MessageSquare className="size-3" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2" align="end">
                                <textarea
                                  className="w-full rounded-md border p-2 text-sm"
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
                  <td className="px-2 py-[9px] text-center font-semibold tabular">{rowTotal ? `${fmtNumber(rowTotal, 1)} h` : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#e3e9eb] bg-[#eef1e8] font-bold">
              <td className="px-3 py-4">Total du jour</td>
              {dayTotals.map((t, i) => {
                const exp = p.expectedByDay[i];
                return <td key={i} className={cn("px-2 py-4 text-center tabular", exp !== null && t > exp + 0.5 && "text-warning-foreground")} data-day-total={i}>{fmtNumber(t, 2)} h</td>;
              })}
              <td className="px-2 py-4 text-center tabular" data-testid="week-total-cell">{fmtNumber(weekTotal, 2)} h</td>
            </tr>
            <tr className="bg-[#f7f8f2] text-[10px] text-muted-foreground">
              <td className="px-3 py-[9px]">Rythme attendu · indicatif</td>
              {p.expectedByDay.map((x, i) => <td key={i} className="px-2 py-[9px] text-center tabular">{x === null ? "—" : x === 0 ? "non travaillé" : `${fmtNumber(x, 2)} h`}</td>)}
              <td className="px-2 py-[9px] text-center tabular">{expectedWeek === null ? "—" : `${fmtNumber(expectedWeek, 2)} h`}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 text-xs text-muted-foreground">
        <div className="max-w-[420px]">
          <p><b>Tab</b> pour avancer · heures décimales acceptées, par exemple 1,5 · Entrée valide la cellule.</p>
          <p className="mt-1.5">Survolez le nom d'une action, ou placez-y le focus, pour retrouver son objectif. Les codes de temps accueillent le travail transverse.</p>
        </div>
        {!p.readOnly && (
          <div className="flex flex-wrap items-center gap-3" data-testid="week-declaration">
            {p.declaredAt ? (
              <span className="flex items-center gap-1.5 text-mint"><CheckCircle2 className="size-4" />Répartition déclarée complète le {p.declaredAt}. Une correction annule la déclaration.</span>
            ) : (
              <>
                <span>Quand tout est réparti, déclarez-le : la RAF le voit dans la clôture.</span>
                <Button size="sm" variant="outline" disabled={pending || weekTotal === 0} data-testid="declare-week" onClick={() => start(async () => { const r = await declareWeek(p.weekKey); if (!r.ok) toast.error(r.error); else { toast.success("Semaine déclarée complète"); router.refresh(); } })}>
                  <CheckCircle2 />Ma répartition de la semaine est faite
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
