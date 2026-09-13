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
  const [pending, startT] = useTransition();
  const router = useRouter();
  const sel = "h-8 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="cc-open"><Plus />Nouvelle convention</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-3"
          data-testid="create-convention"
          onSubmit={(e) => {
            e.preventDefault();
            startT(async () => {
              const r = await createConvention({ funderId, reference, scheme, startYear: Number(start), endYear: Number(end), amountNotified: notified ? Number(notified) : null });
              if (!r.ok) { toast.error(r.error); return; }
              toast.success("Convention créée");
              setOpen(false); setReference(""); setScheme(""); setNotified("");
              router.push(`/conventions/${r.data!.id}`);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Nouvelle convention</DialogTitle>
            <DialogDescription>Une référence unique ; les éditions s'y rattachent ensuite depuis leur onglet Financements.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1"><Label htmlFor="cc-funder">Financeur</Label><select id="cc-funder" className={sel} value={funderId} onChange={(e) => setFunderId(e.target.value)} data-testid="cc-funder">{funders.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
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
