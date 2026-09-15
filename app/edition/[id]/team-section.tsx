"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shell/person-switcher";
import { TeamPicker } from "./team-picker";

// L'équipe se lit (deux noms, pas quatorze chips) ; le sélecteur n'apparaît que sur « Modifier » (revue du 15/09).
export function TeamSection({ editionId, people, selected, canEdit }: { editionId: string; people: { id: string; name: string; role: string }[]; selected: string[]; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const members = people.filter((p) => selected.includes(p.id));
  return (
    <section id="equipe" className="scroll-mt-20 rounded-md border bg-card px-[18px] py-4" data-testid="team-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h4 className="text-sm font-bold">Équipe projet</h4>
          <span className="text-[10px] text-muted-foreground">{members.length ? `${members.length} personne${members.length > 1 ? "s" : ""} · choisie par le pilote` : "choisie par le pilote"}</span>
        </div>
        {canEdit && (editing
          ? <Button size="xs" variant="outline" onClick={() => setEditing(false)} data-testid="team-done"><Check />Terminer</Button>
          : <Button size="xs" variant="outline" onClick={() => setEditing(true)} data-testid="team-edit"><Pencil />Modifier</Button>)}
      </div>
      {editing && canEdit ? (
        <div className="mt-3"><TeamPicker editionId={editionId} people={people.map((p) => ({ id: p.id, name: p.name }))} selected={selected} readOnly={false} /></div>
      ) : members.length === 0 ? (
        <p className="mt-2 text-sm italic text-muted-foreground">Aucune personne affectée.</p>
      ) : (
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {members.map((m) => <li key={m.id} className="inline-flex items-center gap-1.5"><Avatar name={m.name} role={m.role} />{m.name}</li>)}
        </ul>
      )}
    </section>
  );
}
