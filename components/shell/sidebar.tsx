"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, CalendarDays, CalendarClock, Clock, FileSignature, Inbox, Landmark, PanelLeftClose, PanelLeftOpen, Settings, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { withBase } from "@/lib/base-path";
import { locate, type NavSection } from "@/lib/navigation";
import { HelpMenu } from "./help-menu";

// Barre latérale à deux niveaux (proto validé le 17/09) : une section par icône, la section de la page courante dépliée
// avec ses feuilles reliées par un trait d'arbre, les autres repliées. Un bouton la réduit en rail d'icônes (choix mémorisé) ;
// sous `lg`, elle est toujours en rail. L'arbre vient du serveur (lib/navigation.ts), ici on n'affiche que ce qu'on reçoit.
const SECTION_ICONS: Record<NavSection["id"], LucideIcon> = {
  travail: CalendarDays,
  temps: Clock,
  portefeuille: Briefcase,
  demandes: Inbox,
  projets: FileSignature,
  echeances: CalendarClock,
  direction: Landmark,
  admin: Settings,
};

const STORAGE_KEY = "pilote-sidebar-collapsed";

export function Sidebar({ tree }: { tree: NavSection[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { section: openId, leaf: activeHref } = locate(tree, pathname, params);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === "1"); } catch { /* stockage indisponible : barre déployée */ }
  }, []);
  // Les sous-onglets en page (classe `subnav`) se cachent quand la barre montre déjà le niveau 2 : voir globals.css.
  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? "rail" : "open";
    return () => { delete document.documentElement.dataset.sidebar; };
  }, [collapsed]);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignoré */ }
  };
  const expand = () => { if (collapsed) toggle(); };

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "group/side hidden h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] md:flex print:hidden",
        collapsed ? "w-[60px] px-2 py-3" : "w-[60px] px-2 py-3 lg:w-[244px] lg:px-2.5",
      )}
    >
      <div className={cn("flex items-center pb-3", collapsed ? "flex-col gap-2" : "flex-col gap-2 lg:flex-row lg:justify-between lg:px-1")}>
        <Link href="/portefeuille" className="flex items-center justify-center" aria-label="CRESS Centre-Val de Loire · Portefeuille">
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG statique servi tel quel : l'optimiseur d'images ne gère pas le basePath */}
          <img src={withBase("/logo-cress.png")} alt="CRESS Centre-Val de Loire" width={465} height={187} className={cn("h-auto w-[150px]", collapsed ? "hidden" : "hidden lg:block")} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBase("/logo-cress-mark.png")} alt="" width={190} height={177} className={cn("h-auto w-8", collapsed ? "block" : "lg:hidden")} />
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"}
          title={collapsed ? "Déployer le menu" : "Réduire le menu"}
          className="hidden size-7 place-items-center rounded-md text-muted-foreground hover:bg-[#e4eef1] hover:text-primary lg:grid"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden" aria-label="Navigation principale">
        {tree.map((s) => {
          const Icon = SECTION_ICONS[s.id];
          const open = s.id === openId;
          const active = s.items.find((l) => l.href === activeHref);
          // Le niveau 1 mène à la feuille courante si la section est ouverte, sinon à sa première feuille.
          const target = active?.href ?? s.items[0]?.href ?? "/portefeuille";
          const badge = s.badge ?? 0;
          return (
            <div key={s.id}>
              <Link
                href={target}
                onClick={expand}
                title={s.label}
                aria-expanded={open}
                aria-current={open && collapsed ? "page" : undefined}
                className={cn(
                  "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-[#e4eef1]",
                  collapsed ? "h-10 w-11 justify-center px-0" : "h-10 w-11 justify-center px-0 lg:h-9 lg:w-full lg:justify-start lg:px-2",
                  open && "font-semibold text-primary",
                  open && (collapsed ? "bg-sidebar-accent" : "bg-sidebar-accent lg:bg-transparent"),
                )}
              >
                <Icon className={cn("shrink-0", collapsed ? "size-5" : "size-5 lg:size-[18px]")} />
                <span className={cn("flex-1 truncate", collapsed ? "hidden" : "hidden lg:inline")}>{s.label}</span>
                {badge > 0 && (
                  <>
                    <span className={cn("rounded-sm bg-warning-soft px-1.5 text-[10px] font-bold leading-[18px] text-warning-foreground", collapsed ? "hidden" : "hidden lg:inline")} title="À traiter par moi" aria-label={`${badge} à traiter par moi`}>{badge}</span>
                    <span className={cn("absolute right-1 top-1 min-w-[15px] rounded-full bg-warning px-1 text-center text-[9px] font-bold leading-[15px] text-white", collapsed ? "block" : "lg:hidden")} aria-hidden="true">{badge}</span>
                  </>
                )}
                <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90", collapsed ? "hidden" : "hidden lg:block")} aria-hidden="true" />
              </Link>
              {open && s.items.length > 0 && (
                <div className={cn("mb-1 mt-0.5 ml-[19px] grid gap-px border-l border-border pl-3", collapsed ? "hidden" : "hidden lg:grid")}>
                  {s.items.map((l) => {
                    const current = l.href === activeHref;
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "relative flex h-8 items-center gap-2 rounded-md px-2.5 text-[12.5px] text-foreground transition-colors hover:bg-[#e4eef1]",
                          "before:absolute before:-left-[13px] before:top-1/2 before:h-px before:w-[9px] before:bg-border",
                          current && "bg-sidebar-accent font-semibold text-primary before:bg-primary",
                        )}
                      >
                        <span className="flex-1 truncate">{l.label}</span>
                        {(l.badge ?? 0) > 0 && <span className="rounded-sm bg-warning-soft px-1.5 text-[10px] font-bold leading-[18px] text-warning-foreground">{l.badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className={cn("mt-2 border-t pt-2", collapsed ? "flex justify-center" : "flex justify-center lg:block")}>
        <HelpMenu rail={collapsed} />
      </div>
    </aside>
  );
}
