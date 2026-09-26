"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/common/reveal";
import { addMilestone, deleteMilestone, updateMilestone } from "@/app/actions/actions";
import { fmtDate } from "@/lib/format";
import { plausibleDay } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { useRun } from "@/components/common/use-run";

export type MilestoneView = { id: string; date: string; label: string; done: boolean; venue: string | null; participants: string | null; isPublic: boolean; isCheckpoint: boolean; late: boolean };

const box = "size-4 rounded border-border accent-primary";
const field = "w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm transition-colors hover:border-border focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20";

// Les jalons de l'action : une ligne par jalon (fait, date, libellé ; dessous lieu, participants, public, point de contrôle),
// chaque champ enregistré en le quittant, comme AutoField. La date d'un jalon ne s'efface pas : pour l'enlever, on le supprime.
export function Milestones({ actionId, items, readOnly }: { actionId: string; items: MilestoneView[]; readOnly: boolean }) {
  return (
    <div className="grid gap-3">
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Aucun jalon pour l'instant.</p> : (
        <ul className="divide-y" data-testid="milestones">
          {items.map((m, i) => readOnly ? <ReadRow key={m.id} m={m} i={i} /> : <EditRow key={m.id} m={m} i={i} />)}
        </ul>
      )}
      {!readOnly && <AddMilestoneForm actionId={actionId} />}
    </div>
  );
}

function ReadRow({ m, i }: { m: MilestoneView; i: number }) {
  const extra = [m.venue, m.participants, m.isPublic ? "public" : null, m.isCheckpoint ? "point de contrôle" : null].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-sm" data-testid={`milestone-row-${i}`} data-done={m.done ? "true" : "false"}>
      <span className={cn("w-24 shrink-0 tabular", m.late ? "font-medium text-danger" : "text-muted-foreground")}>{fmtDate(m.date)}</span>
      <span className={cn("min-w-0 flex-1", m.done && "text-muted-foreground line-through")}>{m.label}</span>
      {m.done && <span className="text-[11px] text-mint">Fait</span>}
      {extra && <span className="basis-full pl-[6.5rem] text-xs text-muted-foreground">{extra}</span>}
    </li>
  );
}

function EditRow({ m, i }: { m: MilestoneView; i: number }) {
  const { pending, run } = useRun();
  const [date, setDate] = useState(m.date);
  const [label, setLabel] = useState(m.label);
  const [venue, setVenue] = useState(m.venue ?? "");
  const [participants, setParticipants] = useState(m.participants ?? "");
  // Cases cochées tout de suite (la page relue confirme), décochées si la commande refuse.
  const [done, setDone] = useState(m.done);
  const [isPublic, setIsPublic] = useState(m.isPublic);
  const [isCheckpoint, setIsCheckpoint] = useState(m.isCheckpoint);
  // La page relue ne réécrit pas une date en cours de frappe (le champ a le focus).
  const dateInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (dateInput.current !== document.activeElement) setDate(m.date); setLabel(m.label); setVenue(m.venue ?? ""); setParticipants(m.participants ?? ""); setDone(m.done); setIsPublic(m.isPublic); setIsCheckpoint(m.isCheckpoint); }, [m.date, m.label, m.venue, m.participants, m.done, m.isPublic, m.isCheckpoint]);
  const save = (patch: Parameters<typeof updateMilestone>[1], revert?: () => void) => run(() => updateMilestone(m.id, patch), undefined, (msg) => { toast.error(msg); revert?.(); });
  // N'envoie qu'une date complète ET plausible : en cours de frappe, un champ date natif émet « 0002-03-18 », « 0020-… »
  // (qui étendraient la période jusqu'à l'an 2) ; une date déjà envoyée ne repart pas. Vidé puis quitté, le champ reprend sa date.
  const lastSent = useRef(m.date);
  useEffect(() => { lastSent.current = m.date; }, [m.date]);
  const sendDate = (v: string) => {
    if (!plausibleDay(v) || v === lastSent.current) return;
    lastSent.current = v;
    save({ date: v }, () => { setDate(m.date); lastSent.current = m.date; });
  };
  return (
    <li className={cn("grid gap-1 py-2", pending && "opacity-70")} data-testid={`milestone-row-${i}`} data-done={m.done ? "true" : "false"}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Fait">
          <input type="checkbox" className={box} checked={done} onChange={(e) => { const v = e.target.checked; setDone(v); save({ done: v }, () => setDone(m.done)); }} data-testid={`milestone-done-${i}`} aria-label={`Fait, ${m.label}`} />
          <span className="sr-only sm:not-sr-only">Fait</span>
        </label>
        <input ref={dateInput} type="date" value={date} onChange={(e) => { setDate(e.target.value); sendDate(e.target.value); }}
          onBlur={() => { if (date === "") toast.error("Indiquez une date : le jalon est conservé. Pour l'enlever, supprimez-le."); if (date !== lastSent.current) setDate(lastSent.current); }}
          className={cn(field, "w-[9.5rem] tabular", m.late && "font-medium text-danger")} data-testid={`milestone-date-${i}`} aria-label={`Date, ${m.label}`} />
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => { if (label.trim() === "") setLabel(m.label); else if (label !== m.label) save({ label }, () => setLabel(m.label)); }}
          className={cn(field, "min-w-[10rem] flex-1 font-medium", m.done && "text-muted-foreground line-through")} data-testid={`milestone-label-${i}`} aria-label="Libellé du jalon" />
        <Button type="button" size="xs" variant="ghost" className="text-muted-foreground hover:text-danger" disabled={pending} aria-label={`Supprimer le jalon ${m.label}`} title="Supprimer le jalon" data-testid={`milestone-delete-${i}`}
          onClick={() => { if (!confirm(`Supprimer le jalon « ${m.label} » (${fmtDate(m.date)}) ?`)) return; run(() => deleteMilestone(m.id), () => toast.success("Jalon supprimé")); }}><Trash2 /></Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:pl-[3.25rem]">
        <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} onBlur={() => { if (venue !== (m.venue ?? "")) save({ venue }, () => setVenue(m.venue ?? "")); }} placeholder="Lieu"
          className={cn(field, "h-7 min-w-[10rem] flex-1 text-xs")} data-testid={`milestone-venue-${i}`} aria-label={`Lieu, ${m.label}`} />
        <input type="text" value={participants} onChange={(e) => setParticipants(e.target.value)} onBlur={() => { if (participants !== (m.participants ?? "")) save({ participants }, () => setParticipants(m.participants ?? "")); }} placeholder="Participants"
          className={cn(field, "h-7 min-w-[8rem] flex-1 text-xs")} data-testid={`milestone-participants-${i}`} aria-label={`Participants, ${m.label}`} />
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" className={box} checked={isPublic} onChange={(e) => { const v = e.target.checked; setIsPublic(v); save({ isPublic: v }, () => setIsPublic(m.isPublic)); }} data-testid={`milestone-public-${i}`} />Public (agenda du site)</label>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" className={box} checked={isCheckpoint} onChange={(e) => { const v = e.target.checked; setIsCheckpoint(v); save({ isCheckpoint: v }, () => setIsCheckpoint(m.isCheckpoint)); }} data-testid={`milestone-checkpoint-${i}`} />Point de contrôle</label>
      </div>
    </li>
  );
}

function AddMilestoneForm({ actionId }: { actionId: string }) {
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const { pending, run } = useRun();
  return (
    <Reveal label="Ajouter un jalon" testId="milestone-add" className="justify-self-start">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addMilestone(actionId, { date, label }), () => { toast.success("Jalon ajouté"); setDate(""); setLabel(""); }); }}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40" aria-label="Date du jalon" data-testid="milestone-add-date" required />
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé : rendu, atelier, comité…" className="h-8 w-64 max-w-full" aria-label="Libellé du jalon" data-testid="milestone-add-label" />
        <Button type="submit" size="sm" variant="outline" disabled={pending || !plausibleDay(date) || !label.trim()} data-testid="milestone-add-submit"><Plus />Ajouter</Button>
      </form>
    </Reveal>
  );
}
