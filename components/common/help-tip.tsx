"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Une phrase d'aide au plus sous un titre ; la règle complète se lit ici, au clic, jamais en permanence (revue du 15/09).
export function HelpTip({ title, children, testId, align = "start" }: { title?: string; children: ReactNode; testId?: string; align?: "start" | "center" | "end" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary" aria-label={title ? `Aide : ${title}` : "Aide"} title={title ?? "Comment ça marche"} data-testid={testId ? `${testId}-open` : undefined}>
          <CircleHelp className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[380px] max-w-[92vw] text-xs leading-relaxed" data-testid={testId}>
        {title && <div className="font-semibold text-foreground">{title}</div>}
        {children}
      </PopoverContent>
    </Popover>
  );
}
