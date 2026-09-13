import type { Alert } from "@/lib/alerts";
import { cn } from "@/lib/utils";

// Alertes V2 : badges écrits avec un symbole ; ocre pour la vigilance, terre pour le retard ou le dépassement.
export function AlertChips({ alerts, max = 3, size = "sm" }: { alerts: Alert[]; max?: number; size?: "sm" | "lg" }) {
  if (alerts.length === 0) return <span className={cn("text-muted-foreground", size === "sm" ? "text-[11px]" : "text-sm")}>À jour</span>;
  const shown = alerts.slice(0, max);
  const rest = alerts.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((a, i) => (
        <span
          key={i}
          title={a.label}
          className={cn(
            "inline-flex max-w-full items-center gap-1 truncate rounded-sm px-1.5 py-0.5 font-semibold",
            size === "sm" ? "text-[11px]" : "text-sm",
            a.level === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning-foreground",
          )}
        >
          <span aria-hidden>{a.level === "danger" ? "!" : "◷"}</span>
          <span className="truncate">{a.label}</span>
        </span>
      ))}
      {rest > 0 && <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">+{rest}</span>}
    </div>
  );
}
