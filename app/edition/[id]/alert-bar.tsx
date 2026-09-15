import Link from "next/link";
import type { Alert } from "@/lib/alerts";
import { cn } from "@/lib/utils";

// Bande d'état (revue du 15/09) : les alertes de l'édition en taille lisible, sous l'en-tête, chacune menant à l'onglet où l'on agit.
// Une alerte acquittée par une décision d'instance passe en gris avec la référence de la décision.
const TAB_OF: Record<Alert["kind"], string> = { milestone_overdue: "actions", time_over: "temps", deliverable_overdue: "financements", deliverable_soon: "financements", envelope: "budget", validation_pending: "validations" };

export type AlertAck = { kind: Alert["kind"]; by: string };

export function AlertBar({ editionId, alerts, acks = [], max = 4 }: { editionId: string; alerts: Alert[]; acks?: AlertAck[]; max?: number }) {
  if (alerts.length === 0) return null;
  const sorted = [...alerts].sort((a, b) => Number(b.level === "danger") - Number(a.level === "danger"));
  const shown = sorted.slice(0, max);
  const rest = sorted.length - shown.length;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="alert-bar">
      {shown.map((a, i) => {
        const ack = acks.find((k) => k.kind === a.kind);
        return (
          <Link key={i} href={`/edition/${editionId}?onglet=${TAB_OF[a.kind]}`} title={ack ? `${a.label} — ${ack.by}` : a.label}
            className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold hover:brightness-95", ack ? "bg-muted text-muted-foreground line-through decoration-muted-foreground/50" : a.level === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning-foreground")}
            data-testid={`alert-${a.kind}${ack ? "-ack" : ""}`}>
            <span aria-hidden>{ack ? "✓" : a.level === "danger" ? "!" : "◷"}</span>
            <span className="truncate">{a.label}</span>
            {ack && <span className="text-[10px] font-normal no-underline">· {ack.by}</span>}
          </Link>
        );
      })}
      {rest > 0 && <Link href={`/edition/${editionId}?onglet=apercu`} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground">+{rest}</Link>}
    </div>
  );
}
