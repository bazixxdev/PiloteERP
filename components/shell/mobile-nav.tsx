"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Navigation basse (mobile, maquette V2 chapitre 06) : trois entrées accessibles au pouce.
const ITEMS = [
  { href: "/ma-semaine", symbol: "☷", label: "Ma semaine" },
  { href: "/temps", symbol: "◷", label: "Temps" },
  { href: "/portefeuille", symbol: "▦", label: "Projets", match: ["/portefeuille", "/edition"] },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-[#f6f9fa] px-1 pt-2 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden print:hidden" aria-label="Navigation mobile">
      {ITEMS.map((it) => {
        const active = (it.match ?? [it.href]).some((m) => pathname.startsWith(m));
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={cn("grid min-h-11 min-w-[72px] content-center gap-[3px] rounded-md px-3 py-1 text-center text-[10px] text-muted-foreground", active && "bg-info-soft font-bold text-primary")}>
            <span className="text-[17px] leading-none" aria-hidden>{it.symbol}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
