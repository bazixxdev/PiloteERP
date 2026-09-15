"use client";

import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

// Lecture d'abord : la valeur se lit en clair ; le champ de saisie n'apparaît qu'au clic sur le crayon (revue du 15/09).
export function ClickToEdit({ value, editor, canEdit, testId, className, valueClassName, hint }: { value: ReactNode; editor: ReactNode; canEdit: boolean; testId?: string; className?: string; valueClassName?: string; hint?: string }) {
  const [editing, setEditing] = useState(false);
  if (editing && canEdit) return <div className={className}>{editor}</div>;
  return (
    <div className={cn("group/cte flex items-center gap-1.5", className)}>
      <span className={valueClassName}>{value}</span>
      {canEdit && <button type="button" onClick={() => setEditing(true)} className="rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity group-hover/cte:opacity-100 hover:text-primary focus-visible:opacity-100" aria-label={hint ?? "Modifier"} title={hint ?? "Modifier"} data-testid={testId}><Pencil className="size-3.5" /></button>}
    </div>
  );
}
