"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Le détail d'une ligne (financement, dépense, action) s'ouvre en panneau latéral (revue du 15/09) :
// le tableau reste lisible pour qui lit, le panneau est le lieu de saisie pour qui tient la ligne.
export function RowPanel({ title, description, children, testId, openTestId, label = "Détail", className, wide, hint, defaultOpen = false }: { title: ReactNode; description?: ReactNode; children: ReactNode; testId?: string; openTestId?: string; label?: ReactNode; className?: string; wide?: boolean; hint?: string; defaultOpen?: boolean }) {
  // `defaultOpen` : ouvert à l'arrivée quand une autre page (la matrice) pointe cette ligne précise.
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className={cn("inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[11px] text-primary hover:bg-muted", className)} data-testid={openTestId ?? (testId ? `${testId}-open` : undefined)} title={hint ?? "Ouvrir le détail"}>{label}<ChevronRight className="size-3" /></button>
      </SheetTrigger>
      <SheetContent side="right" className={cn("flex w-full flex-col gap-0 overflow-y-auto", wide ? "data-[side=right]:sm:max-w-2xl" : "data-[side=right]:sm:max-w-xl")} data-testid={testId}>
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="grid gap-4 p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
