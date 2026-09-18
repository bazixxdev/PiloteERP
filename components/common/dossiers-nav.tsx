import type { ReactNode } from "react";
import { SectionIcon } from "@/components/shell/section-icon";

export type DossiersTab = "projets" | "conventions" | "financeurs" | "organisations" | "contacts" | "matrice" | "appels";

// Retour de Gaël (18/09) : les onglets sous le titre doublaient le menu de gauche, et le titre « Projets et financements » ne
// disait pas où l'on était. Chaque page porte désormais son propre titre (celui de la feuille du menu), puis la ligne compacte —
// le compteur à gauche, l'action principale à droite — collée au tableau.
const TITLES: Record<DossiersTab, string> = { projets: "Projets", conventions: "Conventions", financeurs: "Financeurs", organisations: "Organisations", contacts: "Contacts", matrice: "Qui finance quoi", appels: "Appels à projets" };

export async function DossiersHeader({ current, summary, tools, actions }: { current: DossiersTab; summary?: ReactNode; tools?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-3 flex items-center gap-3">
        <SectionIcon className="grid size-9 shrink-0 place-items-center rounded-md bg-info-soft text-primary print:hidden" />
        <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px] text-foreground" data-testid={`dossiers-title-${current}`}>{TITLES[current]}</h1>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2" data-testid="dossiers-toolbar">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          {summary && <span data-testid="dossiers-summary">{summary}</span>}
          {tools}
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
