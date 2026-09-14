"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { visibilityIcon } from "@/components/common/visibility-icon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addList, deleteList, updateList } from "@/app/actions/tasks";
import { VISIBILITIES } from "@/lib/modules";
import type { ListView } from "@/lib/tasks";
import type { EditionOpt } from "@/components/tasks/task-list";
import { cn } from "@/lib/utils";

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void;

function useRun(): [boolean, Run] {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run: Run = (fn, after) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  return [pending, run];
}


// En-tête d'une de mes listes : nom modifiable, visibilité au choix, édition rattachée, suppression (les tâches reviennent dans « Sans liste »).
export function ListHeader({ list, editions, count }: { list: ListView; editions: EditionOpt[]; count: number }) {
  const [pending, run] = useRun();
  const [name, setName] = useState(list.name);
  const Icon = visibilityIcon(list.visibility);
  const vis = VISIBILITIES.find((v) => v.value === list.visibility);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" data-testid={`list-header-${list.id}`}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== list.name) run(() => updateList(list.id, { name })); }} aria-label="Nom de la liste" className="h-7 max-w-[260px] border-0 bg-transparent px-1 text-[13px] font-bold shadow-none focus-visible:ring-1" disabled={pending} />
        <span className="text-[11px] text-muted-foreground">{count ? `${count} en cours` : "rien en cours"}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <select aria-label="Édition rattachée" value={list.edition?.id ?? ""} disabled={pending} onChange={(e) => run(() => updateList(list.id, { editionId: e.target.value || null }))} className="h-7 max-w-[200px] rounded-md border bg-card px-1.5 text-[11px]" data-testid={`list-edition-${list.id}`}>
          <option value="">Sans projet</option>
          {editions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.year}</option>)}
        </select>
        <span title={vis?.hint} className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 text-[11px] text-muted-foreground"><Icon className="size-3" aria-hidden />
          <select aria-label="Visibilité de la liste" value={list.visibility} disabled={pending} onChange={(e) => run(() => updateList(list.id, { visibility: e.target.value }), () => toast.success(e.target.value === "private" ? "Liste privée" : "Liste partagée"))} className="h-7 bg-transparent text-[11px]" data-testid={`list-visibility-${list.id}`}>
            {VISIBILITIES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </span>
        {list.edition && <Link href={`/edition/${list.edition.id}`} className="text-[11px] text-primary hover:underline">Ouvrir →</Link>}
        <button type="button" aria-label={`Supprimer la liste ${list.name}`} disabled={pending} onClick={() => { if (confirm(`Supprimer la liste « ${list.name} » ? Ses tâches reviennent dans « Sans liste ».`)) run(() => deleteList(list.id)); }} className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-danger"><Trash2 className="size-3.5" /></button>
      </div>
    </div>
  );
}

// Nouvelle liste : nom, visibilité, projet facultatif.
export function NewListDialog({ editions }: { editions: EditionOpt[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [editionId, setEditionId] = useState("");
  const [pending, run] = useRun();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="new-list"><Plus />Nouvelle liste</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouvelle liste</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(() => addList({ name, visibility, editionId: editionId || null }), () => { setOpen(false); setName(""); setVisibility("private"); setEditionId(""); }); }}>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Nom</span><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Vie statutaire, Forum, Demandes du jour…" required data-testid="new-list-name" /></label>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Projet (facultatif)</span>
            <select value={editionId} onChange={(e) => setEditionId(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm" data-testid="new-list-edition">
              <option value="">Sans projet — une catégorie à moi</option>
              {editions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.year}</option>)}
            </select>
          </label>
          <fieldset className="grid gap-1 text-xs">
            <legend className="mb-1 font-semibold">Qui peut la lire ?</legend>
            {VISIBILITIES.map((v) => (
              <label key={v.value} className={cn("flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5", visibility === v.value && "border-primary bg-info-soft")}>
                <input type="radio" name="visibility" value={v.value} checked={visibility === v.value} onChange={() => setVisibility(v.value)} className="mt-0.5 accent-primary" data-testid={`new-list-vis-${v.value}`} />
                <span><b>{v.label}</b> <span className="text-muted-foreground">· {v.hint}</span></span>
              </label>
            ))}
            <p className="text-[10px] text-muted-foreground">Quelle que soit la visibilité, vous seul·e écrivez dans vos listes.</p>
          </fieldset>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={pending || !name.trim()} data-testid="new-list-submit">Créer la liste</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
