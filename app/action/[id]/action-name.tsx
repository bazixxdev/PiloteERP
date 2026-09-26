"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { AutoField } from "@/components/inline/auto-field";
import { V, du, le } from "@/lib/vocab";

const title = "text-[21px] font-bold leading-tight tracking-[-0.5px] sm:text-[25px] sm:tracking-[-0.7px]";

// Le nom de l'action se lit en titre (il passe à la ligne sur un téléphone) ; le crayon ouvre le champ, qui se referme une
// fois enregistré, ou quitté sans changement.
export function ActionName({ id, name, canEdit }: { id: string; name: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editing) box.current?.querySelector("input")?.focus(); }, [editing]);
  if (editing) {
    return (
      <div ref={box} className="min-w-0 flex-1 basis-[260px]" onBlur={(e) => { if ((e.target as HTMLInputElement).value === name) setEditing(false); }} onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}>
        <AutoField model="action" id={id} field="name" type="text" value={name} refreshOnSave onSaved={() => setEditing(false)} label={`Nom ${du(V.action)}`} testId="action-name" inputClassName={title} />
      </div>
    );
  }
  return (
    <h1 className={`group/name min-w-0 ${title}`}>
      {name}
      {canEdit && <button type="button" onClick={() => setEditing(true)} className="ml-1.5 inline-flex rounded p-0.5 align-middle text-muted-foreground/60 hover:text-primary" aria-label={`Renommer ${le(V.action)}`} title="Renommer" data-testid="action-name-edit"><Pencil className="size-4" /></button>}
    </h1>
  );
}
