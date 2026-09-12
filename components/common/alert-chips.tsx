import type { Alert } from "@/lib/alerts";
import { AlertTriangle, Clock, Euro, Flag, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { milestone_overdue: Flag, deliverable_soon: Clock, deliverable_overdue: Clock, envelope: Euro, time_over: AlertTriangle, validation_pending: CheckSquare };

export function AlertChips({ alerts, max = 3, size = "sm" }: { alerts: Alert[]; max?: number; size?: "sm" | "lg" }) {
  if (alerts.length === 0) return <span className="text-xs text-mint">Aucune alerte</span>;
  const shown = alerts.slice(0, max);
  const rest = alerts.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((a, i) => {
        const Icon = ICONS[a.kind];
        return (
          <span
            key={i}
            title={a.label}
            className={cn(
              "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 font-medium ring-1 ring-inset",
              size === "sm" ? "text-[11px]" : "text-sm",
              a.level === "danger" ? "bg-danger-soft text-danger ring-danger/30" : "bg-warning-soft text-[#8a5a00] ring-warning/40",
            )}
          >
            <Icon className={size === "sm" ? "size-3 shrink-0" : "size-4 shrink-0"} />
            <span className="truncate">{a.label}</span>
          </span>
        );
      })}
      {rest > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">+{rest}</span>}
    </div>
  );
}
