"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarDays, Clock, LayoutGrid, CheckSquare, Coffee, Settings, Bell, Presentation, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

// Barre latérale V2 : fond clair, logo CRESS sur fond transparent, trois sections, la liste des pôles en repère.
const GROUPS = [
  { caption: "Espace de travail", items: [
    { href: "/portefeuille", label: "Portefeuille", icon: Briefcase },
    { href: "/ma-semaine", label: "Ma semaine", icon: CalendarDays },
    { href: "/temps", label: "Mes temps", icon: Clock },
    { href: "/annuel", label: "Vue annuelle", icon: LayoutGrid },
    { href: "/validations", label: "Validations", icon: CheckSquare },
  ] },
  { caption: "Collectif", items: [
    { href: "/cafe", label: "Écran café", icon: Coffee },
    { href: "/codir", label: "Écran CODIR", icon: Gavel },
    { href: "/seminaire", label: "Séminaire", icon: Presentation },
    { href: "/rappels", label: "Rappels", icon: Bell },
  ] },
  { caption: "Réglages", items: [
    { href: "/admin", label: "Admin", icon: Settings },
  ] },
];

export const POLE_DOTS = ["#7c9277", "#8f9eaa", "#b49b7d", "#5e9bb8"];

export type SidebarPole = { id: string; name: string };

export function Sidebar({ pendingCount, remindersCount, poles, peopleCount }: { pendingCount: number; remindersCount: number; poles: SidebarPole[]; peopleCount: number }) {
  const pathname = usePathname();
  return (
    <aside className="hidden h-screen w-14 md:flex shrink-0 flex-col gap-5 border-r bg-sidebar px-2 py-4 text-sidebar-foreground transition-[width] lg:w-[194px] lg:px-3 lg:py-5 print:hidden">
      <Link href="/portefeuille" className="flex items-center justify-center px-1 lg:justify-start lg:px-2" aria-label="CRESS Centre-Val de Loire · Portefeuille">
        <Image src="/logo-cress.png" alt="CRESS Centre-Val de Loire" width={465} height={187} priority className="hidden h-auto w-[150px] lg:block" />
        <Image src="/logo-cress-mark.png" alt="" width={190} height={177} priority className="h-auto w-7 lg:hidden" />
      </Link>
      <div className="hidden px-2 text-[10px] leading-snug text-muted-foreground lg:block">Piloter ensemble<br /><span className="font-semibold uppercase tracking-[.8px]">Prototype</span></div>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.caption}>
            <div className="mb-1.5 hidden px-2 text-[10px] font-semibold text-muted-foreground lg:block">{g.caption}</div>
            <nav className="grid gap-[3px]" aria-label={g.caption}>
              {g.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/") || (item.href === "/portefeuille" && pathname.startsWith("/edition")) || (item.href === "/temps" && pathname.startsWith("/cloture"));
                const badge = item.href === "/validations" ? pendingCount : item.href === "/rappels" ? remindersCount : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-center gap-2.5 rounded-[5px] px-2 py-[9px] text-xs transition-colors hover:bg-[#e1edf1] lg:justify-start",
                      active && "bg-sidebar-accent font-bold text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="hidden flex-1 lg:inline">{item.label}</span>
                    {badge > 0 && <span className="hidden rounded-sm bg-warning-soft px-1.5 text-[10px] font-semibold text-warning-foreground lg:inline">{badge}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
        {poles.length > 0 && (
          <div className="hidden lg:block">
            <div className="mb-1.5 px-2 text-[10px] font-semibold text-muted-foreground">Les pôles</div>
            {poles.map((p, i) => (
              <Link key={p.id} href={`/portefeuille?pole=${p.id}`} className="flex items-center gap-2 rounded-[5px] px-2 py-1.5 text-[11px] leading-snug text-muted-foreground hover:bg-[#e1edf1]">
                <i className="size-[7px] shrink-0 rounded-full" style={{ background: POLE_DOTS[i % POLE_DOTS.length] }} />
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="hidden border-t border-sidebar-border px-2 pt-3 text-[11px] leading-relaxed text-muted-foreground lg:block">
        {peopleCount} personnes · {poles.length} pôles
        <span className="mt-2 block">Démonstration fictive · <kbd className="rounded border border-sidebar-border px-1">?</kbd> raccourcis</span>
      </div>
    </aside>
  );
}
