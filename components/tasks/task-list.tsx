"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addSlot, addTask, deleteSlot, deleteTask, updateTask } from "@/app/actions/tasks";
import { dayjs, slotLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TaskView = {
  id: string; label: string; dueDate: string | null; done: boolean;
  edition: { id: string; name: string; year: number } | null; action: { id: string; name: string } | null;
  slots: { id: string; startAt: string; endAt: string; allDay: boolean }[];
};


// Liste des tâches personnelles : ajout en une ligne, échéance (pour quand) et créneaux (quand je m'y mets), lien vers l'édition.
export function TaskList({ tasks, editionId, actionId, compact }: { tasks: TaskView[]; editionId?: string; actionId?: string; compact?: boolean }) {
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const done = tasks.filter((t) => t.done);

  return (
    <div data-testid="task-list">
      <form className="flex items-center gap-2 border-b px-4 py-3" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; run(() => addTask({ label, editionId, actionId }), () => setLabel("")); }}>
        <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ajouter une tâche… puis Entrée" aria-label="Nouvelle tâche" className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" data-testid="task-input" disabled={pending} />
        {label.trim() && <Button type="submit" size="xs" disabled={pending} data-testid="task-submit">Ajouter</Button>}
      </form>
      {open.length === 0 && <p className="px-4 py-3 text-[11px] text-muted-foreground">Aucune tâche en cours. Une tâche, c'est pour vous seul : ce n'est ni une action du projet, ni un jalon.</p>}
      <ul className="divide-y">
        {open.map((t) => <TaskRow key={t.id} t={t} pending={pending} run={run} compact={compact} />)}
      </ul>
      {done.length > 0 && (
        <details className="group border-t px-4 py-2">
          <summary className="cursor-pointer list-none text-[11px] text-muted-foreground">Terminées · {done.length} <span className="text-primary group-open:hidden">afficher</span><span className="hidden text-primary group-open:inline">masquer</span></summary>
          <ul className="mt-1 divide-y">{done.map((t) => <TaskRow key={t.id} t={t} pending={pending} run={run} compact />)}</ul>
        </details>
      )}
    </div>
  );
}

function TaskRow({ t, pending, run, compact }: { t: TaskView; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(t.label);
  // Coche immédiate (optimiste), confirmée par le rafraîchissement.
  const [checked, setChecked] = useState(t.done);
  useEffect(() => setChecked(t.done), [t.done]);
  const due = t.dueDate ? dayjs(t.dueDate) : null;
  const n = due ? due.startOf("day").diff(dayjs().startOf("day"), "day") : null;
  const dueText = n === null ? null : n < 0 ? `${-n} j de retard` : n === 0 ? "aujourd'hui" : n === 1 ? "demain" : due!.format("ddd D MMM");
  return (
    <li className={cn("flex items-start gap-2.5 px-4 py-2.5", t.done && "opacity-60")} data-testid={`task-${t.id}`}>
      <input type="checkbox" checked={checked} disabled={pending} aria-label={`${t.done ? "Rouvrir" : "Terminer"} la tâche ${t.label}`} className="mt-1 size-4 rounded border-border accent-primary" onChange={(e) => { setChecked(e.target.checked); run(() => updateTask(t.id, { done: e.target.checked })); }} data-testid={`task-done-${t.id}`} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); run(() => updateTask(t.id, { label: text }), () => setEditing(false)); }}>
            <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { if (text.trim() && text !== t.label) run(() => updateTask(t.id, { label: text })); setEditing(false); }} className="h-7 text-xs" aria-label="Libellé de la tâche" />
          </form>
        ) : (
          <button type="button" onClick={() => { if (!t.done) setEditing(true); }} className={cn("text-left text-xs font-semibold hover:underline", t.done && "line-through")} title="Modifier le libellé">{t.label}</button>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
          {t.edition && <Link href={`/edition/${t.edition.id}${t.action ? "?onglet=actions" : ""}`} className="rounded-full bg-secondary px-1.5 py-px text-primary hover:underline">{t.edition.name} · {t.edition.year}{t.action ? ` · ${t.action.name}` : ""}</Link>}
          {!t.done && <DuePicker t={t} pending={pending} run={run} label={dueText} late={n !== null && n < 0} />}
          {t.slots.map((s) => (
            <span key={s.id} className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-px", dayjs(s.endAt).isBefore(dayjs()) ? "bg-muted" : "bg-info-soft text-primary")} title="Créneau posé dans votre agenda" data-testid={`slot-${s.id}`}>
              <CalendarClock className="size-3" aria-hidden />{slotLabel(s)}
              {!t.done && <button type="button" aria-label="Retirer ce créneau" disabled={pending} onClick={() => run(() => deleteSlot(s.id))} className="rounded hover:bg-black/10"><X className="size-3" /></button>}
            </span>
          ))}
          {!t.done && !compact && <SlotPicker t={t} pending={pending} run={run} />}
        </div>
      </div>
      <button type="button" aria-label={`Supprimer la tâche ${t.label}`} disabled={pending} onClick={() => run(() => deleteTask(t.id))} className="mt-0.5 rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-danger"><Trash2 className="size-3.5" /></button>
    </li>
  );
}

// Échéance : « pour quand ». Raccourcis aujourd'hui / demain / lundi, date libre, ou aucune.
function DuePicker({ t, pending, run, label, late }: { t: TaskView; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void; label: string | null; late: boolean }) {
  const [open, setOpen] = useState(false);
  const set = (d: string | null) => run(() => updateTask(t.id, { dueDate: d }), () => setOpen(false));
  const monday = dayjs().add(1, "week").startOf("isoWeek").format("YYYY-MM-DD");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-px hover:bg-muted", late ? "bg-danger-soft font-semibold text-danger" : label ? "bg-warning-soft text-warning-foreground" : "border border-dashed")} data-testid={`task-due-${t.id}`}>
          <CalendarDays className="size-3" aria-hidden />{label ? `Pour ${label}` : "Échéance"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="mb-2 text-xs font-semibold">Pour quand ?</div>
        <div className="mb-2 flex flex-wrap gap-1">
          <Button size="xs" variant="outline" disabled={pending} onClick={() => set(dayjs().format("YYYY-MM-DD"))}>Aujourd'hui</Button>
          <Button size="xs" variant="outline" disabled={pending} onClick={() => set(dayjs().add(1, "day").format("YYYY-MM-DD"))}>Demain</Button>
          <Button size="xs" variant="outline" disabled={pending} onClick={() => set(monday)}>Lundi prochain</Button>
          {t.dueDate && <Button size="xs" variant="ghost" disabled={pending} onClick={() => set(null)}>Aucune</Button>}
        </div>
        <Input type="date" defaultValue={t.dueDate ?? ""} aria-label="Date d'échéance" className="h-8" onChange={(e) => { if (e.target.value) set(e.target.value); }} />
      </PopoverContent>
    </Popover>
  );
}

// Créneau : « quand je m'y mets ». Une journée entière, ou une plage horaire, posée dans l'agenda (flux iCal).
function SlotPicker({ t, pending, run }: { t: TaskView; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(t.dueDate ?? dayjs().format("YYYY-MM-DD"));
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [added, setAdded] = useState(0);
  // Après un créneau, on en propose un autre à la suite : même jour, juste après (ou le lendemain pour une journée entière). Vide, il ne se pose pas.
  const proposeNext = () => {
    setAdded((n) => n + 1);
    if (allDay) { setDate(dayjs(date).add(1, "day").format("YYYY-MM-DD")); return; }
    const e = dayjs(`${date} ${end}`, "YYYY-MM-DD HH:mm");
    const dur = Math.max(1, e.diff(dayjs(`${date} ${start}`, "YYYY-MM-DD HH:mm"), "hour", true));
    const ns = e.hour() >= 17 ? dayjs(`${date} 09:00`, "YYYY-MM-DD HH:mm").add(1, "day") : e.hour() < 12 && e.add(dur, "hour").hour() > 12 ? dayjs(`${date} 14:00`, "YYYY-MM-DD HH:mm") : e;
    setDate(ns.format("YYYY-MM-DD")); setStart(ns.format("HH:mm")); setEnd(ns.add(dur, "hour").format("HH:mm"));
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setAdded(0); }}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 rounded-sm border border-dashed px-1.5 py-px hover:bg-muted" data-testid={`task-plan-${t.id}`}><CalendarClock className="size-3" aria-hidden />Planifier</button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addSlot(t.id, { date, start: allDay ? null : start, end: allDay ? null : end, allDay }), () => { toast.success("Créneau posé dans votre agenda"); proposeNext(); }); }}>
          <div className="text-xs font-semibold">{added ? `Un autre créneau ? (${added} posé${added > 1 ? "s" : ""})` : "Quand je m'y mets"}</div>
          <p className="text-[11px] text-muted-foreground">{added ? "Proposé à la suite ; laissez-le tel quel et fermez si ça suffit." : "Distinct de l'échéance : ce créneau va dans votre agenda, comme « occupé »."}</p>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Jour du créneau" className="h-8" required data-testid="slot-date" />
          <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 rounded border-border accent-primary" data-testid="slot-allday" />Journée entière</label>
          {!allDay && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Heure de début" className="h-8" step={900} data-testid="slot-start" />
              <span className="text-xs text-muted-foreground">à</span>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Heure de fin" className="h-8" step={900} data-testid="slot-end" />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setAdded(0); }} data-testid="slot-close">{added ? "Terminer" : "Annuler"}</Button>
            <Button type="submit" size="sm" disabled={pending} data-testid="slot-submit">{added ? "Poser aussi celui-ci" : "Poser le créneau"}</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
