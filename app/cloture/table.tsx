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
import { V, cap } from "@/lib/vocab";

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

// Revue du 15/09 (Gaël) : « appuyer sur les anomalies, le reste se zoome à la demande ». Deux tables : à traiter (sans saisie, partiel,
// saisies complètes mais non déclarées) toujours visible ; en ordre (déclaré, verrouillé) repliée par défaut.
const ISSUE: ClotureRow["status"][] = ["missing", "partial", "complete"];

export function ClotureTable({ month, rows }: { month: string; rows: ClotureRow[] }) {
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => { const r = await fn(); if (!r.ok) toast.error(r.error ?? "Erreur"); else { toast.success(msg); router.refresh(); } });
  // Lot du verrouillage collectif : semaines déclarées complètes, ou tous les jours attendus saisis. Les autres restent ouverts.
  const lockable = rows.filter((r) => r.status === "declared" || r.status === "complete");
  const excluded = rows.filter((r) => r.status === "partial" || r.status === "missing");
  const issues = rows.filter((r) => ISSUE.includes(r.status)).sort((a, b) => ISSUE.indexOf(a.status) - ISSUE.indexOf(b.status) || a.name.localeCompare(b.name));
  const ok = rows.filter((r) => !ISSUE.includes(r.status));

  const Table = ({ list, testId }: { list: ClotureRow[]; testId?: string }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="cloture-table" data-group={testId}>
        <thead className="bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Personne</th><th className="px-3 py-2.5">{cap(V.pole)}</th>
            <th className="px-3 py-2.5 text-right" title="Jours attendus par le rythme de la personne qui portent au moins une saisie">Saisies · jours</th>
            <th className="px-3 py-2.5 text-right">Heures</th>
            <th className="px-3 py-2.5 text-right" title="Semaines déclarées complètes par la personne">Déclaration · semaines</th>
            <th className="px-3 py-2.5">État</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {list.map((r) => {
            const st = stateOf(r);
            return (
              <tr key={r.id} data-testid={`cloture-row-${r.id}`} className={cn(r.status === "missing" && "bg-danger-soft/40", r.status === "partial" && "bg-warning-soft/40")}>
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

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-2xl border bg-card" data-testid="cloture-issues">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="text-[15px] font-bold">À traiter · {issues.length}</h2>
            <p className="text-[11px] text-muted-foreground">Sans saisie, partiel, ou saisies complètes mais non déclarées : relancer, ou verrouiller si c'est juste.</p>
          </div>
          {lockable.length > 0 && (
            <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" disabled={pending} data-testid="lock-all-open"><Lock />Verrouiller {lockable.length} personne{lockable.length > 1 ? "s" : ""} en ordre</Button>
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
        </div>
        {issues.length === 0 ? <p className="px-4 py-4 text-sm text-mint">✓ Rien à traiter : tout le monde est déclaré ou verrouillé.</p> : <Table list={issues} testId="issues" />}
      </div>
      <details className="group overflow-hidden rounded-2xl border bg-card" data-testid="cloture-ok">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3" data-testid="cloture-show-ok">
          <div><h2 className="text-[15px] font-bold">En ordre · {ok.length}</h2><p className="text-[11px] text-muted-foreground">{ok.filter((r) => r.status === "locked").length} verrouillé{ok.filter((r) => r.status === "locked").length > 1 ? "s" : ""}, {ok.filter((r) => r.status === "declared").length} déclaré{ok.filter((r) => r.status === "declared").length > 1 ? "s" : ""} complet{ok.filter((r) => r.status === "declared").length > 1 ? "s" : ""} : rien à faire, sauf vérifier.</p></div>
          <span className="text-[11px] text-primary"><span className="group-open:hidden">Afficher</span><span className="hidden group-open:inline">Replier</span></span>
        </summary>
        {ok.length === 0 ? <p className="border-t px-4 py-3 text-sm text-muted-foreground">Personne en ordre pour l'instant.</p> : <div className="border-t"><Table list={ok} testId="ok" /></div>}
      </details>
    </div>
  );
}
