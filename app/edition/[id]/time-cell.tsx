"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { AutoField } from "@/components/inline/auto-field";
import { Gauge } from "@/components/common/gauge";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// Colonne « Temps » d'une action : « 46 / 14 h » et sa jauge ; l'objectif s'édite au clic sur le crayon (lecture d'abord).
export function TimeCell({ actionId, name, consumed, target, canEdit, over }: { actionId: string; name: string; consumed: number; target: number | null; canEdit: boolean; over: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="tabular text-muted-foreground">{fmtNumber(consumed, 0)} h /</span>
        <div className="w-24"><AutoField model="action" id={actionId} field="timeTarget" type="number" value={target} suffix="h" label={`Objectif en heures, ${name}`} placeholder="objectif" refreshOnSave onSaved={() => setEditing(false)} /></div>
      </div>
    );
  }
  return (
    <div className="group/tc flex items-center gap-2">
      <span className={cn("shrink-0 text-xs tabular", over && "font-semibold text-danger")} title={target ? `${fmtNumber(consumed, 1)} h consommées sur ${target} h prévues` : `${fmtNumber(consumed, 1)} h consommées, objectif non fixé`}>
        {fmtNumber(consumed, 0)}<span className="text-muted-foreground"> / {target ?? "—"} h</span>
      </span>
      <Gauge value={consumed} max={target} alertPercent={90} bare />
      {canEdit && <button type="button" onClick={() => setEditing(true)} className="rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity group-hover/tc:opacity-100 hover:text-primary focus-visible:opacity-100" aria-label={`Modifier l'objectif de temps, ${name}`} title="Modifier l'objectif" data-testid={`action-target-edit-${actionId}`}><Pencil className="size-3" /></button>}
    </div>
  );
}
