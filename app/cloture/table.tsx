"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { lockMonth, lockMonthForAll } from "@/app/actions/time";
import { fmtNumber } from "@/lib/format";

export type ClotureRow = { id: string; name: string; pole: string; hours: number; expected: number; daysDone: number; daysExpected: number; declaredWeeks: number; weeks: number; status: "locked" | "declared" | "complete" | "partial" | "missing"; lockedBy: string | null };

const STATUS = { locked: { label: "Verrouillé", color: "primary" }, declared: { label: "Déclaré complet", color: "mint" }, complete: { label: "Complet (non déclaré)", color: "info" }, partial: { label: "Partiel", color: "warning" }, missing: { label: "Manquant", color: "danger" } };

export function ClotureTable({ month, rows }: { month: string; rows: ClotureRow[] }) {
  const [reminded, setReminded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => { const r = await fn(); if (!r.ok) toast.error(r.error ?? "Erreur"); else { toast.success(msg); router.refresh(); } });
  const lockable = rows.filter((r) => r.status === "declared" || r.status === "complete").map((r) => r.id);
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm" data-testid="cloture-table">
        <thead className="bg-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Personne</th><th className="px-3 py-2.5">Pôle</th><th className="px-3 py-2.5 text-right">Jours saisis</th><th className="px-3 py-2.5 text-right">Heures</th><th className="px-3 py-2.5 text-right" title="Semaines déclarées complètes par la personne">Déclarées</th><th className="px-3 py-2.5">État</th>
            <th className="px-3 py-2.5 text-right">
              {lockable.length > 0 && <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => lockMonthForAll(month, lockable), `${lockable.length} mois verrouillé(s)`)}><Lock />Verrouiller les {lockable.length} complets</Button>}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} data-testid={`cloture-row-${r.id}`}>
              <td className="px-4 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.pole}</td>
              <td className="px-3 py-2 text-right tabular">{r.daysDone} / {r.daysExpected}</td>
              <td className="px-3 py-2 text-right tabular">{fmtNumber(r.hours, 0)} h <span className="text-xs text-muted-foreground">/ {fmtNumber(r.expected, 0)}</span></td>
              <td className="px-3 py-2 text-right tabular">{r.declaredWeeks} / {r.weeks}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusBadge label={STATUS[r.status].label} color={STATUS[r.status].color} />
                  {r.lockedBy && <span className="text-xs text-muted-foreground">{r.lockedBy}</span>}
                  {reminded.has(r.id) && <StatusBadge label="Relancé·e" color="coral" dot={false} />}
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-1">
                  {(r.status === "partial" || r.status === "missing" || r.status === "complete") && !reminded.has(r.id) && (
                    <Button size="xs" variant="ghost" onClick={() => { setReminded(new Set(reminded).add(r.id)); toast(`Relance envoyée à ${r.name} (simulée)`); }}><Bell />Relancer</Button>
                  )}
                  {r.status === "locked" ? (
                    <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => lockMonth(r.id, month, false), `Mois déverrouillé pour ${r.name}`)} data-testid={`unlock-${r.id}`}><LockOpen />Déverrouiller</Button>
                  ) : (
                    <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => lockMonth(r.id, month, true), `Mois verrouillé pour ${r.name}`)} data-testid={`lock-${r.id}`}><Lock />Verrouiller</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
