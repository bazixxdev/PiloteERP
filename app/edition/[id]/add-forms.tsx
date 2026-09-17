"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/common/reveal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addAction, addDeliverable, addDocLink, addFundingLine, addIndicator, addComment, addExpense, addFundingLineFromConvention } from "@/app/actions/edition";
import { SearchableSelect, Select } from "@/components/common/searchable-select";

type R = { ok: true } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error); return; }
      after?.();
      router.refresh();
    });
  return { pending, run };
}

export function AddActionForm({ editionId }: { editionId: string }) {
  const [name, setName] = useState("");
  const { pending, run } = useRun();
  return (
    <Reveal label="Action" testId="add-action-open">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; run(() => addAction(editionId, name), () => setName("")); }}>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'action (Entrée pour ajouter)" className="h-7 w-72" data-testid="add-action-input" />
        <Button type="submit" size="sm" variant="outline" disabled={pending || !name.trim()} data-testid="add-action-submit"><Plus />Ajouter</Button>
      </form>
    </Reveal>
  );
}

// « + Ajouter » des financements (revue du 15/09) : un seul bouton, deux gestes dedans — nouvelle ligne (aucun financeur présélectionné)
// ou rattachement d'une convention pluriannuelle existante.
export function AddFundingMenu({ editionId, funders, conventions }: { editionId: string; funders: { id: string; name: string }[]; conventions: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [funderId, setFunderId] = useState("");
  const [conventionId, setConventionId] = useState("");
  const { pending, run } = useRun();
  const sel = "h-8 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button size="sm" variant="outline" data-testid="add-funding-open"><Plus />Ajouter</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="grid gap-2">
          <div className="text-xs font-semibold">Nouvelle ligne de financement</div>
          <SearchableSelect options={funders.map((f) => ({ value: f.id, label: f.name }))} value={funderId} onChange={setFunderId} placeholder="Choisir un financeur…" data-testid="add-funding-funder" aria-label="Financeur" className="w-full" />
          <Button size="sm" variant="outline" disabled={pending || !funderId} onClick={() => run(() => addFundingLine(editionId, funderId), () => { setFunderId(""); setOpen(false); })} data-testid="add-funding-submit"><Plus />Ajouter la ligne</Button>
          {conventions.length > 0 && (
            <>
              <div className="mt-1 border-t pt-2 text-xs font-semibold">Rattacher une convention existante</div>
              <Select className={sel} value={conventionId} onChange={(e) => setConventionId(e.target.value)} data-testid="attach-convention-select" aria-label="Convention">
                <option value="">Choisir une convention…</option>
                {conventions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
              <Button size="sm" variant="outline" disabled={pending || !conventionId} onClick={() => run(() => addFundingLineFromConvention(editionId, conventionId), () => { setConventionId(""); setOpen(false); })} data-testid="attach-convention-submit"><Plus />Rattacher</Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AddDeliverableForm({ fundingLineId }: { fundingLineId: string }) {
  const [label, setLabel] = useState("");
  const [due, setDue] = useState("");
  const { pending, run } = useRun();
  return (
    <Reveal label="Livrable" size="xs" testId="add-deliverable-open">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!label.trim() || !due) return; run(() => addDeliverable(fundingLineId, label, due), () => { setLabel(""); setDue(""); }); }}>
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nouveau livrable (bilan, justificatifs…)" className="h-7 w-72 text-xs" data-testid="add-deliverable-label" />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-36 text-xs" data-testid="add-deliverable-date" aria-label="Échéance" />
        <Button type="submit" size="xs" variant="outline" disabled={pending || !label.trim() || !due} data-testid="add-deliverable-submit"><Plus />Ajouter</Button>
      </form>
    </Reveal>
  );
}

export function AddIndicatorForm({ editionId }: { editionId: string }) {
  const [label, setLabel] = useState("");
  const [imposed, setImposed] = useState(false);
  const { pending, run } = useRun();
  return (
    <Reveal label="Indicateur" size="xs" testId="add-indicator-open">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; run(() => addIndicator(editionId, label, imposed), () => setLabel("")); }}>
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nouvel indicateur…" className="h-7 w-56 text-xs" data-testid="add-indicator-label" />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={imposed} onChange={(e) => setImposed(e.target.checked)} className="accent-primary" /> imposé par un financeur</label>
        <Button type="submit" size="xs" variant="outline" disabled={pending || !label.trim()} data-testid="add-indicator-submit"><Plus />Ajouter</Button>
      </form>
    </Reveal>
  );
}

export function AddDocLinkForm({ editionId, canCodir }: { editionId: string; canCodir: boolean }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [codir, setCodir] = useState(false);
  const { pending, run } = useRun();
  return (
    <Reveal label="Chemin ou lien" testId="add-doclink-open">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!label.trim() || !url.trim()) return; run(() => addDocLink(editionId, label, url, codir), () => { setLabel(""); setUrl(""); setCodir(false); }); }}>
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé" className="h-7 w-44 text-xs" data-testid="add-doclink-label" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="\\serveur\Partage\… ou https://…" className="h-7 w-72 text-xs" data-testid="add-doclink-url" title="Un chemin serveur (\\serveur\…) ou une adresse web (https://) : l'outil range chacun dans sa famille" />
        {canCodir && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={codir} onChange={(e) => setCodir(e.target.checked)} className="accent-primary" /> CODIR seulement</label>}
        <Button type="submit" size="xs" variant="outline" disabled={pending || !label.trim() || !url.trim()} data-testid="add-doclink-submit"><Plus />Ajouter</Button>
      </form>
    </Reveal>
  );
}

export function AddCommentForm({ editionId }: { editionId: string }) {
  const [body, setBody] = useState("");
  const { pending, run } = useRun();
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!body.trim()) return; run(() => addComment(editionId, body), () => setBody("")); }}>
      <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Écrire un message à l'équipe projet…" className="h-9" data-testid="comment-input" />
      <Button type="submit" disabled={pending || !body.trim()} data-testid="comment-submit">Envoyer</Button>
    </form>
  );
}

export function AddExpenseForm({ editionId }: { editionId: string }) {
  const [label, setLabel] = useState("");
  const [spent, setSpent] = useState("");
  const [ref, setRef] = useState("");
  const { pending, run } = useRun();
  return (
    <Reveal label="Dépense" testId="add-expense-open">
      <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (!label.trim() || !ref.trim()) return; run(() => addExpense(editionId, label, Number(spent.replace(",", ".")) || 0, ref), () => { setLabel(""); setSpent(""); setRef(""); }); }}>
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Objet (dépense sans devis)" className="h-7 w-48 text-xs" data-testid="add-expense-label" />
        <Input type="number" step="any" value={spent} onChange={(e) => setSpent(e.target.value)} placeholder="Réalisé €" className="h-7 w-28 text-xs" data-testid="add-expense-spent" />
        <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Référence (n° facture)" className="h-7 w-44 text-xs" data-testid="add-expense-ref" />
        <Button type="submit" size="xs" variant="outline" disabled={pending || !label.trim() || !ref.trim()} data-testid="add-expense-submit"><Plus />Enregistrer</Button>
      </form>
    </Reveal>
  );
}

