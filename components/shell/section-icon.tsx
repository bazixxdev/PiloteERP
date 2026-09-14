"use client";

import { usePathname } from "next/navigation";
import { iconFor } from "./section-icons";

// Icône de l'écran courant, la même que dans le menu, devant le titre de page.
export function SectionIcon({ className }: { className?: string }) {
  const Icon = iconFor(usePathname());
  if (!Icon) return null;
  return <span className={className ?? "grid size-9 shrink-0 place-items-center rounded-md bg-info-soft text-primary"} aria-hidden><Icon className="size-[18px]" /></span>;
}
