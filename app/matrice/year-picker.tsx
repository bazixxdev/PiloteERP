import Link from "next/link";
import { cn } from "@/lib/utils";

// Choix de l'année : puces ≤ 5 années (le patron du choix d'édition), lien par année.
export function YearPicker({ years, current, hrefFor }: { years: number[]; current: number; hrefFor: (y: number) => string }) {
  return (
    <div className="flex items-center gap-1" data-testid="year-picker" aria-label="Année">
      {years.map((y) => (
        <Link key={y} href={hrefFor(y)} aria-current={y === current ? "page" : undefined} className={cn("h-8 rounded-full border px-3 text-sm leading-8 transition-colors", y === current ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted")}>{y}</Link>
      ))}
    </div>
  );
}
