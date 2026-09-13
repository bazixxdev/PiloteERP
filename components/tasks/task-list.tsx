"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, CalendarClock, CalendarDays, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addSlot, addTask, deleteSlot, deleteTask, updateTask } from "@/app/actions/tasks";
import { dayjs, slotLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

// Éditions proposables (« @ » dans la saisie, chip « Édition ») : les plus pertinentes pour la personne d'abord.
export type EditionOpt = { id: string; name: string; year: number; actions: { id: string; name: string }[] };

const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export type TaskView = {
  id: string; label: string; dueDate: string | null; done: boolean;
  edition: { id: string; name: string; year: number } | null; action: { id: string; name: string } | null;
  slots: { id: string; startAt: string; endAt: string; allDay: boolean }[];
};


// Liste des tâches personnelles : ajout en une ligne, échéance (pour quand) et créneaux (quand je m'y mets), lien vers l'édition.
export function TaskList({ tasks, editions = [], editionId, actionId, compact }: { tasks: TaskView[]; editions?: EditionOpt[]; editionId?: string; actionId?: string; compact?: boolean }) {
  const [label, setLabel] = useState("");
  const [linked, setLinked] = useState<string | null>(editionId ?? null);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const done = tasks.filter((t) => t.done);

  // « @ » dans la saisie : ce qui suit filtre les éditions ; Entrée ou clic rattache et retire le texte « @… » du libellé.
  const at = /@([^@]*)$/.exec(label);
  const suggestions = useMemo(() => { if (!at) return []; const q = norm(at[1].trim()); return editions.filter((e) => !q || norm(`${e.name} ${e.year}`).includes(q)).slice(0, 8); }, [at, editions]);
  const pick = (e: EditionOpt) => { setLinked(e.id); setLabel(label.replace(/@[^@]*$/, "").trimEnd()); setCursor(0); inputRef.current?.focus(); };
  const linkedEdition = editions.find((e) => e.id === linked);
  const submit = () => { if (!label.trim()) return; run(() => addTask({ label, editionId: linked, actionId: linked === editionId ? actionId : null }), () => { setLabel(""); setLinked(editionId ?? null); }); };

  return (
    <div data-testid="task-list">
      <form className="relative border-b px-4 py-3" onSubmit={(e) => { e.preventDefault(); if (at && suggestions[cursor]) { pick(suggestions[cursor]); return; } submit(); }}>
        <div className="flex items-center gap-2">
          <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef} value={label} onChange={(e) => { setLabel(e.target.value); setCursor(0); }}
            onKeyDown={(e) => { if (!at || suggestions.length === 0) return; if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % suggestions.length); } else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c - 1 + suggestions.length) % suggestions.length); } else if (e.key === "Escape") { setLabel(label.replace(/@[^@]*$/, "")); } }}
            placeholder={editions.length ? "Ajouter une tâche… @ pour rattacher une édition, puis Entrée" : "Ajouter une tâche… puis Entrée"} aria-label="Nouvelle tâche" aria-autocomplete="list" aria-expanded={Boolean(at && suggestions.length)}
            className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" data-testid="task-input" disabled={pending}
          />
          {linkedEdition && !editionId && (
            <span className="inline-flex max-w-[200px] items-center gap-1 rounded-full bg-secondary px-2 py-px text-[10px] text-primary" data-testid="task-linked">
              <AtSign className="size-3" aria-hidden /><span className="truncate">{linkedEdition.name} · {linkedEdition.year}</span>
              <button type="button" aria-label="Retirer l'édition" onClick={() => setLinked(null)} className="rounded hover:bg-black/10"><X className="size-3" /></button>
            </span>
          )}
          {label.trim() && !at && <Button type="submit" size="xs" disabled={pending} data-testid="task-submit">Ajouter</Button>}
        </div>
        {at && suggestions.length > 0 && (
          <ul className="absolute top-full left-8 z-20 mt-1 w-[min(420px,calc(100%-2rem))] overflow-hidden rounded-md border bg-card py-1 shadow-lg" role="listbox" aria-label="Éditions" data-testid="task-suggestions">
            {suggestions.map((e, i) => (
              <li key={e.id} role="option" aria-selected={i === cursor}>
                <button type="button" onMouseDown={(ev) => { ev.preventDefault(); pick(e); }} onMouseEnter={() => setCursor(i)} className={cn("flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs", i === cursor && "bg-info-soft")}>
                  <span className="truncate">{e.name}</span><span className="shrink-0 text-muted-foreground">{e.year}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {at && suggestions.length === 0 && editions.length > 0 && <p className="mt-1 pl-6 text-[10px] text-muted-foreground">Aucune édition ne correspond à « {at[1].trim()} ».</p>}
      </form>
      {open.length === 0 && <p className="px-4 py-3 text-[11px] text-muted-foreground">Aucune tâche en cours. Une tâche, c'est pour vous seul : ce n'est ni une action du projet, ni un jalon.</p>}
      <ul className="divide-y">
        {open.map((t) => <TaskRow key={t.id} t={t} pending={pending} run={run} compact={compact} editions={editions} />)}
      </ul>
      {done.length > 0 && (
        <details className="group border-t px-4 py-2">
          <summary className="cursor-pointer list-none text-[11px] text-muted-foreground">Terminées · {done.length} <span className="text-primary group-open:hidden">afficher</span><span className="hidden text-primary group-open:inline">masquer</span></summary>
          <ul className="mt-1 divide-y">{done.map((t) => <TaskRow key={t.id} t={t} pending={pending} run={run} compact editions={editions} />)}</ul>
        </details>
      )}
    </div>
  );
}

function TaskRow({ t, pending, run, compact, editions }: { t: TaskView; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void; compact?: boolean; editions: EditionOpt[] }) {
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
          {t.done || editions.length === 0 ? (
            t.edition && <Link href={`/edition/${t.edition.id}${t.action ? "?onglet=actions" : ""}`} className="rounded-full bg-secondary px-1.5 py-px text-primary hover:underline">{t.edition.name} · {t.edition.year}{t.action ? ` · ${t.action.name}` : ""}</Link>
          ) : (
            <TaskEditionPicker t={t} pending={pending} run={run} editions={editions} />
          )}
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

// Édition rattachée, modifiable après coup : le chip s'ouvre (changer, action de l'édition, ouvrir, détacher) ; la croix détache d'un clic.
function TaskEditionPicker({ t, pending, run, editions }: { t: TaskView; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void; editions: EditionOpt[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = useMemo(() => { const n = norm(q.trim()); return editions.filter((e) => !n || norm(`${e.name} ${e.year}`).includes(n)).slice(0, 12); }, [q, editions]);
  const current = editions.find((e) => e.id === t.edition?.id);
  const set = (editionId: string | null, actionId: string | null = null) => run(() => updateTask(t.id, { editionId, actionId }), () => { setOpen(false); setQ(""); });
  return (
    <span className="inline-flex items-center">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button" data-testid={`task-edition-${t.id}`}
            title={t.edition ? "Changer l'édition rattachée, choisir une action, ou détacher" : "Rattacher une édition"}
            className={cn("inline-flex max-w-[260px] items-center gap-1 px-1.5 py-px hover:bg-muted", t.edition ? "rounded-l-full bg-secondary text-primary" : "rounded-sm border border-dashed")}
          >
            <AtSign className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{t.edition ? `${t.edition.name} · ${t.edition.year}${t.action ? ` · ${t.action.name}` : ""}` : "Édition"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{t.edition ? "Édition rattachée" : "Rattacher à une édition"}</span>
            {t.edition && <Link href={`/edition/${t.edition.id}${t.action ? "?onglet=actions" : ""}`} className="text-[11px] text-primary hover:underline">Ouvrir l'édition →</Link>}
          </div>
          {current && current.actions.length > 0 && (
            <div className="mb-2 border-b pb-2">
              <label className="text-[10px] text-muted-foreground" htmlFor={`task-action-${t.id}`}>Action de cette édition (facultatif)</label>
              <select id={`task-action-${t.id}`} className="mt-1 h-8 w-full rounded-lg border bg-card px-2 text-xs" value={t.action?.id ?? ""} disabled={pending} onChange={(e) => set(current.id, e.target.value || null)}>
                <option value="">— l'édition entière —</option>
                {current.actions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">{t.edition ? "Changer pour une autre édition" : "Choisir l'édition"}</div>
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Projet, année…" aria-label="Rechercher une édition" className="my-1.5 h-8" data-testid="task-edition-search" />
          <ul className="max-h-48 overflow-y-auto" role="listbox" aria-label="Éditions">
            {list.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">Aucune édition ne correspond.</li>}
            {list.map((e) => (
              <li key={e.id} role="option" aria-selected={e.id === t.edition?.id}>
                <button type="button" disabled={pending} onClick={() => set(e.id)} className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted", e.id === t.edition?.id && "bg-info-soft font-semibold")}>
                  <span className="truncate">{e.name}</span><span className="shrink-0 text-muted-foreground">{e.year}</span>
                </button>
              </li>
            ))}
          </ul>
          {t.edition && <div className="mt-2 flex justify-end border-t pt-2"><Button size="xs" variant="ghost" disabled={pending} onClick={() => set(null)} className="text-danger hover:text-danger">Détacher de l'édition</Button></div>}
        </PopoverContent>
      </Popover>
      {t.edition && (
        <button type="button" aria-label="Détacher de l'édition" title="Détacher de l'édition" disabled={pending} onClick={() => set(null)} className="rounded-r-full bg-secondary py-px pr-1.5 pl-0.5 text-primary hover:bg-danger-soft hover:text-danger" data-testid={`task-detach-${t.id}`}><X className="size-3" /></button>
      )}
    </span>
  );
}
