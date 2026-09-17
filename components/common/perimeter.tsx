import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Perimeter } from "@/lib/scope";

// Bascule « Mon pôle / Toute la CRESS » : le quotidien d'une personne, c'est son pôle ; le reste se consulte sur demande.
export function PerimeterChips({ current, poleName, hrefFor }: { current: Perimeter; poleName: string | null; hrefFor: (p: Perimeter) => string }) {
  if (!poleName) return null;
  const chip = (p: Perimeter, label: string) => (
    <Link key={p} href={hrefFor(p)} data-testid={`perimeter-${p}`} aria-current={current === p ? "page" : undefined} className={cn("inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors", current === p ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted")}>{label}</Link>
  );
  return (
    <div className="flex items-center gap-1" data-testid="perimeter">
      {chip("pole", `Mon pôle · ${poleName}`)}
      {chip("cress", "Toute la CRESS")}
    </div>
  );
}
