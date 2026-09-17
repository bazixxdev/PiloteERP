import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";
import { SectionIcon } from "@/components/shell/section-icon";

export type DossiersTab = "projets" | "conventions" | "financeurs" | "organisations" | "matrice" | "appels";

// Sous-navigation « Projets et financements » : un H1 de section, les onglets dessous (actif souligné en bleu pétrole),
// puis une ligne compacte — le compteur à gauche, l'action principale à droite — collée au tableau (maquette de Gaël, 18/09).
// Les onglets restent visibles même quand la barre latérale montre le niveau 2 : ici ils sont la navigation de la page.
// Composant serveur : il lit les réglages lui-même (l'onglet Appels à projets suit le module veille).
export async function DossiersNav({ current }: { current: DossiersTab }) {
  const veille = instanceHas(await getSettings(), "veille");
  const tab = (key: DossiersTab, label: string, href: string) => (
    <Link key={key} href={href} data-testid={`dossiers-nav-${key}`} aria-current={current === key ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors", current === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</Link>
  );
  return (
    <nav className="flex flex-wrap gap-1 border-b" data-testid="dossiers-nav" aria-label="Projets et financements">
      {tab("projets", "Projets et éditions", "/projets")}
      {tab("conventions", "Conventions", "/conventions")}
      {tab("financeurs", "Financeurs", "/financeurs")}
      {tab("organisations", "Organisations", "/organisations")}
      {tab("matrice", "Qui finance quoi", "/matrice")}
      {veille && tab("appels", "Appels à projets", "/appels")}
    </nav>
  );
}

// En-tête complet d'un onglet : H1 « Projets et financements » avec l'icône de la section, onglets, puis la ligne compacte.
// `summary` = le compteur réel (« 9 financeurs ») et ce qui l'accompagne ; `tools` = filtres ou choix d'année, à gauche aussi ;
// `actions` = les boutons de l'onglet, une seule action principale colorée.
export async function DossiersHeader({ current, summary, tools, actions }: { current: DossiersTab; summary?: ReactNode; tools?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-3 flex items-center gap-3">
        <SectionIcon className="grid size-9 shrink-0 place-items-center rounded-md bg-info-soft text-primary print:hidden" />
        <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px] text-foreground">Projets et financements</h1>
      </div>
      <DossiersNav current={current} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2" data-testid="dossiers-toolbar">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          {summary && <span data-testid="dossiers-summary">{summary}</span>}
          {tools}
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
