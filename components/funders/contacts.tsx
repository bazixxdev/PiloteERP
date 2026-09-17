"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoField } from "@/components/inline/auto-field";
import { addFunderContact, deleteFunderContact, setPrimaryFunderContact } from "@/app/actions/funders";
import { cn } from "@/lib/utils";

export type ContactView = { id: string; firstName: string | null; lastName: string; role: string | null; email: string | null; phone: string | null; notes: string | null; primary: boolean };

export const contactName = (c: { firstName?: string | null; lastName: string }) => [c.firstName, c.lastName].filter(Boolean).join(" ");

// Un contact en clair : nom · fonction, email et téléphone cliquables. Sert sur les lignes de financement et les conventions.
export function ContactLine({ c, label, className }: { c: ContactView | { firstName: string | null; lastName: string; role: string | null; email: string | null; phone: string | null } | null; label?: string; className?: string }) {
  if (!c) return <span className={cn("text-xs text-muted-foreground", className)}>{label ? `${label} : ` : ""}aucun contact renseigné</span>;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs", className)}>
      {label && <span className="text-muted-foreground">{label} :</span>}
      <b>{contactName(c)}</b>{c.role && <span className="text-muted-foreground">· {c.role}</span>}
      {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="size-3" aria-hidden />{c.email}</a>}
      {c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="size-3" aria-hidden />{c.phone}</a>}
    </span>
  );
}

// Contacts d'un financeur : ajout en ligne, champs modifiables en place (RAF), contact principal, suppression.
export function FunderContacts({ funderId, contacts, readOnly }: { funderId: string; contacts: ContactView[]; readOnly: boolean }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", role: "", email: "", phone: "" });
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  const sorted = [...contacts].sort((a, b) => Number(b.primary) - Number(a.primary) || a.lastName.localeCompare(b.lastName, "fr"));
  const F = ({ id, field, value, placeholder, cls, label }: { id: string; field: string; value: string | null; placeholder: string; cls?: string; label: string }) => (
    <AutoField model="organisationContact" id={id} field={field} type="text" value={value} readOnly={readOnly} placeholder={placeholder} inputClassName={cn("text-xs", cls)} label={label} />
  );
  return (
    <div data-testid="funder-contacts">
      {sorted.length === 0 && <p className="mb-2 text-sm text-muted-foreground">Aucun contact renseigné.</p>}
      <ul className="divide-y">
        {sorted.map((c) => (
          <li key={c.id} className="grid gap-1 py-2 md:grid-cols-[auto_0.8fr_1fr_1.2fr_1.6fr_0.9fr_auto] md:items-center" data-testid={`contact-${c.id}`} data-contact={c.lastName}>
            <button type="button" disabled={readOnly || pending || c.primary} onClick={() => run(() => setPrimaryFunderContact(c.id))} title={c.primary ? "Contact principal" : "Définir comme contact principal"} aria-label={c.primary ? "Contact principal" : `Définir ${contactName(c)} comme contact principal`} className={cn("rounded p-1", c.primary ? "text-warning" : "text-muted-foreground/40 hover:text-warning", readOnly && "cursor-default")} data-testid={`contact-primary-${c.id}`}>
              <Star className={cn("size-4", c.primary && "fill-current")} />
            </button>
            <F id={c.id} field="firstName" value={c.firstName} placeholder="Prénom" label={`Prénom, ${c.lastName}`} />
            <F id={c.id} field="lastName" value={c.lastName} placeholder="Nom" cls="font-semibold" label={`Nom, ${c.lastName}`} />
            <F id={c.id} field="role" value={c.role} placeholder="Fonction" label={`Fonction, ${c.lastName}`} />
            <div className="flex items-center gap-1">
              {c.email && <a href={`mailto:${c.email}`} className="shrink-0 text-primary" title={`Écrire à ${c.email}`} aria-label={`Écrire à ${c.email}`}><Mail className="size-3.5" /></a>}
              <F id={c.id} field="email" value={c.email} placeholder="Email" label={`Email, ${c.lastName}`} />
            </div>
            <F id={c.id} field="phone" value={c.phone} placeholder="Téléphone" label={`Téléphone, ${c.lastName}`} />
            {!readOnly ? (
              <button type="button" disabled={pending} onClick={() => { if (confirm(`Supprimer le contact ${contactName(c)} ?`)) run(() => deleteFunderContact(c.id)); }} aria-label={`Supprimer ${contactName(c)}`} className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-danger" data-testid={`contact-delete-${c.id}`}><Trash2 className="size-3.5" /></button>
            ) : <span />}
            <div className="md:col-span-7 md:pl-8"><AutoField model="organisationContact" id={c.id} field="notes" type="text" value={c.notes} readOnly={readOnly} placeholder={readOnly ? "" : "Note : créneaux, habitudes, sujets suivis…"} inputClassName="text-[11px] text-muted-foreground" label={`Note, ${c.lastName}`} /></div>
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form className="mt-3 grid gap-1.5 rounded-lg border border-dashed p-2 md:grid-cols-[0.8fr_1fr_1.2fr_1.6fr_0.9fr_auto]" data-testid="contact-form" onSubmit={(e) => { e.preventDefault(); run(() => addFunderContact(funderId, form), () => setForm({ firstName: "", lastName: "", role: "", email: "", phone: "" })); }}>
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Prénom" aria-label="Prénom" className="h-8 text-xs" />
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Nom *" aria-label="Nom" className="h-8 text-xs" required data-testid="contact-lastname" />
          <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Fonction" aria-label="Fonction" className="h-8 text-xs" data-testid="contact-role" />
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" aria-label="Email" className="h-8 text-xs" data-testid="contact-email" />
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Téléphone" aria-label="Téléphone" className="h-8 text-xs" />
          <Button type="submit" size="sm" variant="outline" disabled={pending || !form.lastName.trim()} data-testid="contact-submit"><Plus />Ajouter</Button>
        </form>
      )}
    </div>
  );
}
