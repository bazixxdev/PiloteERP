"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addTask } from "@/app/actions/tasks";
import { Select } from "@/components/common/searchable-select";
import { V, cap, le, ce } from "@/lib/vocab";

// « Me créer une tâche » : une tâche personnelle rattachée à l'édition (et, au choix, à une action) ; elle vit dans Ma semaine.
export function CreateTaskButton({ editionId, actions, compact }: { editionId: string; actions: { id: string; name: string }[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [actionId, setActionId] = useState("");
  const [due, setDue] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="outline" size={compact ? "xs" : "default"} data-testid={compact ? "task-from-apercu" : "task-from-edition"} title={`Une tâche pour moi, rattachée à ${ce(V.edition)}`}><ListTodo />{compact ? "Tâche" : "Tâche"}</Button></PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addTask({ label, dueDate: due || null, editionId, actionId: actionId || null }); if (!r.ok) { toast.error(r.error); return; } toast.success("Tâche ajoutée à « Ma semaine »"); setOpen(false); setLabel(""); setDue(""); router.refresh(); }); }}>
          <div className="text-sm font-semibold">Une tâche pour moi</div>
          <p className="text-[11px] text-muted-foreground">{`Privée : elle n'apparaît que dans votre « Ma semaine », rattachée à ${ce(V.edition)}.`}</p>
          <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Relancer le financeur, préparer le support…" aria-label="Tâche" data-testid="task-from-edition-label" />
          <Select className="h-8 w-full rounded-lg border bg-card px-2 text-sm" value={actionId} onChange={(e) => setActionId(e.target.value)} aria-label={`${cap(V.action)} concernée`}><option value="">{`— ${le(V.edition)} entière —`}</option>{actions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Échéance (facultative)" className="h-8" />
          <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" size="sm" disabled={pending || !label.trim()} data-testid="task-from-edition-submit">Ajouter</Button></div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
