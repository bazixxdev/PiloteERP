"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeRequiredLevel, requestValidation } from "@/app/actions/edition";

const LEVELS = ["1 · pilote", "2 · responsable de pôle", "3 · direction"];

export function RequestValidationDialog({ editionId, actions, kinds }: { editionId: string; actions: { id: string; name: string }[]; kinds: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("quote");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [actionId, setActionId] = useState("");
  const [url, setUrl] = useState("");
  const [level, setLevel] = useState(1);
  const [computed, setComputed] = useState(1);
  const [delay, setDelay] = useState("5");
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const n = amount === "" ? null : Number(amount.replace(",", "."));
    computeRequiredLevel(editionId, n).then((l) => { setComputed(l); setLevel(l); });
  }, [amount, editionId, open]);

  const sel = "h-8 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="request-validation-open"><ShieldCheck />Demander une validation</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demander une validation</DialogTitle>
          <DialogDescription>Le niveau requis est calculé depuis le montant, les seuils et l'enveloppe restante ; vous pouvez l'ajuster.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Nature</Label>
              <select className={sel} value={kind} onChange={(e) => setKind(e.target.value)} data-testid="rv-kind">
                {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Montant (€)</Label>
              <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" data-testid="rv-amount" />
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Objet</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Devis traiteur pour la soirée…" data-testid="rv-label" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Action concernée</Label>
              <select className={sel} value={actionId} onChange={(e) => setActionId(e.target.value)}>
                <option value="">— l'édition entière —</option>
                {actions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Pièce (chemin ou lien) <span className="text-xs text-muted-foreground">— ou déposez le fichier après envoi</span></Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="\\cress\Partage\…\devis.pdf" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Niveau requis <span className="text-xs text-muted-foreground">(calculé : {computed})</span></Label>
              <select className={sel} value={level} onChange={(e) => setLevel(Number(e.target.value))} data-testid="rv-level">
                {LEVELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Délai cible (jours)</Label>
              <Input type="number" value={delay} onChange={(e) => setDelay(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            data-testid="rv-submit"
            disabled={pending || !label.trim()}
            onClick={() =>
              start(async () => {
                const res = await requestValidation({ editionId, actionId, kind, label, amount: amount === "" ? null : Number(amount.replace(",", ".")), attachmentUrl: url, requiredLevel: level, targetDelayDays: Number(delay) || 5 });
                if (!res.ok) { toast.error(res.error); return; }
                toast.success(`Demande envoyée (niveau ${res.data!.requiredLevel})`);
                setOpen(false); setLabel(""); setAmount(""); setUrl("");
                router.push(`/edition/${editionId}?onglet=validations`);
                router.refresh();
              })
            }
          >
            {pending ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
