"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookUser, CalendarDays, CalendarClock, Clock, FileSignature, HandCoins, Inbox, Landmark, PanelLeftClose, PanelLeftOpen, Package, Settings, ChevronRight, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { branding } from "@/lib/branding";
import { locate, type NavSection } from "@/lib/navigation";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpMenu } from "./help-menu";
import { PersonSwitcher } from "./person-switcher";
import type { AccountProps } from "./account-data";

// Barre latérale à deux niveaux (proto validé le 17/09) : une section par icône, la section de la page courante dépliée
// avec ses feuilles reliées par un trait d'arbre, les autres repliées. Un bouton la réduit en rail d'icônes (choix mémorisé) ;
// sous `lg`, elle est toujours en rail. L'arbre vient du serveur (lib/navigation.ts), ici on n'affiche que ce qu'on reçoit.
const SECTION_ICONS: Record<NavSection["id"], LucideIcon> = {
  travail: CalendarDays,
  temps: Clock,
  demandes: Inbox,
  projets: FileSignature,
  financements: HandCoins,
  annuaire: BookUser,
  adherents: Users,
  tresorerie: Wallet,
  materiel: Package,
  echeances: CalendarClock,
  direction: Landmark,
  admin: Settings,
};

const STORAGE_KEY = "pilote-sidebar-collapsed";

// Sous-menu flottant du rail (retour de Gaël, 17/09) : au clic sur l'icône d'une section qui a des sous-rubriques, un panneau
// à droite (8 px), fond blanc, coins arrondis, ombre légère, sans flèche — le nom de la section, ses feuilles et leurs compteurs.
// Un seul ouvert à la fois ; il se ferme après un choix, un clic dehors, un second clic sur l'icône ou Échap (le focus revient
// sur l'icône). Au survol, une info-bulle donne le nom, sauf quand le panneau est ouvert. La barre ne se déplie pas.
function RailSection({ s, Icon, activeHref, isOpen, onOpenChange }: { s: NavSection; Icon: LucideIcon; activeHref: string | null; isOpen: boolean; onOpenChange: (o: boolean) => void }) {
  const badge = s.badge ?? 0;
  // L'info-bulle se ferme au clic et à chaque changement de page : sinon elle reste plantée sur l'icône une fois arrivé.
  const [tip, setTip] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setTip(false); }, [pathname]);
  const within = s.items.some((l) => l.href === activeHref);
  // L'infobulle ne s'ouvre qu'au survol : Radix l'ouvrait aussi au focus, et le panneau d'une rubrique rend le focus à l'icône en se
  // fermant — l'infobulle restait affichée après chaque navigation (retour de Gaël, 19/09). preventDefault() coupe l'ouverture au focus.
  const noTipOnFocus = (e: React.FocusEvent) => e.preventDefault();
  const iconClass = cn(
    "relative grid h-10 w-11 place-items-center rounded-md text-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20",
    within && !isOpen && "bg-primary text-primary-foreground hover:bg-primary",
    isOpen && "bg-sidebar-accent text-primary",
  );
  const dot = badge > 0 && <span className="absolute right-1 top-1 min-w-[15px] rounded-full bg-warning px-1 text-center text-[9px] font-bold leading-[15px] text-white" aria-hidden="true">{badge}</span>;
  if (s.items.length <= 1) {
    // Une rubrique sans sous-menu (ou à une seule feuille) mène directement à sa page.
    return (
      <Tooltip open={tip} onOpenChange={setTip}>
        <TooltipTrigger asChild>
          <Link href={s.items[0]?.href ?? "/portefeuille"} aria-label={s.label} aria-current={within ? "page" : undefined} className={iconClass} data-testid={`rail-${s.id}`} onClick={() => setTip(false)} onFocus={noTipOnFocus}><Icon className="size-5" />{dot}</Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={6}>{s.label}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <Tooltip open={isOpen ? false : tip} onOpenChange={setTip}>
        <TooltipTrigger asChild>
          <PopoverAnchor asChild>
            {/* Ouverture pilotée à la main : un second clic sur l'icône ferme (le déclencheur Radix, pris entre le clic « dehors » et le sien, rouvrait). */}
            <button type="button" aria-label={s.label} aria-haspopup="menu" aria-expanded={isOpen} aria-current={within && !isOpen ? "page" : undefined} className={iconClass} data-testid={`rail-${s.id}`} onFocus={noTipOnFocus} onClick={() => { setTip(false); onOpenChange(!isOpen); }}><Icon className="size-5" />{dot}</button>
          </PopoverAnchor>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={6}>{s.label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="right" align="start" sideOffset={8} collisionPadding={8} className="w-64 gap-0 p-1.5 shadow-lg ring-border" data-testid={`rail-panel-${s.id}`}
        onInteractOutside={(e) => { if ((e.detail.originalEvent.target as Element | null)?.closest?.(`[data-testid="rail-${s.id}"]`)) e.preventDefault(); }}
        onCloseAutoFocus={(e) => { e.preventDefault(); (document.querySelector(`[data-testid="rail-${s.id}"]`) as HTMLElement | null)?.focus(); }}
      >
        <div className="flex items-center gap-2.5 px-2 pb-1.5 pt-1">
          <Icon className="size-[18px] shrink-0 text-foreground" aria-hidden="true" />
          <span className="flex-1 truncate text-[15px] font-semibold text-foreground">{s.label}</span>
          {badge > 0 && <span className="rounded-sm bg-warning-soft px-1.5 text-[11px] font-bold leading-[20px] text-warning-foreground" aria-label={`${badge} à traiter par moi`}>{badge}</span>}
        </div>
        <ul className="grid gap-0.5" role="list">
          {s.items.map((l) => {
            const current = l.href === activeHref;
            return (
              <li key={l.href}>
                <Link href={l.href} onClick={() => onOpenChange(false)} aria-current={current ? "page" : undefined} className={cn("flex h-9 items-center gap-2 rounded-md px-2.5 text-[13.5px] text-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20", current && "bg-sidebar-accent font-semibold text-primary")}>
                  <span className="flex-1 truncate">{l.label}</span>
                  {(l.badge ?? 0) > 0 && <span className="rounded-sm bg-warning-soft px-1.5 text-[11px] font-bold leading-[20px] text-warning-foreground">{l.badge}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function Sidebar({ tree, account }: { tree: NavSection[]; account: AccountProps }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { section: openId, leaf: activeHref } = locate(tree, pathname, params);
  const [collapsed, setCollapsed] = useState(false);
  // Le rail vaut aussi sous `lg` (pas la place) : on le sait seulement dans le navigateur, d'où l'état après montage.
  const [narrow, setNarrow] = useState<boolean | null>(null);
  const [flyout, setFlyout] = useState<NavSection["id"] | null>(null);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === "1"); } catch { /* stockage indisponible : barre déployée */ }
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const rail = narrow !== null && (collapsed || narrow);
  useEffect(() => { if (!rail) setFlyout(null); }, [rail]);
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
      {/* Logo réduit d'un cinquième et davantage d'air avant la première rubrique (maquette du 17/09). */}
      <div className={cn("flex items-center pb-6 pt-1", collapsed ? "flex-col gap-2" : "flex-col gap-2 lg:flex-row lg:justify-between lg:px-1")}>
        <Link href="/portefeuille" className="flex items-center justify-center" aria-label={`${branding().longName} · Portefeuille`}>
          <Logo variant="color" className={cn("w-[120px]", collapsed ? "hidden" : "hidden lg:block")} />
          <Logo variant="mark" decorative className={cn("w-8", collapsed ? "block" : "lg:hidden")} />
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"}
          title={collapsed ? "Déployer le menu" : "Réduire le menu"}
          className="hidden size-7 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-primary lg:grid"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <nav className={cn("flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden", rail && "items-center")} aria-label="Navigation principale">
        <TooltipProvider delayDuration={300}>
        {tree.map((s) => {
          const Icon = SECTION_ICONS[s.id];
          if (rail) return <RailSection key={s.id} s={s} Icon={Icon} activeHref={activeHref} isOpen={flyout === s.id} onOpenChange={(o) => setFlyout(o ? s.id : null)} />;
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
                  "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium text-foreground transition-colors hover:bg-sidebar-accent",
                  collapsed ? "h-10 w-11 justify-center px-0" : "h-10 w-11 justify-center px-0 lg:h-10 lg:w-full lg:justify-start lg:px-2.5",
                  open && "font-semibold text-primary",
                  // En rail, la section ouverte est la seule marque de l'endroit où l'on est : fond pétrole, icône blanche.
                  open && (collapsed ? "bg-primary text-primary-foreground hover:bg-primary" : "bg-primary text-primary-foreground hover:bg-primary lg:bg-transparent lg:text-primary lg:hover:bg-sidebar-accent"),
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
                <div className={cn("mb-1.5 mt-1 ml-[21px] grid gap-0.5 border-l border-sidebar-border pl-3", collapsed ? "hidden" : "hidden lg:grid")}>
                  {s.items.map((l) => {
                    const current = l.href === activeHref;
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "relative flex h-8 items-center gap-2 rounded-md px-3 text-[13px] text-foreground transition-colors hover:bg-sidebar-accent",
                          "before:absolute before:-left-[13px] before:top-1/2 before:h-px before:w-[9px] before:bg-sidebar-border",
                          // Feuille courante : fond bleu pétrole, texte blanc (maquette du 17/09).
                          current && "bg-primary font-semibold text-primary-foreground hover:bg-primary before:bg-primary",
                        )}
                      >
                        <span className="flex-1 truncate">{l.label}</span>
                        {(l.badge ?? 0) > 0 && <span className={cn("rounded-sm px-1.5 text-[10px] font-bold leading-[18px]", current ? "bg-white/90 text-primary" : "bg-warning-soft text-warning-foreground")}>{l.badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        </TooltipProvider>
      </nav>
      {/* Bas de barre, toujours visible : l'aide, puis le compte (menu vers le haut). */}
      <div className={cn("mt-2 grid gap-1.5 border-t border-sidebar-border pt-2", collapsed ? "justify-items-center" : "justify-items-center lg:justify-items-stretch")}>
        <HelpMenu rail={collapsed} />
        <PersonSwitcher {...account} variant="sidebar" rail={collapsed} />
      </div>
    </aside>
  );
}
