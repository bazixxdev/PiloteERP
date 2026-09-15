"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { iconFor } from "./section-icons";
import { cn } from "@/lib/utils";
import { withBase } from "@/lib/base-path";

// Barre latérale V2 : fond clair, logo CRESS sur fond transparent.
// Les groupes suivent le profil : un salarié commence par Ma semaine, Temps et ses projets ; les accès collectifs ou
// occasionnels viennent ensuite, et les écrans CODIR et Séminaire n'apparaissent qu'aux rôles CODIR. L'admin est dans le menu utilisateur.
type Item = { href: string; label: string };
type Group = { caption: string; items: Item[] };

function groupsFor(role: string): Group[] {
  const codir = ["director", "raf", "pole_lead"].includes(role);
  // Tâches et Notes ne sont plus ici (retour du 15/09) : elles vivent dans la barre haute (menus rapides) et, sur mobile, dans la navigation basse.
  const work: Item[] = codir
    ? [
        { href: "/portefeuille", label: "Portefeuille" },
        { href: "/ma-semaine", label: "Ma semaine" },
        { href: "/temps", label: "Temps" },
        { href: "/demandes", label: "Demandes" },
      ]
    : [
        { href: "/ma-semaine", label: "Ma semaine" },
        { href: "/temps", label: "Temps" },
        { href: "/portefeuille", label: "Mes projets" },
        { href: "/demandes", label: "Demandes" },
      ];
  const collective: Item[] = [
    { href: "/cafe", label: "Écran café" },
    { href: "/annuel", label: "Vue annuelle" },
    { href: "/plan-de-charge", label: "Plan de charge" },
    { href: "/projets", label: "Projets et financements" },
    { href: "/echeances", label: "Échéances" },
  ];
  const direction: Item[] = codir ? [
    { href: "/codir", label: "Écran CODIR" },
    { href: "/seminaire", label: "Séminaire" },
  ] : [];
  return [
    { caption: codir ? "Espace de travail" : "Mon travail", items: work },
    { caption: "Toute la CRESS", items: collective },
    ...(direction.length ? [{ caption: "Direction", items: direction }] : []),
  ];
}

// Barre latérale sans pied ni liste des pôles : les pôles se filtrent depuis le portefeuille, l'aide « ? » reste au clavier.
export function Sidebar({ pendingCount, remindersCount, requestsCount = 0, role }: { pendingCount: number; remindersCount: number; requestsCount?: number; role: string }) {
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
                const active = pathname === item.href || pathname.startsWith(item.href + "/") || (item.href === "/demandes" && pathname.startsWith("/validations")) || (item.href === "/portefeuille" && pathname.startsWith("/edition")) || (item.href === "/temps" && pathname.startsWith("/cloture")) || (item.href === "/projets" && (pathname.startsWith("/conventions") || pathname.startsWith("/financeurs")));
                const Icon = iconFor(item.href)!;
                // Demandes et validations fusionnées (15/09) : un seul badge = ce que j'ai à traiter, des deux côtés.
                const badge = item.href === "/echeances" ? remindersCount : item.href === "/demandes" ? requestsCount + pendingCount : 0;
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
                    <Icon className="size-4 shrink-0" />
                    <span className="hidden flex-1 lg:inline">{item.label}</span>
                    {badge > 0 && <span className="hidden rounded-sm bg-warning-soft px-1.5 text-[10px] font-semibold text-warning-foreground lg:inline" title="À traiter par moi" aria-label={`${badge} à traiter par moi`}>{badge}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}
