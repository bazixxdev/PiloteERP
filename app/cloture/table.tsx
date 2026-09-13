"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Lock, LockOpen, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/common/status-badge";
import { lockMonth, lockMonthForAll } from "@/app/actions/time";
import { remindTime } from "@/app/actions/notifications";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ClotureRow = { id: string; name: string; pole: string; hours: number; expected: number; daysDone: number; daysExpected: number; missingDays: number; declaredWeeks: number; weeks: number; status: "locked" | "declared" | "complete" | "partial" | "missing"; lockedBy: string | null; remindedAt: string | null; detailHref: string };

// L'état résume trois informations lisibles séparément dans la ligne : saisies, déclaration, verrouillage. Le manque réel est écrit.
function stateOf(r: ClotureRow): { label: string; color: string } {
  switch (r.status) {
    case "locked": return { label: "Verrouillé", color: "primary" };
    case "declared": return { label: "Déclaré complet", color: "mint" };
    case "complete": return { label: "Saisies complètes · non déclaré", color: "info" };
    case "partial": return { label: `Partiel · ${r.missingDays} jour${r.missingDays > 1 ? "s" : ""} sans saisie`, color: "warning" };
    default: return { label: "Manquant · aucune saisie", color: "danger" };
  }
}

export function ClotureTable({ month, rows }: { month: string; rows: ClotureRow[] }) {
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => { const r = await fn(); if (!r.ok) toast.error(r.error ?? "Erreur"); else { toast.success(msg); router.refresh(); } });
  // Lot du verrouillage collectif : semaines déclarées complètes, ou tous les jours attendus saisis. Les autres restent ouverts.
  const lockable = rows.filter((r) => r.status === "declared" || r.status === "complete");
  const excluded = rows.filter((r) => r.status === "partial" || r.status === "missing");
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm" data-testid="cloture-table">
        <thead className="bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Personne</th><th className="px-3 py-2.5">Pôle</th>
            <th className="px-3 py-2.5 text-right" title="Jours attendus par le rythme de la personne qui portent au moins une saisie">Saisies · jours</th>
            <th className="px-3 py-2.5 text-right">Heures</th>
            <th className="px-3 py-2.5 text-right" title="Semaines déclarées complètes par la personne">Déclaration · semaines</th>
            <th className="px-3 py-2.5">État</th>
            <th className="px-3 py-2.5 text-right">
              {lockable.length > 0 && (
                <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <PopoverTrigger asChild>
                    <Button size="xs" variant="outline" disabled={pending} data-testid="lock-all-open"><Lock />Verrouiller {lockable.length} personne{lockable.length > 1 ? "s" : ""}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-left" align="end">
                    <div className="text-sm font-semibold">Verrouillage collectif</div>
                    <p className="mt-1 text-xs text-muted-foreground">Seront verrouillées les personnes dont la semaine est déclarée complète ou dont tous les jours attendus sont saisis :</p>
                    <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs" data-testid="lock-all-list">
                      {lockable.map((r) => <li key={r.id} className="flex justify-between gap-2"><span className="font-medium">{r.name}</span><span className="text-muted-foreground">{r.status === "declared" ? "déclaré complet" : "saisies complètes, non déclaré"}</span></li>)}
                    </ul>
                    {excluded.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Restent ouverts ({excluded.length}) : {excluded.map((r) => r.name).join(", ")}.</p>}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>Annuler</Button>
                      <Button size="sm" disabled={pending} data-testid="lock-all-confirm" onClick={() => { setConfirmOpen(false); run(() => lockMonthForAll(month, lockable.map((r) => r.id)), `${lockable.length} mois verrouillé(s)`); }}><Lock />Verrouiller ces {lockable.length}</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const st = stateOf(r);
            return (
              <tr key={r.id} data-testid={`cloture-row-${r.id}`}>
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.pole}</td>
                <td className="px-3 py-2 text-right tabular">
                  {r.daysDone} / {r.daysExpected}
                  {r.missingDays > 0 && r.status !== "locked" && <small className={cn("block text-[10px]", r.status === "declared" ? "text-muted-foreground" : "text-warning-foreground")}>{r.missingDays} jour{r.missingDays > 1 ? "s" : ""} attendu{r.missingDays > 1 ? "s" : ""} sans saisie</small>}
                </td>
                <td className="px-3 py-2 text-right tabular">{fmtNumber(r.hours, 0)} h <span className="text-xs text-muted-foreground">/ {fmtNumber(r.expected, 0)}</span></td>
                <td className="px-3 py-2 text-right tabular">
                  {r.declaredWeeks} / {r.weeks}
                  <small className="block text-[10px] text-muted-foreground">{r.declaredWeeks === r.weeks && r.weeks > 0 ? "toutes déclarées" : r.declaredWeeks === 0 ? "aucune déclarée" : "en partie"}</small>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={st.label} color={st.color} />
                    {r.lockedBy && <span className="text-xs text-muted-foreground">par {r.lockedBy}</span>}
                    {r.remindedAt && <StatusBadge label={`Relancé·e le ${r.remindedAt}`} color="coral" dot={false} />}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild size="xs" variant="ghost" title="Voir la grille de la personne, semaine par semaine"><Link href={r.detailHref} data-testid={`detail-${r.id}`}><Eye />Détail</Link></Button>
                    {(r.status === "partial" || r.status === "missing" || r.status === "complete") && (
                      <Button size="xs" variant="ghost" disabled={pending} data-testid={`remind-${r.id}`} onClick={() => run(() => remindTime(r.id, month), `Relance envoyée à ${r.name} : notification dans l'outil`)}><Bell />Relancer</Button>
                    )}
                    {r.status === "locked" ? (
                      <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => lockMonth(r.id, month, false), `Mois déverrouillé pour ${r.name}`)} data-testid={`unlock-${r.id}`}><LockOpen />Déverrouiller</Button>
                    ) : (
                      <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => lockMonth(r.id, month, true), `Mois verrouillé pour ${r.name}`)} data-testid={`lock-${r.id}`}><Lock />Verrouiller</Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
