"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addRequest } from "@/app/actions/requests";
import { REQUEST_KINDS } from "@/lib/requests";
import { SearchableSelect } from "@/components/common/searchable-select";

type Opt = { id: string; name: string };

// Nouvelle demande : un type, un destinataire (personne ou pôle), pour quand, l'objet. Un achat ou un devis part en validation.
export function NewRequestDialog({ people, poles, editions, defaultEditionId }: { people: Opt[]; poles: Opt[]; editions: { id: string; name: string; year: number }[]; defaultEditionId?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("site");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editionId, setEditionId] = useState(defaultEditionId ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = () => start(async () => {
    const [type, id] = to.split(":");
    const r = await addRequest({ kind, title, body, assigneeId: type === "p" ? id : null, poleId: type === "g" ? id : null, editionId: editionId || null, dueDate: dueDate || null });
    if (!r.ok) toast.error(r.error); else { toast.success("Demande envoyée"); setOpen(false); setTitle(""); setBody(""); setDueDate(""); router.refresh(); }
  });
  const editionOptions = editions.map((e) => ({ value: e.id, label: e.name, hint: String(e.year) }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="new-request"><Plus />Nouvelle demande</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouvelle demande</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid gap-1 text-xs"><span className="font-semibold">Quel type ?</span>
            <div className="flex flex-wrap gap-1">
              {REQUEST_KINDS.map((k) => <button key={k.value} type="button" onClick={() => setKind(k.value)} className={`rounded-full border px-2.5 py-1 text-xs ${kind === k.value ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted"}`} title={k.hint} data-testid={`request-kind-${k.value}`}>{k.label}</button>)}
              <button type="button" onClick={() => setKind("quote")} className={`rounded-full border px-2.5 py-1 text-xs ${kind === "quote" ? "border-primary bg-primary text-white" : "border-dashed bg-card hover:bg-muted"}`} title="Un achat ou un devis passe par le circuit de validation (niveau selon le montant)" data-testid="request-kind-quote">Achat / devis</button>
            </div>
          </div>
          {kind === "quote" ? (
            // Un achat ou un devis n'est pas une demande interne : c'est une validation, portée par une édition (retour du 15/09 : « je ne trouve pas ce bouton »).
            <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-xs" data-testid="request-quote-redirect">
              <p>Un achat ou un devis passe par le <b>circuit de validation</b> : il est engagé sur le budget d'une édition et validé au niveau que son montant impose. Utilisez le bouton <b>Nouvelle validation</b> à côté — ou choisissez l'édition ici, le formulaire s'ouvre sur sa fiche.</p>
              <SearchableSelect options={editionOptions} value={editionId} onChange={setEditionId} placeholder="— l'édition concernée —" data-testid="request-quote-edition" className="h-9 w-full" />
              <div className="flex justify-end"><Button asChild disabled={!editionId} data-testid="request-quote-go"><Link href={editionId ? `/edition/${editionId}?onglet=apercu&validation=1` : "#"} aria-disabled={!editionId} onClick={(e) => { if (!editionId) e.preventDefault(); else setOpen(false); }}>Demander la validation sur cette édition →</Link></Button></div>
            </div>
          ) : (<>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Quoi ?</span><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Réserver la salle du CA pour le 1er octobre" required data-testid="request-title" /></label>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Détail <span className="font-normal text-muted-foreground">(pour quoi faire, sous quelle forme)</span></span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="rounded-md border bg-card p-2 text-sm" data-testid="request-body" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs"><span className="font-semibold">À qui ?</span>
              <SearchableSelect options={[...people.map((p) => ({ value: `p:${p.id}`, label: p.name, group: "Une personne" })), ...poles.map((p) => ({ value: `g:${p.id}`, label: p.name, group: "Un pôle" }))]} value={to} onChange={setTo} placeholder="— choisir —" aria-label="À qui ?" data-testid="request-to" className="h-9 w-full" />
            </label>
            <label className="grid gap-1 text-xs"><span className="font-semibold">Pour quand ?</span><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="request-due" /></label>
          </div>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Projet concerné <span className="font-normal text-muted-foreground">(facultatif)</span></span>
            <SearchableSelect options={editionOptions} value={editionId} onChange={setEditionId} emptyOption="— aucun —" aria-label="Projet concerné" className="h-9 w-full" />
          </label>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={pending || !title.trim() || !to} data-testid="request-submit">Envoyer</Button></div>
          </>)}
        </form>
      </DialogContent>
    </Dialog>
  );
}
