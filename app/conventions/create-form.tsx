"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createConvention } from "@/app/actions/edition";
import { createDossier } from "@/app/actions/dossiers";
import { AMOUNT_KINDS } from "@/lib/dossiers";
import { REF_DEFAULTS } from "@/lib/refs";
const FORMS = REF_DEFAULTS.funding_form;
import { Select } from "@/components/common/searchable-select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { V, pl } from "@/lib/vocab";

// Nouvelle convention (RAF) : financeur, référence unique, dispositif, période, montant notifié. Ouvre la page de la convention créée.
export function CreateConventionDialog({ funders }: { funders: { value: string; label: string }[] }) {
  const y = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [funderId, setFunderId] = useState(funders[0]?.value ?? "");
  const [reference, setReference] = useState("");
  const [scheme, setScheme] = useState("");
  const [start, setStart] = useState(String(y));
  const [end, setEnd] = useState(String(y + 2));
  const [notified, setNotified] = useState("");
  const [form, setForm] = useState("convention");
  const [pending, startT] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="cc-open"><Plus />Enregistrer un financement obtenu</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-3"
          data-testid="create-convention"
          onSubmit={(e) => {
            e.preventDefault();
            startT(async () => {
              const r = await createConvention({ funderId, reference, scheme, startYear: Number(start), endYear: Number(end), amountNotified: notified ? Number(notified) : null, form });
              if (!r.ok) { toast.error(r.error); return; }
              toast.success("Financement enregistré");
              setOpen(false); setReference(""); setScheme(""); setNotified("");
              router.push(`/conventions/${r.data!.id}`);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Financement déjà obtenu</DialogTitle>
            <DialogDescription>{`Pour un financement acquis sans dossier ici (convention en cours, mécénat…). Une référence unique ; les ${pl(V.edition)} s'y rattachent ensuite depuis leur onglet Financements.`}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1"><Label htmlFor="cc-funder">Financeur</Label><SearchableSelect id="cc-funder" options={funders} value={funderId} onChange={setFunderId} data-testid="cc-funder" className="w-full" /></div>
          <div className="grid gap-1"><Label htmlFor="cc-form">Forme</Label><Select id="cc-form" value={form} onChange={(e) => setForm(e.target.value)} className="h-9 text-sm" data-testid="cc-form">{FORMS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label htmlFor="cc-reference">Référence</Label><Input id="cc-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="FSE-2026-2028" data-testid="cc-reference" /></div>
            <div className="grid gap-1"><Label htmlFor="cc-scheme">Dispositif</Label><Input id="cc-scheme" value={scheme} onChange={(e) => setScheme(e.target.value)} placeholder="CPO, appel à projets…" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1"><Label htmlFor="cc-start">Début</Label><Input id="cc-start" type="number" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="grid gap-1"><Label htmlFor="cc-end">Fin</Label><Input id="cc-end" type="number" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            <div className="grid gap-1"><Label htmlFor="cc-notified">Notifié (€)</Label><Input id="cc-notified" type="number" value={notified} onChange={(e) => setNotified(e.target.value)} placeholder="0" data-testid="cc-notified" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending || !reference.trim()} data-testid="cc-submit">{pending ? "Création…" : "Créer la convention"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// Nouveau dossier de financement : le financeur (de l'annuaire, ou par son nom), ce qu'on vise, combien, sur combien de temps,
// pour quel projet, l'échéance de dépôt, qui répond. Statut « à étudier » ; la page du dossier s'ouvre.
export function NewDossierDialog({ funders, projects, people }: { funders: { value: string; label: string }[]; projects: { value: string; label: string }[]; people: { value: string; label: string }[] }) {
  const y = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ funderId: "", funderName: "", label: "", scheme: "", description: "", amountRequested: "", amountKind: "total", startYear: String(y), years: "1", deadline: "", targetProjectId: "", ownerId: "" });
  const [pending, startT] = useTransition();
  const router = useRouter();
  const ok = f.label.trim() && (f.funderId || f.funderName.trim());
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="nd-open"><Plus />Nouveau dossier</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Nouveau dossier de financement</DialogTitle><DialogDescription>Ce qu&apos;on vise, avant d&apos;avoir quoi que ce soit : le dossier avance ensuite étape par étape (à étudier, réponse, déposé, obtenu ou non).</DialogDescription></DialogHeader>
        <form className="grid gap-3 text-xs" data-testid="new-dossier" onSubmit={(e) => { e.preventDefault(); startT(async () => { const r = await createDossier({ ...f, endYear: Number(f.startYear) + Math.max(1, Number(f.years) || 1) - 1 }); if (!r.ok) { toast.error(r.error); return; } toast.success("Dossier ouvert"); setOpen(false); router.push(`/conventions/${r.data!.id}`); }); }}>
          <div className="grid gap-1"><span className="font-semibold">Financeur</span>
            <SearchableSelect options={funders} value={f.funderId} onChange={(v) => setF({ ...f, funderId: v })} emptyOption="— dans l'annuaire —" searchFrom={1} aria-label="Financeur" className="h-9 w-full" data-testid="nd-funder" />
            {!f.funderId && <Input value={f.funderName} onChange={(e) => setF({ ...f, funderName: e.target.value })} placeholder="ou le nom d'un nouveau financeur" className="h-8" data-testid="nd-funder-name" />}
          </div>
          <label className="grid gap-1"><span className="font-semibold">Intitulé</span><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="AAP transition écologique 2027, Mécénat Fondation X…" className="h-8" data-testid="nd-label" /></label>
          <label className="grid gap-1"><span className="font-semibold">De quoi il s&apos;agit</span><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="ce qui est financé, les conditions, ce qu'on demande" className="h-8" data-testid="nd-description" /></label>
          <div className="grid grid-cols-[1fr_1fr] gap-1.5">
            <div className="grid gap-1"><span className="font-semibold">Pour quel projet</span><SearchableSelect options={projects} value={f.targetProjectId} onChange={(v) => setF({ ...f, targetProjectId: v })} emptyOption="— à préciser —" searchFrom={1} aria-label="Projet visé" className="h-8 w-full text-xs" data-testid="nd-project" /></div>
            <div className="grid gap-1"><span className="font-semibold">Qui répond</span><SearchableSelect options={people} value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} emptyOption="— à désigner —" aria-label="Responsable de la réponse" className="h-8 w-full text-xs" data-testid="nd-owner" /></div>
          </div>
          <div className="grid grid-cols-[8rem_1fr_5rem] gap-1.5">
            <label className="grid gap-1"><span className="font-semibold">Montant visé (€)</span><Input inputMode="decimal" value={f.amountRequested} onChange={(e) => setF({ ...f, amountRequested: e.target.value })} className="h-8 text-right" data-testid="nd-amount" /></label>
            <label className="grid gap-1"><span className="font-semibold">Ce montant est</span><Select value={f.amountKind} onChange={(e) => setF({ ...f, amountKind: e.target.value })} className="h-8 text-xs" aria-label="Nature du montant" data-testid="nd-amount-kind">{AMOUNT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select></label>
            <label className="grid gap-1"><span className="font-semibold">Durée (ans)</span><Input type="number" min={1} max={10} value={f.years} onChange={(e) => setF({ ...f, years: e.target.value })} className="h-8" data-testid="nd-years" /></label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <label className="grid gap-1"><span className="font-semibold">Première année</span><Input type="number" min={2020} max={2100} value={f.startYear} onChange={(e) => setF({ ...f, startYear: e.target.value })} className="h-8" data-testid="nd-year" /></label>
            <label className="grid gap-1"><span className="font-semibold">Échéance de dépôt</span><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} className="h-8" data-testid="nd-deadline" /></label>
            <label className="grid gap-1"><span className="font-semibold">Dispositif</span><Input value={f.scheme} onChange={(e) => setF({ ...f, scheme: e.target.value })} placeholder="axe, programme" className="h-8" /></label>
          </div>
          <DialogFooter><Button type="submit" disabled={pending || !ok} data-testid="nd-submit">Ouvrir le dossier</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
