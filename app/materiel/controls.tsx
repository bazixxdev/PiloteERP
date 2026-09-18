"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, HandHelping, Plus, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect, Select } from "@/components/common/searchable-select";
import { createEquipment, createLoan, deleteLoan, retireEquipment, returnLoan, type EquipmentInput } from "@/app/actions/equipment";
import { EQUIPMENT_STATES } from "@/lib/equipment";
import { withBase } from "@/lib/base-path";
import type { EditionOpt } from "@/components/tasks/task-list";
import { cn } from "@/lib/utils";

type Run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (r: { data?: unknown }) => void) => void;
function useRun(): [boolean, Run] {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run: Run = (fn, after) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(r); router.refresh(); });
  return [pending, run];
}
const today = () => new Date().toLocaleDateString("sv");

export function EquipmentToolbar({ q, category, categories, available }: { q: string; category: string; categories: string[]; available: boolean }) {
  const router = useRouter();
  const go = (patch: Record<string, string>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ q, categorie: category, dispo: available ? "1" : "", ...patch })) if (v) p.set(k, v); router.push(`/materiel${p.toString() ? `?${p.toString()}` : ""}`); };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <form className="relative" onSubmit={(e) => { e.preventDefault(); go({ q: ((new FormData(e.currentTarget).get("q") as string) ?? "").trim() }); }}>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Nom, référence, rangement…" className="h-8 w-56 pl-8 text-xs" aria-label="Rechercher du matériel" data-testid="equipment-search" />
      </form>
      <Select value={category} onChange={(e) => go({ categorie: e.target.value })} className="h-8 text-xs" aria-label="Catégorie" data-testid="equipment-category-filter"><option value="">Toutes les catégories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={available} onChange={(e) => go({ dispo: e.target.checked ? "1" : "" })} className="size-3.5 accent-primary" data-testid="equipment-available-only" />Disponible seulement</label>
    </div>
  );
}

export function NewEquipmentDialog({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<EquipmentInput>({ name: "", category: "", reference: "", location: "", quantity: 1, state: "ok", value: "", notes: "" });
  const [pending, run] = useRun();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" data-testid="new-equipment"><Plus />Nouveau matériel</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouveau matériel</DialogTitle></DialogHeader>
        <form className="grid gap-3 text-xs" onSubmit={(e) => { e.preventDefault(); run(() => createEquipment(f), (r) => { setOpen(false); toast.success("Matériel ajouté"); router.push(`/materiel?materiel=${(r.data as { id: string }).id}`); }); }}>
          <label className="grid gap-1"><span className="font-semibold">Nom</span><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Vidéoprojecteur Epson, Kakemono CRESS…" className="h-8" data-testid="equipment-name" /></label>
          <div className="grid grid-cols-[1fr_5rem] gap-1.5">
            <label className="grid gap-1"><span className="font-semibold">Catégorie</span><Input list="eq-cats" value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Audiovisuel, Signalétique…" className="h-8" data-testid="equipment-category" /><datalist id="eq-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="grid gap-1"><span className="font-semibold">Quantité</span><Input type="number" min={1} value={String(f.quantity ?? 1)} onChange={(e) => setF({ ...f, quantity: e.target.value })} className="h-8" data-testid="equipment-quantity" /></label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="grid gap-1"><span className="font-semibold">Référence</span><Input value={f.reference ?? ""} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="n° d'inventaire" className="h-8" /></label>
            <label className="grid gap-1"><span className="font-semibold">Rangement</span><Input value={f.location ?? ""} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Réserve, armoire A…" className="h-8" data-testid="equipment-location" /></label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="grid gap-1"><span className="font-semibold">État</span><Select value={f.state ?? "ok"} onChange={(e) => setF({ ...f, state: e.target.value })} className="h-8 text-xs" aria-label="État">{EQUIPMENT_STATES.filter((s) => s.value !== "retired").map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></label>
            <label className="grid gap-1"><span className="font-semibold">Valeur d&apos;achat (€)</span><Input inputMode="decimal" value={String(f.value ?? "")} onChange={(e) => setF({ ...f, value: e.target.value })} className="h-8 text-right" /></label>
          </div>
          <div className="flex justify-end"><Button type="submit" size="sm" disabled={pending || !f.name.trim()} data-testid="equipment-submit">Ajouter</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Prêter : à quelqu'un de l'équipe, à un contact de l'annuaire, ou à une organisation ; pour une édition (facultatif) ; retour attendu.
export function LoanDialog({ equipment, people, organisations, editions, compact }: { equipment: { id: string; name: string; available: number }; people: { id: string; name: string }[]; organisations: { id: string; name: string }[]; editions: EditionOpt[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<"person" | "contact" | "organisation">("person");
  const [personId, setPersonId] = useState("");
  const [contactId, setContactId] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [contacts, setContacts] = useState<{ id: string; label: string }[] | null>(null);
  const [f, setF] = useState({ quantity: "1", editionId: "", outAt: today(), dueAt: "", notes: "" });
  const [pending, run] = useRun();
  const loadContacts = async () => { if (contacts) return; const r = await fetch(withBase("/contacts/export?annuaire=1")); setContacts(await r.json()); };
  const ok = to === "person" ? Boolean(personId) : to === "contact" ? Boolean(contactId) : Boolean(organisationId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{compact ? <Button size="xs" variant="outline" disabled={equipment.available <= 0} title={equipment.available <= 0 ? "Tout est sorti" : "Prêter"} data-testid={`loan-open-${equipment.id}`}><HandHelping />Prêter</Button> : <Button size="sm" disabled={equipment.available <= 0} data-testid={`loan-open-${equipment.id}`}><HandHelping />Prêter</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Prêter « {equipment.name} »</DialogTitle></DialogHeader>
        <div className="flex gap-1 rounded-md bg-muted p-0.5 text-xs">
          {([["person", "À l'équipe"], ["contact", "À un contact"], ["organisation", "À une organisation"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => { setTo(k); if (k === "contact") void loadContacts(); }} className={cn("flex-1 rounded px-2 py-1", to === k && "bg-card font-semibold shadow-sm")} data-testid={`loan-to-${k}`}>{l}</button>)}
        </div>
        <form className="grid gap-3 text-xs" onSubmit={(e) => { e.preventDefault(); run(() => createLoan({ equipmentId: equipment.id, quantity: f.quantity, personId: to === "person" ? personId : null, contactId: to === "contact" ? contactId : null, organisationId: to === "organisation" ? organisationId : null, editionId: f.editionId || null, outAt: f.outAt, dueAt: f.dueAt || null, notes: f.notes }), () => { setOpen(false); toast.success("Prêt enregistré"); }); }}>
          {to === "person" && <SearchableSelect options={people.map((p) => ({ value: p.id, label: p.name }))} value={personId} onChange={setPersonId} emptyOption="— qui, dans l'équipe —" aria-label="Personne" className="h-9 w-full" data-testid="loan-person" />}
          {to === "contact" && <SearchableSelect options={(contacts ?? []).map((c) => ({ value: c.id, label: c.label }))} value={contactId} onChange={setContactId} emptyOption={contacts ? "— quel contact —" : "Lecture de l'annuaire…"} searchFrom={1} aria-label="Contact" className="h-9 w-full" data-testid="loan-contact" />}
          {to === "organisation" && <SearchableSelect options={organisations.map((o) => ({ value: o.id, label: o.name }))} value={organisationId} onChange={setOrganisationId} emptyOption="— quelle organisation —" searchFrom={1} aria-label="Organisation" className="h-9 w-full" data-testid="loan-organisation" />}
          <div className="grid grid-cols-[5rem_1fr] gap-1.5">
            <label className="grid gap-1"><span className="font-semibold">Quantité</span><Input type="number" min={1} max={equipment.available} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} className="h-8" data-testid="loan-quantity" /></label>
            <div className="grid gap-1"><span className="font-semibold">Pour quel projet <span className="font-normal text-muted-foreground">(facultatif)</span></span><SearchableSelect options={editions.map((e) => ({ value: e.id, label: e.name, hint: String(e.year) }))} value={f.editionId} onChange={(v) => setF({ ...f, editionId: v })} emptyOption="—" aria-label="Édition" className="h-8 w-full text-xs" data-testid="loan-edition" /></div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="grid gap-1"><span className="font-semibold">Sorti le</span><Input type="date" value={f.outAt} onChange={(e) => setF({ ...f, outAt: e.target.value })} className="h-8" data-testid="loan-out" /></label>
            <label className="grid gap-1"><span className="font-semibold">Retour attendu</span><Input type="date" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} className="h-8" data-testid="loan-due" /></label>
          </div>
          <label className="grid gap-1"><span className="font-semibold">Note</span><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="accessoires, lieu de remise…" className="h-8" /></label>
          <div className="flex justify-end"><Button type="submit" size="sm" disabled={pending || !ok} data-testid="loan-submit">Enregistrer le prêt</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReturnButton({ loanId, label }: { loanId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, run] = useRun();
  if (!open) return <Button size="xs" variant="outline" onClick={() => setOpen(true)} data-testid={`loan-return-${loanId}`}><Undo2 />Rendu</Button>;
  return (
    <form className="inline-flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); run(() => returnLoan(loanId, { returnNote: note }), () => { setOpen(false); toast.success(`${label} : retour enregistré`); }); }}>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="état au retour (facultatif)" className="h-7 w-44 text-[11px]" aria-label="État au retour" data-testid={`loan-return-note-${loanId}`} />
      <Button type="submit" size="xs" disabled={pending} data-testid={`loan-return-confirm-${loanId}`}>OK</Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
    </form>
  );
}

export function DeleteLoanButton({ loanId }: { loanId: string }) {
  const [pending, run] = useRun();
  return <button type="button" disabled={pending} title="Effacer ce prêt (erreur de saisie)" aria-label="Effacer ce prêt" onClick={() => { if (confirm("Effacer ce prêt ? (erreur de saisie — pour un retour, utilisez « Rendu »)")) run(() => deleteLoan(loanId)); }} className="text-[10px] text-muted-foreground hover:text-danger" data-testid={`loan-delete-${loanId}`}>effacer</button>;
}

export function RetireButton({ id, retired }: { id: string; retired: boolean }) {
  const [pending, run] = useRun();
  return <Button size="sm" variant="ghost" disabled={pending} className="text-muted-foreground" onClick={() => { if (retired || confirm("Sortir ce matériel de l'inventaire ? Il reste lisible avec son historique de prêts.")) run(() => retireEquipment(id, !retired), () => toast.success(retired ? "Remis dans l'inventaire" : "Sorti de l'inventaire")); }} data-testid={`equipment-retire-${id}`}>{retired ? <><ArchiveRestore />Remettre dans l&apos;inventaire</> : <><Archive />Sortir de l&apos;inventaire</>}</Button>;
}
