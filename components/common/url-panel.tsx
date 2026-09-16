"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Panneau latéral piloté par l'adresse (?ligne=…) : la page d'origine reste en dessous, telle quelle ; fermer retire le
// paramètre sans recharger ni faire défiler. Le contenu est rendu côté serveur par la page qui lit le paramètre.
export function UrlPanel({ title, description, closeHref, children, testId, wide }: { title: ReactNode; description?: ReactNode; closeHref: string; children: ReactNode; testId?: string; wide?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) router.replace(closeHref, { scroll: false }); }}>
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
