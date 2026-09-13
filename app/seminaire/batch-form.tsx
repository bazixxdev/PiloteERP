"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { batchCreateEditions } from "@/app/actions/edition";
import { cn } from "@/lib/utils";

type Row = { projectId: string; name: string; pole: string; pilot: string; sourceId: string | null; sourceYear: number | null; sourceStatus: string | null; nextId: string | null; nextStatus: string | null; nextColor: string | null; decision: string | null };
type Decision = "renew" | "adjust" | "stop";

const OPTS: { value: Decision; label: string; cls: string }[] = [
  { value: "renew", label: "Reconduire", cls: "data-[on=true]:bg-mint data-[on=true]:text-white" },
  { value: "adjust", label: "Ajuster", cls: "data-[on=true]:bg-warning data-[on=true]:text-white" },
  { value: "stop", label: "Arrêter", cls: "data-[on=true]:bg-danger data-[on=true]:text-white" },
];

export function BatchForm({ year, rows, canRun }: { year: number; rows: Row[]; canRun: boolean }) {
  const [dec, setDec] = useState<Record<string, Decision>>(() => Object.fromEntries(rows.map((r) => [r.projectId, "renew" as Decision])));
  const [pending, start] = useTransition();
  const router = useRouter();
  const todo = rows.filter((r) => !r.nextId && r.sourceId);
  const counts = { renew: todo.filter((r) => dec[r.projectId] === "renew").length, adjust: todo.filter((r) => dec[r.projectId] === "adjust").length, stop: todo.filter((r) => dec[r.projectId] === "stop").length };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="seminar-table">
          <thead className="text-left text-[10px] font-semibold text-muted-foreground">
            <tr><th className="py-1.5">Projet</th><th className="py-1.5">Pôle · pilote</th><th className="py-1.5">Édition {year - 1}</th><th className="py-1.5">Décision</th><th className="py-1.5">Édition {year}</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.projectId} data-testid={`seminar-row-${r.projectId}`}>
                <td className="py-1.5 font-medium">{r.name}</td>
                <td className="py-1.5 text-muted-foreground">{r.pole} · {r.pilot}</td>
                <td className="py-1.5">
                  {r.sourceId ? <Link href={`/edition/${r.sourceId}`} className="text-primary hover:underline">{r.sourceYear} · {r.sourceStatus}</Link> : <span className="text-muted-foreground">aucune</span>}
                </td>
                <td className="py-1.5">
                  {r.nextId ? (
                    <span className="text-xs text-muted-foreground">décidé{r.decision ? ` : ${{ renew: "reconduire", adjust: "ajuster", stop: "arrêter" }[r.decision] ?? r.decision}` : ""}</span>
                  ) : r.decision === "stop" ? (
                    <span className="text-xs text-danger">arrêté</span>
                  ) : r.sourceId && canRun ? (
                    <div className="inline-flex overflow-hidden rounded-full border" role="radiogroup">
                      {OPTS.map((o) => (
                        <button key={o.value} type="button" role="radio" aria-checked={dec[r.projectId] === o.value} data-on={dec[r.projectId] === o.value} className={cn("px-2.5 py-0.5 text-xs transition-colors hover:bg-muted", o.cls)} onClick={() => setDec({ ...dec, [r.projectId]: o.value })}>{o.label}</button>
                      ))}
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="py-1.5">
                  {r.nextId ? <Link href={`/edition/${r.nextId}`}><StatusBadge label={r.nextStatus!} color={r.nextColor!} /></Link> : <span className="text-xs text-muted-foreground">à créer</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {todo.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3">
          <span className="text-sm">{counts.renew} à reconduire · {counts.adjust} à ajuster · {counts.stop} à arrêter</span>
          <Button
            data-testid="batch-create"
            disabled={!canRun || pending}
            onClick={() =>
              start(async () => {
                const res = await batchCreateEditions(year, todo.map((r) => ({ editionId: r.sourceId!, decision: dec[r.projectId] })));
                if (!res.ok) { toast.error(res.error); return; }
                toast.success(`${res.data!.created} édition(s) ${year} créée(s), ${res.data!.stopped} projet(s) arrêté(s)${res.data!.skipped.length ? ` · ${res.data!.skipped.length} ignorée(s)` : ""}`);
                router.refresh();
              })
            }
          >
            <Layers />{pending ? "Création…" : `Créer les éditions ${year} en lot`}
          </Button>
          {!canRun && <span className="text-xs text-muted-foreground">Réservé au CODIR.</span>}
        </div>
      )}
    </div>
  );
}
