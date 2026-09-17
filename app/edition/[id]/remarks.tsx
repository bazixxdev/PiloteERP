"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Check, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addRemark, deleteRemark, resolveRemark } from "@/app/actions/remarks";
import { Select } from "@/components/common/searchable-select";

export type RemarkView = { id: string; field: string; body: string; reason?: string; author: string; authorId: string; createdAt: string; resolvedAt: string | null; resolvedBy: string | null };

// Motif d'une remarque (retour du 14/09, Simon : « je ne sais pas d'où ça vient, pourquoi, est-ce financier »).
export const REMARK_REASONS = [
  { value: "funder", label: "Financeur", hint: "exigence ou cadre d'une convention" },
  { value: "strategy", label: "Stratégie", hint: "orientation de la direction ou du CA" },
  { value: "feasibility", label: "Faisabilité", hint: "temps, budget, charge" },
  { value: "form", label: "Forme", hint: "rédaction, précision, lisibilité" },
  { value: "other", label: "Autre", hint: "" },
];
export const reasonLabel = (v?: string) => REMARK_REASONS.find((r) => r.value === v)?.label ?? "Autre";

// Remarques accrochées à une rubrique, comme les commentaires Word de la directrice : lues en place, marquées traitées par le pilote.
export function FieldRemarks({ editionId, field, fieldLabel, remarks, canWrite, canResolve, meId, isDirector }: { editionId: string; field: string; fieldLabel: string; remarks: RemarkView[]; canWrite: boolean; canResolve: boolean; meId: string; isDirector: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  const open = remarks.filter((r) => !r.resolvedAt);
  const done = remarks.filter((r) => r.resolvedAt);
  if (remarks.length === 0 && !canWrite) return null;
  return (
    <div className="mt-1 grid gap-1" data-testid={`remarks-${field}`}>
      {open.map((r) => (
        <div key={r.id} className="flex items-start gap-2 rounded-md border-l-2 border-warning bg-warning-soft/60 px-2 py-1.5 text-xs" data-testid={`remark-${r.id}`}>
          <div className="min-w-0 flex-1">
            <span className="font-semibold">{r.author}</span> <span className="text-muted-foreground">· {r.createdAt}</span> <span className="rounded-sm bg-card px-1.5 py-px text-[10px] font-medium text-warning-foreground" data-testid={`remark-reason-${r.id}`}>{reasonLabel(r.reason)}</span>
            <p className="mt-0.5 whitespace-pre-line">{r.body}</p>
          </div>
          {(canResolve || r.authorId === meId) && <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => resolveRemark(r.id, true))} title="Marquer traitée" data-testid={`remark-resolve-${r.id}`}><Check />Traitée</Button>}
          {(r.authorId === meId || isDirector) && <button type="button" aria-label="Supprimer la remarque" disabled={pending} onClick={() => run(() => deleteRemark(r.id))} className="rounded p-1 text-muted-foreground/60 hover:text-danger"><Trash2 className="size-3.5" /></button>}
        </div>
      ))}
      {done.length > 0 && (
        <details className="group text-[11px] text-muted-foreground">
          <summary className="cursor-pointer list-none">✓ {done.length} remarque{done.length > 1 ? "s" : ""} traitée{done.length > 1 ? "s" : ""} <span className="text-primary group-open:hidden">afficher</span><span className="hidden text-primary group-open:inline">masquer</span></summary>
          {done.map((r) => (
            <div key={r.id} className="mt-1 flex items-start gap-2 rounded-md border-l-2 border-mint bg-muted/60 px-2 py-1.5">
              <div className="min-w-0 flex-1"><span className="font-semibold">{r.author}</span> · {r.createdAt} · traitée par {r.resolvedBy ?? "—"} le {r.resolvedAt}<p className="mt-0.5 whitespace-pre-line line-through decoration-muted-foreground/50">{r.body}</p></div>
              {(canResolve || r.authorId === meId) && <button type="button" aria-label="Rouvrir la remarque" disabled={pending} onClick={() => run(() => resolveRemark(r.id, false))} className="rounded p-1 hover:text-primary"><RotateCcw className="size-3.5" /></button>}
            </div>
          ))}
        </details>
      )}
      {canWrite && <AddRemark editionId={editionId} field={field} fieldLabel={fieldLabel} pending={pending} run={run} />}
    </div>
  );
}

function AddRemark({ editionId, field, fieldLabel, pending, run }: { editionId: string; field: string; fieldLabel: string; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("form");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex w-fit items-center gap-1 rounded-sm px-1 py-px text-[10px] text-muted-foreground hover:bg-muted hover:text-primary" data-testid={`remark-add-${field}`}><MessageSquarePlus className="size-3" aria-hidden />Remarque</button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addRemark(editionId, field, body, reason), () => { setBody(""); setOpen(false); }); }}>
          <div className="text-xs font-semibold">Remarque sur « {fieldLabel} »</div>
          <p className="text-[11px] text-muted-foreground">Le pilote la verra ici, en place, et la marquera traitée. Une notification lui est envoyée.</p>
          <textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="rounded-lg border bg-card p-2 text-sm" placeholder="À compléter : les dates jalons a minima…" aria-label="Remarque" data-testid={`remark-body-${field}`} />
          <label className="grid gap-1 text-[11px]"><span className="font-semibold">Pourquoi ? <span className="font-normal text-muted-foreground">le pilote saura d'où ça vient</span></span>
            <Select value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-xs" aria-label="Motif de la remarque" data-testid={`remark-reason-select-${field}`}>
              {REMARK_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}{r.hint ? ` — ${r.hint}` : ""}</option>)}
            </Select>
          </label>
          <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" size="sm" disabled={pending || !body.trim()} data-testid={`remark-submit-${field}`}>Poser la remarque</Button></div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
