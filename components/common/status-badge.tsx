import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  primary: "bg-primary/10 text-primary ring-primary/20",
  info: "bg-info-soft text-primary ring-primary/15",
  mint: "bg-mint-soft text-accent-foreground ring-mint/30",
  warning: "bg-warning-soft text-[#8a5a00] ring-warning/40",
  danger: "bg-danger-soft text-danger ring-danger/30",
  coral: "bg-coral/10 text-coral ring-coral/30",
  muted: "bg-muted text-muted-foreground ring-border",
};

const DOTS: Record<string, string> = {
  primary: "bg-primary",
  info: "bg-chart-5",
  mint: "bg-mint",
  warning: "bg-warning",
  danger: "bg-danger",
  coral: "bg-coral",
  muted: "bg-muted-foreground/50",
};

export function StatusBadge({ label, color = "muted", className, dot = true }: { label: string; color?: string; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", COLORS[color] ?? COLORS.muted, className)}>
      {dot && <span className={cn("size-1.5 rounded-full", DOTS[color] ?? DOTS.muted)} />}
      {label}
    </span>
  );
}
