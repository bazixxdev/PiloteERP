import Link from "next/link";
import type { CSSProperties } from "react";
import type { Alert } from "@/lib/alerts";
import { cn } from "@/lib/utils";

// Bande d'état (revue du 15/09) : les alertes de l'édition en taille lisible, sous l'en-tête, chacune menant à l'onglet où l'on agit.
// Une alerte acquittée par une décision d'instance passe en gris avec la référence de la décision.
// Une seule ligne dès la tablette (critique du 16/09) : les puces se partagent la largeur et se tronquent (le libellé entier est en infobulle
// et sur l'onglet visé) ; au-delà de `max`, « +N » mène à l'aperçu. Avant, quatre alertes prenaient deux lignes à 1024 px.
// Sur mobile elles s'empilent en pleine largeur, à hauteur tactile.
const TAB_OF: Record<Alert["kind"], string> = { milestone_overdue: "actions", time_over: "temps", deliverable_overdue: "budget", deliverable_soon: "budget", payment_late: "budget", envelope: "budget", validation_pending: "apercu" };

export type AlertAck = { kind: Alert["kind"]; by: string };

export function AlertBar({ editionId, alerts, acks = [], max = 4 }: { editionId: string; alerts: Alert[]; acks?: AlertAck[]; max?: number }) {
  if (alerts.length === 0) return null;
  const sorted = [...alerts].sort((a, b) => Number(b.level === "danger") - Number(a.level === "danger"));
  const shown = sorted.slice(0, max);
  const rest = sorted.length - shown.length;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 md:flex-nowrap" data-testid="alert-bar">
      {shown.map((a, i) => {
        const ack = acks.find((k) => k.kind === a.kind);
        return (
          <Link key={i} href={`/edition/${editionId}?onglet=${TAB_OF[a.kind]}`} title={ack ? `${a.label} — ${ack.by}` : a.label}
            // Seuls les libellés longs cèdent la place : « Enveloppe à 91 % » reste entier, « Livrable en retard : Rapport… » se tronque.
            style={{ "--shrink": Math.max(0, a.label.length - 24) } as CSSProperties}
            className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold hover:brightness-95 max-md:min-h-11 md:shrink-[var(--shrink)]", ack ? "bg-muted text-muted-foreground line-through decoration-muted-foreground/50" : a.level === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning-foreground")}
            data-testid={`alert-${a.kind}${ack ? "-ack" : ""}`}>
            <span aria-hidden>{ack ? "✓" : a.level === "danger" ? "!" : "◷"}</span>
            <span className="truncate">{a.label}</span>
            {ack && <span className="shrink-0 text-[10px] font-normal no-underline">· {ack.by}</span>}
          </Link>
        );
      })}
      {rest > 0 && <Link href={`/edition/${editionId}?onglet=apercu`} className="inline-flex shrink-0 items-center rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground max-md:min-h-11" title={`${rest} autre${rest > 1 ? "s" : ""} alerte${rest > 1 ? "s" : ""}, dans l'aperçu`}>+{rest}</Link>}
    </div>
  );
}
