"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { visibilityIcon } from "@/components/common/visibility-icon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addList, deleteList, updateList } from "@/app/actions/tasks";
import { VISIBILITIES } from "@/lib/modules";
import { NOTE_COLORS, noteColor } from "@/lib/notes";
import type { ListView } from "@/lib/tasks";
import type { EditionOpt } from "@/components/tasks/task-list";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/common/searchable-select";
import { V, cap } from "@/lib/vocab";

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void;

function useRun(): [boolean, Run] {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run: Run = (fn, after) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  return [pending, run];
}

// Rangée de pastilles de couleur, même palette que les notes.
function ColorDots({ value, onChange, disabled, testPrefix }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean; testPrefix: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" title="Aucune" aria-label="Aucune couleur" disabled={disabled} onClick={() => onChange(null)} className={cn("size-6 rounded-full border-2", !value ? "border-foreground" : "border-transparent")} style={{ background: "repeating-linear-gradient(45deg, transparent 0 3px, var(--border) 3px 4px)" }} data-testid={`${testPrefix}-none`} />
      {NOTE_COLORS.map((k) => (
        <button key={k.value} type="button" title={k.label} aria-label={k.label} aria-pressed={value === k.value} disabled={disabled} onClick={() => onChange(k.value)} className={cn("size-6 rounded-full border-2", value === k.value ? "border-foreground" : "border-transparent hover:border-border")} style={{ background: k.hex }} data-testid={`${testPrefix}-${k.value}`} />
      ))}
    </div>
  );
}

// En-tête d'une de mes listes (revue UX du 15/09) : le titre est du texte ; nom, couleur, projet, visibilité et suppression
// sont dans un panneau « Réglages ». Plus de sélecteurs dans le titre.
export function ListHeader({ list, editions, count }: { list: ListView; editions: EditionOpt[]; count: number }) {
  const [pending, run] = useRun();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(list.name);
  const Icon = visibilityIcon(list.visibility);
  const vis = VISIBILITIES.find((v) => v.value === list.visibility);
  const color = noteColor(list.color);
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3" data-testid={`list-header-${list.id}`} data-name={list.name}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">{color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: color.hex }} aria-hidden />}<span className="truncate">{list.name}</span><span className="text-[11px] font-normal text-muted-foreground">{count ? `${count} en cours` : "rien en cours"}</span></h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1" title={vis?.hint} data-testid={`list-visibility-${list.id}`} data-value={list.visibility}><Icon className="size-3" aria-hidden />{vis?.label}</span>
          {list.edition ? <span>· <Link href={`/edition/${list.edition.id}`} className="text-primary hover:underline">{list.edition.name} · {list.edition.year}</Link></span> : <span>· sans projet</span>}
        </p>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs" data-testid={`list-settings-${list.id}`}><Settings2 className="size-3.5" />Réglages</Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3">
          <div className="grid gap-3 text-xs">
            <label className="grid gap-1"><span className="font-semibold">Nom</span><Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== list.name) run(() => updateList(list.id, { name })); }} aria-label="Nom de la liste" className="h-8" disabled={pending} data-testid={`list-name-${list.id}`} /></label>
            <div className="grid gap-1"><span className="font-semibold">Couleur</span><ColorDots value={list.color} disabled={pending} onChange={(v) => run(() => updateList(list.id, { color: v }))} testPrefix={`list-color-${list.id}`} /></div>
            <label className="grid gap-1"><span className="font-semibold">Projet suivi</span>
              <SearchableSelect aria-label={`${cap(V.edition)} rattachée`} options={editions.map((e) => ({ value: e.id, label: e.name, hint: String(e.year) }))} value={list.edition?.id ?? ""} disabled={pending} onChange={(v) => run(() => updateList(list.id, { editionId: v || null }))} emptyOption="Sans projet — une catégorie à moi" className="w-full text-xs" data-testid={`list-edition-${list.id}`} />
            </label>
            <fieldset className="grid gap-1">
              <legend className="mb-1 font-semibold">Qui peut la lire ?</legend>
              {VISIBILITIES.map((v) => (
                <label key={v.value} className={cn("flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1", list.visibility === v.value && "border-primary bg-info-soft")}>
                  <input type="radio" name={`vis-${list.id}`} value={v.value} checked={list.visibility === v.value} disabled={pending} onChange={() => run(() => updateList(list.id, { visibility: v.value }), () => toast.success(v.value === "private" ? "Liste privée" : "Liste partagée"))} className="mt-0.5 accent-primary" data-testid={`list-vis-${list.id}-${v.value}`} />
                  <span><b>{v.label}</b> <span className="text-muted-foreground">· {v.hint}</span></span>
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end border-t pt-2">
              <Button variant="ghost" size="sm" disabled={pending} className="text-danger hover:text-danger" onClick={() => { if (confirm(`Supprimer la liste « ${list.name} » ? Ses tâches reviennent dans « À trier ».`)) run(() => deleteList(list.id), () => router.push("/taches")); }} data-testid={`list-delete-${list.id}`}><Trash2 className="size-3.5" />Supprimer la liste</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Nouvelle liste : nom, couleur, projet facultatif, visibilité. Une fois créée, on l'ouvre.
export function NewListDialog({ editions, compact }: { editions: EditionOpt[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [visibility, setVisibility] = useState("private");
  const [editionId, setEditionId] = useState("");
  const [pending, run] = useRun();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{compact ? <button type="button" className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-xs text-primary hover:bg-muted" data-testid="new-list"><Plus className="size-3.5" />Nouvelle liste</button> : <Button data-testid="new-list"><Plus />Nouvelle liste</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouvelle liste</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await addList({ name, visibility, editionId: editionId || null, color }); if (r.ok) router.push(`/taches?liste=${r.data!.id}`); return r; }, () => { setOpen(false); setName(""); setColor(null); setVisibility("private"); setEditionId(""); }); }}>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Nom</span><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Vie statutaire, Forum, Demandes du jour…" required data-testid="new-list-name" /></label>
          <div className="grid gap-1 text-xs"><span className="font-semibold">Couleur</span><ColorDots value={color} onChange={setColor} testPrefix="new-list-color" /></div>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Projet (facultatif)</span>
            <SearchableSelect options={editions.map((e) => ({ value: e.id, label: e.name, hint: String(e.year) }))} value={editionId} onChange={setEditionId} emptyOption="Sans projet — une catégorie à moi" aria-label="Projet" className="h-9 w-full" data-testid="new-list-edition" />
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
