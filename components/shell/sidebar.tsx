"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarDays, Clock, LayoutGrid, CheckSquare, Coffee, Bell, Presentation, Gavel, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";
import { withBase } from "@/lib/base-path";

// Barre latérale V2 : fond clair, logo CRESS sur fond transparent, la liste des pôles en repère.
// Les groupes suivent le profil : un salarié commence par Ma semaine, Temps et ses projets ; les accès collectifs ou
// occasionnels viennent ensuite, et les écrans CODIR et Séminaire n'apparaissent qu'aux rôles CODIR. L'admin est dans le menu utilisateur.
type Item = { href: string; label: string; icon: typeof Briefcase };
type Group = { caption: string; items: Item[] };

function groupsFor(role: string): Group[] {
  const codir = ["director", "raf", "pole_lead"].includes(role);
  const work: Item[] = codir
    ? [
        { href: "/portefeuille", label: "Portefeuille", icon: Briefcase },
        { href: "/ma-semaine", label: "Ma semaine", icon: CalendarDays },
        { href: "/temps", label: "Temps", icon: Clock },
        { href: "/validations", label: "Validations", icon: CheckSquare },
      ]
    : [
        { href: "/ma-semaine", label: "Ma semaine", icon: CalendarDays },
        { href: "/temps", label: "Temps", icon: Clock },
        { href: "/portefeuille", label: "Mes projets", icon: Briefcase },
        { href: "/validations", label: "Validations", icon: CheckSquare },
      ];
  const collective: Item[] = [
    { href: "/cafe", label: "Écran café", icon: Coffee },
    { href: "/annuel", label: "Vue annuelle", icon: LayoutGrid },
    { href: "/conventions", label: "Conventions", icon: FileSignature },
    { href: "/rappels", label: "Rappels", icon: Bell },
  ];
  const direction: Item[] = codir ? [
    { href: "/codir", label: "Écran CODIR", icon: Gavel },
    { href: "/seminaire", label: "Séminaire", icon: Presentation },
  ] : [];
  return [
    { caption: codir ? "Espace de travail" : "Mon travail", items: work },
    { caption: "Toute la CRESS", items: collective },
    ...(direction.length ? [{ caption: "Direction", items: direction }] : []),
  ];
}

export const POLE_DOTS = ["#7c9277", "#8f9eaa", "#b49b7d", "#5e9bb8"];

export type SidebarPole = { id: string; name: string };

export function Sidebar({ pendingCount, remindersCount, poles, peopleCount, role }: { pendingCount: number; remindersCount: number; poles: SidebarPole[]; peopleCount: number; role: string }) {
  const pathname = usePathname();
  const GROUPS = groupsFor(role);
  return (
    <aside className="hidden h-screen w-14 md:flex shrink-0 flex-col gap-5 border-r bg-sidebar px-2 py-4 text-sidebar-foreground transition-[width] lg:w-[194px] lg:px-3 lg:py-5 print:hidden">
      <Link href="/portefeuille" className="flex items-center justify-center px-1 lg:justify-start lg:px-2" aria-label="CRESS Centre-Val de Loire · Portefeuille">
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG statique servi tel quel : l'optimiseur d'images ne gère pas le basePath */}
        <img src={withBase("/logo-cress.png")} alt="CRESS Centre-Val de Loire" width={465} height={187} className="hidden h-auto w-[150px] lg:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={withBase("/logo-cress-mark.png")} alt="" width={190} height={177} className="h-auto w-7 lg:hidden" />
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
                    {badge > 0 && <span className="hidden rounded-sm bg-warning-soft px-1.5 text-[10px] font-semibold text-warning-foreground lg:inline" title="À traiter par moi" aria-label={`${badge} à traiter par moi`}>{badge}</span>}
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
