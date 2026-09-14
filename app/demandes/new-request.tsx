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
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="new-request"><Plus />Nouvelle demande</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouvelle demande</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid gap-1 text-xs"><span className="font-semibold">Quel type ?</span>
            <div className="flex flex-wrap gap-1">
              {REQUEST_KINDS.map((k) => <button key={k.value} type="button" onClick={() => setKind(k.value)} className={`rounded-full border px-2.5 py-1 text-xs ${kind === k.value ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted"}`} title={k.hint} data-testid={`request-kind-${k.value}`}>{k.label}</button>)}
            </div>
            <p className="text-[10px] text-muted-foreground">Un achat ou un devis ? C'est une <Link href="/validations" className="text-primary hover:underline">validation</Link> — depuis l'édition, « Demander une validation ».</p>
          </div>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Quoi ?</span><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Réserver la salle du CA pour le 1er octobre" required data-testid="request-title" /></label>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Détail <span className="font-normal text-muted-foreground">(pour quoi faire, sous quelle forme)</span></span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="rounded-md border bg-card p-2 text-sm" data-testid="request-body" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs"><span className="font-semibold">À qui ?</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} required className="h-9 rounded-md border bg-card px-2 text-sm" data-testid="request-to">
                <option value="">— choisir —</option>
                <optgroup label="Une personne">{people.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup>
                <optgroup label="Un pôle">{poles.map((p) => <option key={p.id} value={`g:${p.id}`}>{p.name}</option>)}</optgroup>
              </select>
            </label>
            <label className="grid gap-1 text-xs"><span className="font-semibold">Pour quand ?</span><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="request-due" /></label>
          </div>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Projet concerné <span className="font-normal text-muted-foreground">(facultatif)</span></span>
            <select value={editionId} onChange={(e) => setEditionId(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm"><option value="">—</option>{editions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.year}</option>)}</select>
          </label>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={pending || !title.trim() || !to} data-testid="request-submit">Envoyer</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
