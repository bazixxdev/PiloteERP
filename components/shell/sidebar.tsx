"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarDays, Clock, LayoutGrid, CheckSquare, Coffee, Settings, Lock, Bell, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portefeuille", label: "Portefeuille", icon: Briefcase },
  { href: "/ma-semaine", label: "Ma semaine", icon: CalendarDays },
  { href: "/temps", label: "Mes temps", icon: Clock },
  { href: "/annuel", label: "Vue annuelle", icon: LayoutGrid },
  { href: "/validations", label: "Validations", icon: CheckSquare },
  { href: "/cafe", label: "Écran café", icon: Coffee },
  { href: "/seminaire", label: "Séminaire", icon: Presentation },
  { href: "/cloture", label: "Clôture", icon: Lock },
  { href: "/rappels", label: "Rappels", icon: Bell },
  { href: "/admin", label: "Admin", icon: Settings },
];

export function Sidebar({ pendingCount, remindersCount }: { pendingCount: number; remindersCount: number }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground print:hidden">
      <Link href="/portefeuille" className="m-3 flex items-center gap-2 rounded-xl bg-white p-2">
        <Image src="/logo-cress.png" alt="CRESS Centre-Val de Loire" width={150} height={57} priority className="h-auto w-[150px]" />
      </Link>
      <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">Pilote · prototype</div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/") || (item.href === "/portefeuille" && pathname.startsWith("/edition"));
          const badge = item.href === "/validations" ? pendingCount : item.href === "/rappels" ? remindersCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent",
                active && "bg-sidebar-accent text-white shadow-sm",
              )}
            >
              <item.icon className="size-4 opacity-80" />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && <span className="rounded-full bg-coral px-1.5 text-[11px] font-semibold text-white">{badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-[11px] leading-snug text-sidebar-foreground/60">
        Données fictives. Interface en français, sauvegarde automatique.
      </div>
    </aside>
  );
}
