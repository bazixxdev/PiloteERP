"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/common/searchable-select";
import { createContact, createContactList, type ContactInput } from "@/app/actions/contacts";
import { VISIBILITIES } from "@/lib/modules";
import { NOTE_COLORS } from "@/lib/notes";
import type { EditionOpt } from "@/components/tasks/task-list";
import { cn } from "@/lib/utils";

type Run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (r: { data?: unknown }) => void) => void;
function useRun(): [boolean, Run] {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run: Run = (fn, after) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(r); router.refresh(); });
  return [pending, run];
}

// Recherche et filtre par mot-clé de l'annuaire (dans l'adresse : ?q=&tag=).
export function ContactsToolbar({ q, tag, tags }: { q: string; tag: string; tags: string[] }) {
  const router = useRouter();
  const href = (query: string, t: string) => `/contacts${query || t ? `?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(t ? { tag: t } : {}) }).toString()}` : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-2 border-y px-4 py-2">
      <form className="relative" onSubmit={(e) => { e.preventDefault(); router.push(href(((new FormData(e.currentTarget).get("q") as string) ?? "").trim(), tag)); }}>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Nom, e-mail, structure, ville…" className="h-8 w-64 pl-8 text-xs" aria-label="Rechercher un contact" data-testid="contacts-search" />
      </form>
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {tags.slice(0, 12).map((t) => <button key={t} type="button" onClick={() => router.push(href(q, tag === t ? "" : t))} className={cn("rounded-full border px-2 py-0.5 text-[11px]", tag === t ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")} data-testid={`contacts-tag-${t}`}>{t}</button>)}
        </div>
      )}
    </div>
  );
}

// Formulaire de contact (création) : le nom suffit ; le reste se complète dans la fiche.
export function ContactForm({ organisations, onSubmit, pending, submitLabel = "Créer le contact", testPrefix = "new-contact" }: { organisations: { id: string; name: string }[]; onSubmit: (c: ContactInput) => void; pending: boolean; submitLabel?: string; testPrefix?: string }) {
  const [c, setC] = useState<ContactInput>({ lastName: "", firstName: "", email: "", phone: "", role: "", organisationId: "", organisationName: "", city: "", tags: "" });
  const F = (k: keyof ContactInput, label: string, placeholder?: string, type = "text") => (
    <label className="grid gap-1 text-xs"><span className="font-semibold">{label}</span><Input type={type} value={(c[k] as string) ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} placeholder={placeholder} className="h-8" data-testid={`${testPrefix}-${k}`} /></label>
  );
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); onSubmit(c); }}>
      <div className="grid grid-cols-2 gap-2">{F("firstName", "Prénom")}{F("lastName", "Nom *")}</div>
      <div className="grid grid-cols-2 gap-2">{F("email", "E-mail", "", "email")}{F("phone", "Téléphone")}</div>
      {F("role", "Fonction", "chargée de mission, élue, bénévole…")}
      <div className="grid gap-1 text-xs"><span className="font-semibold">Structure</span>
        <SearchableSelect options={organisations.map((o) => ({ value: o.id, label: o.name }))} value={c.organisationId ?? ""} onChange={(v) => setC({ ...c, organisationId: v })} emptyOption="— pas dans l'annuaire —" aria-label="Organisation" className="h-8 w-full text-xs" data-testid={`${testPrefix}-organisation`} />
        {!c.organisationId && <Input value={c.organisationName ?? ""} onChange={(e) => setC({ ...c, organisationName: e.target.value })} placeholder="ou le nom de la structure, en texte" className="h-8" data-testid={`${testPrefix}-organisationName`} />}
      </div>
      <div className="grid grid-cols-2 gap-2">{F("city", "Ville")}{F("tags", "Mots-clés", "réseau, élu, alimentation…")}</div>
      <div className="flex justify-end"><Button type="submit" size="sm" disabled={pending || !c.lastName.trim()} data-testid={`${testPrefix}-submit`}>{submitLabel}</Button></div>
    </form>
  );
}

export function NewContactDialog({ organisations }: { organisations: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, run] = useRun();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" data-testid="new-contact"><UserPlus />Nouveau contact</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouveau contact</DialogTitle></DialogHeader>
        <ContactForm organisations={organisations} pending={pending} onSubmit={(c) => run(() => createContact(c), (r) => { setOpen(false); toast.success("Contact créé"); router.push(`/contacts?contact=${(r.data as { id: string }).id}`); })} />
      </DialogContent>
    </Dialog>
  );
}

// Nouvelle liste : nom, couleur, édition facultative, visibilité — même patron que les listes de tâches.
export function NewContactListDialog({ editions, compact }: { editions: EditionOpt[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editionId, setEditionId] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [color, setColor] = useState<string | null>(null);
  const [pending, run] = useRun();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{compact ? <button type="button" className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-xs text-primary hover:bg-muted" data-testid="new-contact-list"><Plus className="size-3.5" />Nouvelle liste</button> : <Button size="sm" data-testid="new-contact-list"><Plus />Nouvelle liste</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouvelle liste de contacts</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(() => createContactList({ name, description, editionId: editionId || null, visibility, color }), (r) => { setOpen(false); setName(""); router.push(`/contacts?liste=${(r.data as { id: string }).id}`); }); }}>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Nom</span><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Invités du forum 2026, Réseau développeurs ESS…" required data-testid="new-contact-list-name" /></label>
          <label className="grid gap-1 text-xs"><span className="font-semibold">À quoi elle sert</span><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="facultatif" data-testid="new-contact-list-description" /></label>
          <div className="grid gap-1 text-xs"><span className="font-semibold">Couleur</span>
            <div className="flex items-center gap-1.5">{NOTE_COLORS.map((k) => <button key={k.value} type="button" title={k.label} aria-label={k.label} aria-pressed={color === k.value} onClick={() => setColor(color === k.value ? null : k.value)} className={cn("size-6 rounded-full border-2", color === k.value ? "border-foreground" : "border-transparent hover:border-border")} style={{ background: k.hex }} data-testid={`new-contact-list-color-${k.value}`} />)}</div>
          </div>
          <div className="grid gap-1 text-xs"><span className="font-semibold">Projet</span>
            <SearchableSelect options={editions.map((e) => ({ value: e.id, label: e.name, hint: String(e.year) }))} value={editionId} onChange={setEditionId} emptyOption="Sans projet — une liste à moi" aria-label="Projet" className="h-9 w-full" data-testid="new-contact-list-edition" />
          </div>
          <fieldset className="grid gap-1 text-xs"><legend className="mb-1 font-semibold">Qui la lit</legend>
            {VISIBILITIES.map((v) => (
              <label key={v.value} className="flex items-start gap-2"><input type="radio" name="cl-visibility" value={v.value} checked={visibility === v.value} onChange={() => setVisibility(v.value)} className="mt-0.5 accent-primary" data-testid={`new-contact-list-vis-${v.value}`} /><span><b className="font-medium">{v.label}</b> <span className="text-muted-foreground">· {v.hint}</span></span></label>
            ))}
          </fieldset>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={pending || !name.trim()} data-testid="new-contact-list-submit">Créer la liste</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
