"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Plus, MoreHorizontal, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { addTask, updateTask } from "@/app/actions/tasks";
import { dayjs, slotLabel } from "@/lib/format";
import { noteColor } from "@/lib/notes";
import { cn } from "@/lib/utils";
import { CheckCircle, dueMeta, parseBang, TaskDetail, type EditionOpt, type ListOpt, type TaskView } from "./task-list";
import { groupByDue, type DueGroup } from "@/lib/tasks-group";

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void;

// Vue kanban (redesign du 18/09, inspiration Todoist) : une colonne par liste, « À trier » en tête ; une carte par tâche en
// cours ; glisser une carte dans une autre colonne la range ; un ajout au pied de chaque colonne. Même données, même actions
// que la vue liste — seule la disposition change.
// Deux façons de découper : par liste (vue « À faire » : glisser range la tâche) ou par échéance (dans une liste, « À trier » :
// glisser change la date — Aujourd'hui, Cette semaine, Plus tard, Sans date ; « En retard » ne reçoit rien).
type Column = { key: string; name: string; color: string | null; editionName?: string | null; listId?: string | null; due?: DueGroup["key"] };

const dueTarget = (key: DueGroup["key"]): string | null | undefined => {
  const today = dayjs().startOf("day");
  if (key === "today") return today.format("YYYY-MM-DD");
  if (key === "week") { const tomorrow = today.add(1, "day"); const end = today.endOf("isoWeek"); return (tomorrow.isAfter(end, "day") ? end : tomorrow).format("YYYY-MM-DD"); }
  if (key === "later") return today.add(1, "week").startOf("isoWeek").format("YYYY-MM-DD");
  if (key === "none") return null;
  return undefined; // en retard : pas une cible
};

export function TaskKanban({ tasks, lists, editions, mode = "lists", listId: fixedListId }: { tasks: TaskView[]; lists: (ListOpt & { editionName?: string | null })[]; editions: EditionOpt[]; mode?: "lists" | "due"; listId?: string | null }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run: Run = (fn, after) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  const [over, setOver] = useState<string | null>(null);
  const open = tasks.filter((t) => !t.done);
  const columns: Column[] = mode === "lists"
    ? [{ key: "none", name: "À trier", color: null, listId: null }, ...lists.map((l) => ({ key: l.id, name: l.name, color: l.color ?? null, editionName: l.editionName, listId: l.id }))]
    : (["late", "today", "week", "later", "none"] as DueGroup["key"][]).map((k) => ({ key: k, name: { late: "En retard", today: "Aujourd'hui", week: "Cette semaine", later: "Plus tard", none: "Sans date" }[k], color: null, due: k })).filter((c) => c.due !== "late" || open.some((t) => dueMeta(t).late));
  const itemsOf = (c: Column) => (mode === "lists" ? open.filter((t) => (t.listId ?? null) === c.listId) : (groupByDue(open).find((g) => g.key === c.due)?.tasks ?? [])).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const drop = (c: Column, e: React.DragEvent) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData("text/task");
    if (!id) return;
    const t = open.find((x) => x.id === id);
    if (!t) return;
    if (mode === "lists") {
      if ((t.listId ?? null) === (c.listId ?? null)) return;
      run(() => updateTask(id, { listId: c.listId ?? null }), () => toast.success(c.listId ? `Rangée dans « ${c.name} »` : "Remise à trier"));
    } else {
      const target = dueTarget(c.due!);
      if (target === undefined || target === t.dueDate) return;
      run(() => updateTask(id, { dueDate: target }), () => toast.success(target ? `Pour ${dayjs(target).format("ddd D MMM")}` : "Sans date"));
    }
  };
  return (
    <div className="flex gap-3 overflow-x-auto pb-3" data-testid="tasks-kanban" data-mode={mode}>
      {columns.map((c) => {
        const items = itemsOf(c);
        const key = c.key;
        const droppable = mode === "lists" || c.due !== "late";
        return (
          <section
            key={key} data-testid={`kanban-col-${key}`} data-name={c.name}
            className={cn("flex w-[272px] shrink-0 flex-col rounded-lg border bg-[#f6f8f9] transition-colors", over === key && droppable && "border-primary bg-info-soft/60")}
            onDragOver={(e) => { if (!droppable) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== key) setOver(key); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
            onDrop={(e) => droppable && drop(c, e)}
          >
            <header className="flex items-center gap-2 px-3 pb-1 pt-2.5">
              {mode === "lists" ? (c.listId ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: noteColor(c.color)?.hex ?? "var(--border)" }} aria-hidden /> : <Inbox className="size-3.5 text-muted-foreground" aria-hidden />) : <CalendarClock className={cn("size-3.5", c.due === "late" ? "text-danger" : c.due === "today" ? "text-primary" : "text-muted-foreground")} aria-hidden />}
              <span className={cn("min-w-0 flex-1 truncate text-[13px] font-bold", c.due === "late" && "text-danger")}>{c.name}</span>
              <span className="text-[11px] text-muted-foreground">{items.length}</span>
              {mode === "lists" && c.listId && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label={`Menu de la liste ${c.name}`}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild><Link href={`/taches?liste=${c.listId}`}>Ouvrir la liste (réglages, partage)</Link></DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </header>
            {c.editionName && <div className="px-3 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{c.editionName}</div>}
            <ul className="grid gap-2 px-2 pb-2">
              {items.map((t) => <KanbanCard key={t.id} t={t} pending={pending} run={run} editions={editions} lists={lists} />)}
            </ul>
            <AddInColumn listId={mode === "lists" ? c.listId ?? null : fixedListId ?? null} dueDate={mode === "due" ? dueTarget(c.due!) ?? null : undefined} pending={pending} run={run} />
          </section>
        );
      })}
    </div>
  );
}

function KanbanCard({ t, pending, run, editions, lists }: { t: TaskView; pending: boolean; run: Run; editions: EditionOpt[]; lists: ListOpt[] }) {
  const [checked, setChecked] = useState(t.done);
  const [detail, setDetail] = useState(false);
  const { text, late, today } = dueMeta(t);
  return (
    <li
      className="group cursor-grab rounded-md border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,.04)] hover:border-primary/40 active:cursor-grabbing" data-testid={`kanban-task-${t.id}`}
      draggable onDragStart={(e) => { e.dataTransfer.setData("text/task", t.id); e.dataTransfer.effectAllowed = "move"; }}
    >
      <div className="flex items-start gap-2.5">
        <CheckCircle t={t} checked={checked} pending={pending} onChange={(v) => { setChecked(v); run(() => updateTask(t.id, { done: v })); }} />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => setDetail(true)} className="block max-w-full text-left text-[13px] font-medium leading-snug hover:text-primary" data-testid={`kanban-open-${t.id}`}>{t.label}</button>
          {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            {text && <span className={cn("inline-flex items-center gap-1", late ? "font-semibold text-danger" : today ? "font-medium text-primary" : "text-mint")}><CalendarClock className="size-3" aria-hidden />{late || today ? text : dayjs(t.dueDate!).format("D MMM")}</span>}
            {t.slots.length > 0 && <span className="text-muted-foreground" title={t.slots.map(slotLabel).join(", ")}>{t.slots.length} créneau{t.slots.length > 1 ? "x" : ""}</span>}
            {t.requestId && <span className="inline-flex items-center gap-1 text-primary"><Inbox className="size-3" aria-hidden />Demande</span>}
          </div>
          {t.edition && <div className="mt-1 truncate text-[11px] text-muted-foreground">{t.edition.name} · {t.edition.year}{t.action ? ` · ${t.action.name}` : ""}</div>}
        </div>
      </div>
      {detail && <TaskDetail t={t} open={detail} onOpenChange={setDetail} pending={pending} run={run} editions={editions} lists={lists} />}
    </li>
  );
}

// « + Ajouter une tâche » au pied de la colonne : la tâche naît directement dans cette liste ; « !demain » pose l'échéance.
function AddInColumn({ listId, dueDate, pending, run }: { listId: string | null; dueDate?: string | null; pending: boolean; run: Run }) {
  const [openForm, setOpenForm] = useState(false);
  const [label, setLabel] = useState("");
  if (!openForm) return <button type="button" onClick={() => setOpenForm(true)} className="mx-2 mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground" data-testid={`kanban-add-${listId ?? "none"}`}><Plus className="size-3.5 text-coral" aria-hidden />Ajouter une tâche</button>;
  const bang = /(?:^|\s)!(\S+)\s*$/.exec(label);
  const bangDue = bang ? parseBang(bang[1]) : null;
  const submit = () => {
    const clean = (bangDue ? label.replace(/(?:^|\s)!\S+\s*$/, "") : label).trim();
    if (!clean) { setOpenForm(false); return; }
    run(() => addTask({ label: clean, dueDate: bangDue ?? dueDate ?? null, listId }), () => setLabel(""));
  };
  return (
    <form className="mx-2 mb-2 rounded-md border bg-card p-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setLabel(""); setOpenForm(false); } }} onBlur={() => { if (!label.trim()) setOpenForm(false); }} placeholder="Nom de la tâche… !demain pour l'échéance" className="h-8 border-0 px-1 text-xs shadow-none focus-visible:ring-0" aria-label="Nouvelle tâche" disabled={pending} data-testid={`kanban-input-${listId ?? "none"}`} />
      {bangDue && <div className="mt-1 text-[10px] text-warning-foreground">Pour {dayjs(bangDue).format("ddd D MMM")}</div>}
    </form>
  );
}
