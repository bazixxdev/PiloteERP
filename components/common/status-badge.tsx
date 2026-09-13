import { cn } from "@/lib/utils";

// Badges V2 : rectangle 4 px, symbole écrit avant le libellé, jamais la couleur seule.
const COLORS: Record<string, string> = {
  primary: "bg-info-soft text-primary",
  info: "bg-info-soft text-primary",
  mint: "bg-mint-soft text-mint",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-danger-soft text-danger",
  coral: "bg-coral/10 text-coral",
  muted: "bg-muted text-muted-foreground",
};

const SYMBOLS: Record<string, string> = { primary: "◐", info: "◐", mint: "✓", warning: "!", danger: "!", coral: "↻", muted: "○" };

export function StatusBadge({ label, color = "muted", className, dot = true }: { label: string; color?: string; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] leading-[1.6] font-semibold whitespace-nowrap", COLORS[color] ?? COLORS.muted, className)}>
      {dot && <span aria-hidden className="text-[10px]">{SYMBOLS[color] ?? SYMBOLS.muted}</span>}
      {label}
    </span>
  );
}
