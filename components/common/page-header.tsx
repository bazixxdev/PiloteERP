import type { ReactNode } from "react";
import { SectionIcon } from "@/components/shell/section-icon";

// Titre de page : l'icône de l'écran (la même que dans le menu), le titre, un sous-titre, des actions à droite.
export function PageHeader({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    // Les actions restent à droite dès la largeur tablette, même avec un long sous-titre (retour du 15/09) ; elles passent dessous seulement sur mobile.
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4 md:flex-nowrap">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <SectionIcon className="mt-[3px] grid size-9 shrink-0 place-items-center rounded-md bg-info-soft text-primary print:hidden" />
        <div className="min-w-0">
          <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px] text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 md:ml-auto md:justify-end">{actions}</div>}
    </div>
  );
}
