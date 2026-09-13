"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarDays, Clock, LayoutGrid, CheckSquare, Coffee, Settings, Bell, Presentation, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portefeuille", label: "Portefeuille", icon: Briefcase },
  { href: "/ma-semaine", label: "Ma semaine", icon: CalendarDays },
  { href: "/temps", label: "Temps", icon: Clock },
  { href: "/annuel", label: "Vue annuelle", icon: LayoutGrid },
  { href: "/validations", label: "Validations", icon: CheckSquare },
  { href: "/cafe", label: "Écran café", icon: Coffee },
  { href: "/codir", label: "Écran CODIR", icon: Gavel },
  { href: "/seminaire", label: "Séminaire", icon: Presentation },
  { href: "/rappels", label: "Rappels", icon: Bell },
  { href: "/admin", label: "Admin", icon: Settings },
];

export function Sidebar({ pendingCount, remindersCount }: { pendingCount: number; remindersCount: number }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-14 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] lg:w-56 print:hidden">
      <Link href="/portefeuille" className="m-2 flex items-center justify-center gap-2 rounded-xl bg-white p-1.5 lg:m-3 lg:p-2">
        <Image src="/logo-cress.png" alt="CRESS Centre-Val de Loire" width={150} height={57} priority className="hidden h-auto w-[150px] lg:block" />
        <span className="text-lg font-black text-primary lg:hidden">c</span>
      </Link>
      <div className="hidden px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 lg:block">Pilote · prototype</div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/") || (item.href === "/portefeuille" && pathname.startsWith("/edition")) || (item.href === "/temps" && pathname.startsWith("/cloture"));
          const badge = item.href === "/validations" ? pendingCount : item.href === "/rappels" ? remindersCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center justify-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent lg:justify-start lg:px-3",
                active && "bg-sidebar-accent text-white shadow-sm",
              )}
            >
              <item.icon className="size-4 opacity-80" />
              <span className="hidden flex-1 lg:inline">{item.label}</span>
              {badge > 0 && <span className="hidden rounded-full bg-coral px-1.5 text-[11px] font-semibold text-white lg:inline">{badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="hidden p-4 text-[11px] leading-snug text-sidebar-foreground/60 lg:block">
        Données fictives. Sauvegarde automatique. Appuyez sur <kbd className="rounded border border-sidebar-border px-1">?</kbd> pour les raccourcis.
      </div>
    </aside>
  );
}
