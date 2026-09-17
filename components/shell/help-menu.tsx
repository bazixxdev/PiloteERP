"use client";

import { useState } from "react";
import { BookOpenText, CircleHelp, Keyboard } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LexiqueDialog } from "@/components/common/lexique-dialog";
import { cn } from "@/lib/utils";

// Bouton « Aide » en bas de la barre latérale (retour de Gaël, 17/09) : un seul endroit pour ce qui est transverse —
// le lexique, les raccourcis clavier, et ce qui viendra (guide de prise en main, contact). Les raccourcis restent dans
// components/shell/shortcuts.tsx : on lui envoie l'événement `pilote:aide-raccourcis`.
export const SHORTCUTS_EVENT = "pilote:aide-raccourcis";

export function HelpMenu({ rail }: { rail: boolean }) {
  const [lexique, setLexique] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Aide"
          aria-label="Aide"
          data-testid="help-open"
          className={cn(
            "flex items-center gap-2.5 rounded-md text-[12.5px] text-muted-foreground transition-colors hover:bg-[#e4eef1] hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 data-[state=open]:bg-[#e4eef1] data-[state=open]:text-primary",
            rail ? "h-10 w-11 justify-center" : "h-10 w-11 justify-center lg:h-8 lg:w-full lg:justify-start lg:px-2",
          )}
        >
          <CircleHelp className="size-[18px] shrink-0" aria-hidden="true" />
          <span className={cn("flex-1 truncate text-left", rail ? "hidden" : "hidden lg:inline")}>Aide</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-60">
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Aide</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setLexique(true)} data-testid="lexique-open"><BookOpenText />Lexique<span className="ml-auto text-[11px] text-muted-foreground">les mots de l&apos;outil</span></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => window.dispatchEvent(new Event(SHORTCUTS_EVENT))} data-testid="shortcuts-open"><Keyboard />Raccourcis clavier<kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[10px]">?</kbd></DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">Prototype Pilote · les retours se notent dans <span className="font-medium text-foreground">docs/RETOURS-A-CHAUD.md</span>.</div>
        </DropdownMenuContent>
      </DropdownMenu>
      <LexiqueDialog open={lexique} onOpenChange={setLexique} />
    </>
  );
}
