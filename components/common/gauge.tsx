import { cn } from "@/lib/utils";
import { fmtEuro, fmtNumber } from "@/lib/format";

// Jauge fine V2 (5 px) : vert sous le seuil d'alerte, ocre entre, terre au-delà de 100 %. Le pourcentage s'écrit, la couleur confirme.
export function Gauge({ value, max, alertPercent = 80, label, className, compact, amount }: { value: number; max: number | null; alertPercent?: number; label?: string; className?: string; compact?: boolean; amount?: string }) {
  if (!max) return <span className="text-xs text-muted-foreground">—</span>;
  // Le pourcentage écrit n'est jamais plafonné ; seule la barre s'arrête à 100 %.
  const p = Math.round((value / max) * 100);
  const color = p >= 100 ? "bg-danger" : p >= alertPercent ? "bg-warning" : "bg-mint";
  const text = p >= 100 ? "text-danger" : p >= alertPercent ? "text-warning-foreground" : "text-foreground";
  const over = value > max ? `Enveloppe dépassée de ${fmtEuro(value - max)}` : null;
  return (
    <div className={cn("min-w-[72px]", compact ? "w-24" : "w-40", className)} title={[label, over].filter(Boolean).join(" · ") || undefined}>
      <div className="flex items-baseline justify-between gap-2 text-xs tabular">
        {amount ? <span>{amount}</span> : <span className="text-muted-foreground">{fmtNumber(value, 0)}</span>}
        <b className={cn("font-semibold", text)}>{p} %</b>
      </div>
      <div className="mt-1 h-[5px] overflow-hidden rounded-[3px] bg-[#e8e9e1]">
        <div className={cn("h-full rounded-[3px] transition-all", color)} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      {over && !compact && <div className="mt-1 text-[10px] font-semibold text-danger">{over}</div>}
    </div>
  );
}
