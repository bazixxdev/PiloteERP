"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setActionPeople } from "@/app/actions/actions";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; active: boolean };
const shown = (p: Person) => (p.active ? p.name : `${p.name} (inactive)`);

// Personnes associées : elles se lisent (quelques noms, pas toutes les puces) ; le sélecteur n'apparaît que sur « Modifier »,
// comme l'équipe d'une année (team-section.tsx). `associates` vient de l'action (une personne partie y reste, signalée) ;
// `people` = les personnes actives proposables.
export function PeopleSection({ actionId, people, associates, canEdit }: { actionId: string; people: { id: string; name: string }[]; associates: Person[]; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const members = associates;
  const selected = associates.map((p) => p.id);
  // Le sélecteur propose les personnes actives, plus les associées parties (pour pouvoir les retirer).
  const choices: Person[] = [...people.map((p) => ({ ...p, active: true })), ...associates.filter((a) => !a.active)];
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Personnes associées</span>
        {canEdit && (editing
          ? <Button size="xs" variant="outline" onClick={() => setEditing(false)} data-testid="action-people-done"><Check />Terminer</Button>
          : <Button size="xs" variant="outline" onClick={() => setEditing(true)} data-testid="action-people-edit"><Pencil />Modifier</Button>)}
      </div>
      {editing && canEdit ? (
        <>
          <p className="text-[11px] text-muted-foreground">Elles modifient le contenu, la période et les jalons, comme la personne responsable.</p>
          <PeoplePicker actionId={actionId} people={choices} selected={selected} readOnly={false} />
        </>
      ) : members.length === 0 ? (
        <p className="text-sm italic text-muted-foreground" data-testid="action-people-list">Aucune.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm" data-testid="action-people-list">{members.map((m) => <li key={m.id} className={cn(!m.active && "text-muted-foreground")}>{shown(m)}</li>)}</ul>
      )}
    </div>
  );
}

// Le sélecteur : toutes les personnes actives, y compris celles qui ne suivent pas leur temps ; les personnes déjà associées
// d'abord. Un clic ajoute ou retire ; la liste entière part d'un coup.
function PeoplePicker({ actionId, people, selected, readOnly }: { actionId: string; people: Person[]; selected: string[]; readOnly: boolean }) {
  const [sel, setSel] = useState(new Set(selected));
  const [pending, start] = useTransition();
  const router = useRouter();
  const key = selected.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setSel(new Set(selected)), [key]);
  // Ordre figé à l'ouverture (les associées d'abord) : une puce ne saute pas sous le doigt quand on la coche.
  const [order] = useState(() => [...people].sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id))));
  const toggle = (id: string) => {
    if (readOnly) return;
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSel(next);
    start(async () => {
      const res = await setActionPeople(actionId, [...next]);
      if (!res.ok) { toast.error(res.error); setSel(new Set(selected)); return; }
      router.refresh();
    });
  };
  return (
    <div className={cn("flex flex-wrap gap-1.5", pending && "opacity-60")}>
      {order.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={readOnly}
          aria-pressed={sel.has(p.id)}
          onClick={() => toggle(p.id)}
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-colors",
            sel.has(p.id) ? "border-primary bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted",
            readOnly && !sel.has(p.id) && "hidden",
          )}
        >
          {shown(p)}
        </button>
      ))}
      {readOnly && sel.size === 0 && <span className="text-sm text-muted-foreground">Aucune personne associée.</span>}
    </div>
  );
}
