import { cn } from "@/lib/utils";

// Jauge horizontale : vert sous le seuil d'alerte, ambre entre, rouge au-delà de 100 %.
export function Gauge({ value, max, alertPercent = 80, label, className, compact }: { value: number; max: number | null; alertPercent?: number; label?: string; className?: string; compact?: boolean }) {
  if (!max) return <span className="text-xs text-muted-foreground">—</span>;
  const p = Math.round((value / max) * 100);
  const color = p >= 100 ? "bg-danger" : p >= alertPercent ? "bg-warning" : "bg-mint";
  return (
    <div className={cn("flex items-center gap-2 whitespace-nowrap", className)} title={label}>
      <div className={cn("h-2 overflow-hidden rounded-full bg-muted", compact ? "w-12" : "w-28")}>
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      <span className="tabular text-xs text-muted-foreground">{p} %</span>
    </div>
  );
}
