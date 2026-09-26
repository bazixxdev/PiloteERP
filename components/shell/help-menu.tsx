"use client";

import Link from "next/link";
import { BookOpenText, CircleHelp, Keyboard } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Bouton « Aide » en bas de la barre latérale (retour de Gaël, 17/09) : un seul endroit pour ce qui est transverse —
// le guide de l'outil (page /aide, qui remplace le dialogue Lexique le 26/09), les raccourcis clavier, et ce qui viendra. Les raccourcis restent dans
// components/shell/shortcuts.tsx : on lui envoie l'événement `pilote:aide-raccourcis`.
export const SHORTCUTS_EVENT = "pilote:aide-raccourcis";

export function HelpMenu({ rail }: { rail: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Aide"
        aria-label="Aide"
        data-testid="help-open"
        className={cn(
          "flex items-center gap-2.5 rounded-md text-[13px] text-foreground transition-colors hover:bg-sidebar-accent hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 data-[state=open]:bg-sidebar-accent data-[state=open]:text-primary",
          rail ? "h-10 w-11 justify-center" : "h-10 w-11 justify-center lg:h-9 lg:w-full lg:justify-start lg:px-2.5",
        )}
      >
        <CircleHelp className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={cn("flex-1 truncate text-left", rail ? "hidden" : "hidden lg:inline")}>Aide et assistance</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-60">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Aide</DropdownMenuLabel>
        <DropdownMenuItem asChild><Link href="/aide" data-testid="lexique-open"><BookOpenText />Guide de l&apos;outil<span className="ml-auto text-[11px] text-muted-foreground">tous les mots</span></Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.dispatchEvent(new Event(SHORTCUTS_EVENT))} data-testid="shortcuts-open"><Keyboard />Raccourcis clavier<kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[10px]">?</kbd></DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">Prototype Pilote · les retours se notent dans <span className="font-medium text-foreground">docs/RETOURS-A-CHAUD.md</span>.</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
