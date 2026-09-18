"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, RefreshCw, Repeat, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect, Select } from "@/components/common/searchable-select";
import { createMembership, deleteMembership, renewMemberships, setMembershipStatus, type MembershipInput } from "@/app/actions/members";
import { syncHelloAsso } from "@/app/actions/helloasso";
import { helloAssoReportText } from "@/lib/helloasso";
import { MEMBERSHIP_METHODS, MEMBERSHIP_STATUS } from "@/lib/members";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";

type Run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (r: { data?: unknown }) => void) => void;
function useRun(): [boolean, Run] {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run: Run = (fn, after) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(r); router.refresh(); });
  return [pending, run];
}

// Recherche, statut, collège (dans l'adresse).
export function MembersToolbar({ q, statut, college, colleges, year }: { q: string; statut: string; college: string; colleges: string[]; year: number }) {
  const router = useRouter();
  const go = (patch: Record<string, string>) => { const p = new URLSearchParams({ annee: String(year) }); for (const [k, v] of Object.entries({ q, statut, college, ...patch })) if (v) p.set(k, v); router.push(`/adherents?${p.toString()}`); };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <form className="relative" onSubmit={(e) => { e.preventDefault(); go({ q: ((new FormData(e.currentTarget).get("q") as string) ?? "").trim() }); }}>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Nom, référent, e-mail…" className="h-8 w-56 pl-8 text-xs" aria-label="Rechercher un adhérent" data-testid="members-search" />
      </form>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => go({ statut: "" })} className={cn("rounded-full border px-2 py-0.5 text-[11px]", !statut ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")} data-testid="members-status-all">Tous</button>
        {MEMBERSHIP_STATUS.map((s) => <button key={s.value} type="button" title={s.hint} onClick={() => go({ statut: statut === s.value ? "" : s.value })} className={cn("rounded-full border px-2 py-0.5 text-[11px]", statut === s.value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")} data-testid={`members-status-${s.value}`}>{s.label}</button>)}
      </div>
      <Select value={college} onChange={(e) => go({ college: e.target.value })} className="h-8 text-xs" aria-label="Collège" data-testid="members-college"><option value="">Tous les collèges</option>{colleges.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
    </div>
  );
}

// Nouvelle adhésion : une structure (de l'annuaire, ou par son nom) ou une personne (de l'annuaire, ou créée) ; année, collège,
// cotisation, statut.
export function NewMembershipDialog({ year, organisations, colleges }: { year: number; organisations: { id: string; name: string }[]; colleges: string[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"organisation" | "person">("organisation");
  const [organisationId, setOrganisationId] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [contactId, setContactId] = useState("");
  const [people, setPeople] = useState<{ id: string; label: string }[] | null>(null);
  const [person, setPerson] = useState({ lastName: "", firstName: "", email: "" });
  const [referent, setReferent] = useState({ lastName: "", firstName: "", email: "" });
  const [form, setForm] = useState({ year: String(year), college: "", amount: "", status: "due", method: "", paidAt: "" });
  const [pending, run] = useRun();
  const loadPeople = async () => { if (people) return; const r = await fetch(withBase("/contacts/export?annuaire=1")); setPeople(await r.json()); };
  const reset = () => { setOrganisationId(""); setOrganisationName(""); setContactId(""); setPerson({ lastName: "", firstName: "", email: "" }); setReferent({ lastName: "", firstName: "", email: "" }); setForm({ year: String(year), college: "", amount: "", status: "due", method: "", paidAt: "" }); };
  const submit = () => {
    const input: MembershipInput = { year: Number(form.year), college: form.college || null, amount: form.amount ? Number(form.amount.replace(",", ".")) : 0, status: form.status, method: form.method || null, paidAt: form.paidAt || null };
    if (kind === "organisation") { input.organisationId = organisationId || null; input.organisationName = organisationId ? null : organisationName; if (referent.lastName.trim()) input.contact = referent; }
    else { input.contactId = contactId || null; if (!contactId) input.contact = person; }
    run(() => createMembership(input), () => { setOpen(false); reset(); toast.success("Adhésion enregistrée"); });
  };
  const ok = kind === "organisation" ? Boolean(organisationId || organisationName.trim()) : Boolean(contactId || person.lastName.trim());
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" data-testid="new-membership"><Plus />Nouvelle adhésion</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouvelle adhésion {form.year}</DialogTitle></DialogHeader>
        <div className="flex gap-1 rounded-md bg-muted p-0.5 text-xs">
          <button type="button" onClick={() => setKind("organisation")} className={cn("flex-1 rounded px-2 py-1", kind === "organisation" && "bg-card font-semibold shadow-sm")} data-testid="membership-kind-organisation">Une structure</button>
          <button type="button" onClick={() => { setKind("person"); void loadPeople(); }} className={cn("flex-1 rounded px-2 py-1", kind === "person" && "bg-card font-semibold shadow-sm")} data-testid="membership-kind-person">Une personne</button>
        </div>
        <form className="grid gap-3 text-xs" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {kind === "organisation" ? (
            <>
              <div className="grid gap-1"><span className="font-semibold">Structure</span>
                <SearchableSelect options={organisations.map((o) => ({ value: o.id, label: o.name }))} value={organisationId} onChange={setOrganisationId} emptyOption="— dans l'annuaire des organisations —" searchFrom={1} aria-label="Organisation" className="h-9 w-full" data-testid="membership-organisation" />
                {!organisationId && <Input value={organisationName} onChange={(e) => setOrganisationName(e.target.value)} placeholder="ou le nom d'une nouvelle structure" className="h-8" data-testid="membership-organisationName" />}
              </div>
              <div className="grid gap-1"><span className="font-semibold">Référent·e <span className="font-normal text-muted-foreground">· facultatif, entre dans l&apos;annuaire rattaché·e à la structure</span></span>
                <div className="grid grid-cols-3 gap-1.5"><Input value={referent.firstName} onChange={(e) => setReferent({ ...referent, firstName: e.target.value })} placeholder="Prénom" className="h-8" /><Input value={referent.lastName} onChange={(e) => setReferent({ ...referent, lastName: e.target.value })} placeholder="Nom" className="h-8" data-testid="membership-referent-lastName" /><Input type="email" value={referent.email} onChange={(e) => setReferent({ ...referent, email: e.target.value })} placeholder="E-mail" className="h-8" data-testid="membership-referent-email" /></div>
              </div>
            </>
          ) : (
            <div className="grid gap-1"><span className="font-semibold">Personne</span>
              <SearchableSelect options={(people ?? []).map((c) => ({ value: c.id, label: c.label }))} value={contactId} onChange={setContactId} emptyOption={people ? "— dans l'annuaire des contacts —" : "Lecture de l'annuaire…"} searchFrom={1} aria-label="Contact" className="h-9 w-full" data-testid="membership-contact" />
              {!contactId && <div className="grid grid-cols-3 gap-1.5"><Input value={person.firstName} onChange={(e) => setPerson({ ...person, firstName: e.target.value })} placeholder="Prénom" className="h-8" /><Input value={person.lastName} onChange={(e) => setPerson({ ...person, lastName: e.target.value })} placeholder="Nom (nouvelle personne)" className="h-8" data-testid="membership-person-lastName" /><Input type="email" value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} placeholder="E-mail" className="h-8" /></div>}
            </div>
          )}
          <div className="grid grid-cols-[6rem_1fr_7rem] gap-1.5">
            <label className="grid gap-1"><span className="font-semibold">Année</span><Input type="number" min={2000} max={2100} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="h-8" data-testid="membership-year" /></label>
            <label className="grid gap-1"><span className="font-semibold">Collège</span><Input list="colleges" value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} placeholder="Associations, Coopératives…" className="h-8" data-testid="membership-college" /><datalist id="colleges">{colleges.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="grid gap-1"><span className="font-semibold">Cotisation (€)</span><Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="h-8 text-right" data-testid="membership-amount" /></label>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-1.5">
            <label className="grid gap-1"><span className="font-semibold">Statut</span><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-8 text-xs" aria-label="Statut" data-testid="membership-status">{MEMBERSHIP_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></label>
            {form.status === "paid" && <label className="grid gap-1"><span className="font-semibold">Moyen</span><Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="h-8 text-xs" aria-label="Moyen de règlement" data-testid="membership-method"><option value="">—</option>{MEMBERSHIP_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></label>}
            {form.status === "paid" && <label className="grid gap-1"><span className="font-semibold">Réglée le</span><Input type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} className="h-8" data-testid="membership-paidAt" /></label>}
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" size="sm" disabled={pending || !ok} data-testid="membership-submit">Enregistrer</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Régler en un clic : moyen de règlement demandé, date du jour.
export function PayButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("transfer");
  const [pending, run] = useRun();
  if (!open) return <Button size="xs" variant="outline" onClick={() => setOpen(true)} data-testid={`membership-pay-${id}`}><CheckCircle2 />Régler</Button>;
  return (
    <span className="inline-flex items-center gap-1">
      <Select value={method} onChange={(e) => setMethod(e.target.value)} className="h-7 text-[11px]" aria-label="Moyen de règlement" data-testid={`membership-pay-method-${id}`}>{MEMBERSHIP_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
      <Button size="xs" disabled={pending} onClick={() => run(() => setMembershipStatus(id, "paid", method), () => { setOpen(false); toast.success("Cotisation réglée"); })} data-testid={`membership-pay-confirm-${id}`}>OK</Button>
      <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
    </span>
  );
}

export function DeleteMembershipButton({ id, name, helloAsso }: { id: string; name: string; helloAsso: boolean }) {
  const [pending, run] = useRun();
  if (helloAsso) return null;
  return <button type="button" disabled={pending} title="Supprimer l'adhésion" aria-label={`Supprimer l'adhésion de ${name}`} onClick={() => { if (confirm(`Supprimer l'adhésion de ${name} ? Le membre reste dans l'annuaire.`)) run(() => deleteMembership(id)); }} className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-danger" data-testid={`membership-delete-${id}`}><Trash2 className="size-3.5" /></button>;
}

// Reconduire N−1 → N : prépare la campagne (adhésions « à régler »), rien n'est encaissé.
export function RenewButton({ fromYear, toYear, previousCount }: { fromYear: number; toYear: number; previousCount: number }) {
  const [pending, run] = useRun();
  if (!previousCount) return null;
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => { if (confirm(`Reconduire en ${toYear} les ${previousCount} adhésions de ${fromYear} qui ne le sont pas encore ? Elles passent « à régler », même collège et même cotisation ; rien n'est encaissé.`)) run(() => renewMemberships(fromYear), (r) => { const d = r.data as { created: number; skipped: number }; toast.success(`${d.created} adhésion${d.created > 1 ? "s" : ""} reconduite${d.created > 1 ? "s" : ""}${d.skipped ? ` · ${d.skipped} déjà en ${toYear}` : ""}`); }); }} data-testid="members-renew"><Repeat />Reconduire {fromYear} → {toYear}</Button>;
}

export function HelloAssoSyncButton() {
  const [pending, run] = useRun();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => syncHelloAsso(), (r) => toast.success(`HelloAsso : ${helloAssoReportText(r.data as Parameters<typeof helloAssoReportText>[0])}`))} data-testid="helloasso-sync"><RefreshCw />Synchroniser HelloAsso</Button>;
}
