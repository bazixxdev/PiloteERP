import type { ReactNode } from "react";

// État vide V2 : un symbole en Georgia, un titre, une suite possible.
export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#d3dfe3] px-5 py-6 text-center">
      <span className="mb-2 font-serif text-[25px] leading-none text-mint">{icon ?? "✓"}</span>
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="mt-1.5 max-w-md text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
