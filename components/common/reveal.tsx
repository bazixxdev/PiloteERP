"use client";

import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Créer, c'est un bouton (revue du 15/09) : le formulaire n'apparaît qu'au clic sur « + … », jamais vide en permanence.
export function Reveal({ label, testId, children, size = "sm", className, defaultOpen = false }: { label: string; testId?: string; children: ReactNode; size?: "xs" | "sm"; className?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!open) return <Button type="button" size={size} variant="outline" onClick={() => setOpen(true)} data-testid={testId} className={className}><Plus />{label}</Button>;
  return (
    <div className={cn("flex flex-wrap items-start gap-2", className)} data-testid={testId ? `${testId}-panel` : undefined}>
      {children}
      <Button type="button" size={size} variant="ghost" onClick={() => setOpen(false)} aria-label="Fermer" title="Fermer"><X /></Button>
    </div>
  );
}
