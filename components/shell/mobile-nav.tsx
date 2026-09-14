"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { iconFor } from "./section-icons";

// Navigation basse (mobile, maquette V2 chapitre 06) : trois entrées accessibles au pouce, mêmes icônes que la barre latérale.
const ITEMS = [
  { href: "/ma-semaine", label: "Ma semaine" },
  { href: "/temps", label: "Temps" },
  { href: "/portefeuille", label: "Projets", match: ["/portefeuille", "/edition"] },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-[#f6f9fa] px-1 pt-2 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden print:hidden" aria-label="Navigation mobile">
      {ITEMS.map((it) => {
        const active = (it.match ?? [it.href]).some((m) => pathname.startsWith(m));
        const Icon = iconFor(it.href)!;
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={cn("grid min-h-11 min-w-[72px] content-center gap-[3px] rounded-md px-3 py-1 text-center text-[10px] text-muted-foreground", active && "bg-info-soft font-bold text-primary")}>
            <Icon className="mx-auto size-[18px]" aria-hidden />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
