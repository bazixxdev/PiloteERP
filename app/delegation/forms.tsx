"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Flag, Landmark, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { acknowledgeDelegations, consignBoardPresentation, createDelegations, deleteDelegation, setActionCheckpoint, updateDelegation } from "@/app/actions/delegation";
import { addAction } from "@/app/actions/edition";

type R = { ok: true } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error); return; }
      after?.();
      router.refresh();
    });
  return { pending, run };
}

// Attendus, limites, contrôles d'une délégation : un seul enregistrement pour les trois (une révision par modification).
export function DelegationTextForm({ id, expectations, limits, controls }: { id: string; expectations: string | null; limits: string | null; controls: string | null }) {
  const [v, setV] = useState({ expectations: expectations ?? "", limits: limits ?? "", controls: controls ?? "" });
  const { pending, run } = useRun();
  const dirty = v.expectations !== (expectations ?? "") || v.limits !== (limits ?? "") || v.controls !== (controls ?? "");
  const field = (key: keyof typeof v, label: string, placeholder: string) => (
    <label className="grid content-start gap-1 text-xs font-medium text-muted-foreground">{label}
      <Textarea value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} placeholder={placeholder} rows={3} className="text-sm font-normal text-foreground" data-testid={`delegation-${key}-${id}`} />
    </label>
  );
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(() => updateDelegation(id, v)); }}>
      <div className="grid gap-2 md:grid-cols-3">
        {field("expectations", "Attendus", "Ce qui doit être atteint, et quand")}
        {field("limits", "Limites", "Délégation totale avec les limites suivantes…")}
        {field("controls", "Contrôles", "Comment et quand on fait le point (bilans, compte rendu au CA…)")}
      </div>
      {dirty && <div><Button type="submit" size="sm" disabled={pending} data-testid={`delegation-save-${id}`}><Check />Enregistrer (la personne devra relire)</Button></div>}
    </form>
  );
}

export function AcknowledgeButton({ ids }: { ids: string[] }) {
  const { pending, run } = useRun();
  return <Button size="sm" disabled={pending} onClick={() => run(() => acknowledgeDelegations(ids))} data-testid="delegation-ack"><Check />J&apos;ai pris connaissance</Button>;
}

export function BoardPresentationForm({ personId, year }: { personId: string; year: number }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const { pending, run } = useRun();
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="delegation-board"><Landmark />Consigner la présentation au CA</Button>;
  return (
    <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); run(() => consignBoardPresentation(personId, year, date, note), () => setOpen(false)); }}>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40 text-sm" data-testid="delegation-board-date" />
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Précision (facultatif)" className="h-8 w-64 text-sm" />
      <Button type="submit" size="sm" disabled={pending || !date} data-testid="delegation-board-save"><Check />Consigner</Button>
    </form>
  );
}

export function NewDelegationForm({ people, editions, year }: { people: { id: string; name: string }[]; editions: { id: string; name: string }[]; year: number }) {
  const [personId, setPersonId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const router = useRouter();
  const { pending, run } = useRun();
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(() => createDelegations(personId, picked), () => { router.push(`/delegation?personne=${personId}&annee=${year}`); setPicked([]); }); }} data-testid="delegation-new">
      <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm" aria-label="Personne" data-testid="delegation-new-person">
        <option value="">Choisir une personne…</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="max-h-48 overflow-y-auto rounded-md border p-2 text-sm">
        {editions.map((e) => (
          <label key={e.id} className="flex items-center gap-2 py-0.5">
            <input type="checkbox" checked={picked.includes(e.id)} onChange={(ev) => setPicked(ev.target.checked ? [...picked, e.id] : picked.filter((x) => x !== e.id))} data-testid={`delegation-new-edition-${e.id}`} />{e.name}
          </label>
        ))}
      </div>
      <div><Button type="submit" size="sm" disabled={pending || !personId || picked.length === 0} data-testid="delegation-new-submit"><Plus />Créer la délégation</Button></div>
    </form>
  );
}

export function AddObjectiveForm({ editionId, ownerId }: { editionId: string; ownerId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [checkpoint, setCheckpoint] = useState(false);
  const { pending, run } = useRun();
  if (!open) return <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(true)} data-testid={`delegation-add-objective-${editionId}`}><Plus />Ajouter un objectif</Button>;
  return (
    <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); run(() => addAction(editionId, name, { ownerId, milestoneDate: date || undefined, isCheckpoint: checkpoint }), () => { setOpen(false); setName(""); setDate(""); setCheckpoint(false); }); }}>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Objectif ou résultat attendu" className="h-7 w-64 text-xs" data-testid={`delegation-objective-name-${editionId}`} />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 w-36 text-xs" data-testid={`delegation-objective-date-${editionId}`} />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={checkpoint} onChange={(e) => setCheckpoint(e.target.checked)} />point de contrôle</label>
      <Button type="submit" size="xs" variant="outline" disabled={pending || !name.trim()} data-testid={`delegation-objective-save-${editionId}`}><Check />Ajouter</Button>
    </form>
  );
}

export function CheckpointToggle({ actionId, value }: { actionId: string; value: boolean }) {
  const { pending, run } = useRun();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => setActionCheckpoint(actionId, !value))} title={value ? "Retirer des points de contrôle" : "Marquer comme point de contrôle"} className={value ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"} data-testid={`delegation-checkpoint-${actionId}`}>
      <Flag className="size-3.5" />
    </button>
  );
}

export function DeleteDelegationButton({ id }: { id: string }) {
  const { pending, run } = useRun();
  return <Button type="button" size="icon-xs" variant="ghost" disabled={pending} onClick={() => { if (confirm("Supprimer cette délégation et son historique ? Les étapes, tâches et indicateurs du projet restent.")) run(() => deleteDelegation(id)); }} aria-label="Supprimer la délégation" data-testid={`delegation-delete-${id}`}><Trash2 /></Button>;
}
