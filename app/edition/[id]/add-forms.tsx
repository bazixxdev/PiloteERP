"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAction, addDeliverable, addDocLink, addFundingLine, addIndicator, addComment, addExpense } from "@/app/actions/edition";

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
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; run(() => addAction(editionId, name), () => setName("")); }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle action… (Entrée pour ajouter)" className="h-8 max-w-sm" data-testid="add-action-input" />
      <Button type="submit" size="sm" variant="outline" disabled={pending || !name.trim()} data-testid="add-action-submit"><Plus />Ajouter</Button>
    </form>
  );
}

export function AddFundingLineForm({ editionId, funders }: { editionId: string; funders: { id: string; name: string }[] }) {
  const [funderId, setFunderId] = useState(funders[0]?.id ?? "");
  const { pending, run } = useRun();
  return (
    <div className="flex gap-2">
      <select className="h-8 rounded-lg border bg-card px-2 text-sm" value={funderId} onChange={(e) => setFunderId(e.target.value)} data-testid="add-funding-funder">
        {funders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <Button size="sm" variant="outline" disabled={pending || !funderId} onClick={() => run(() => addFundingLine(editionId, funderId))} data-testid="add-funding-submit"><Plus />Ajouter une ligne</Button>
    </div>
  );
}

export function AddDeliverableForm({ fundingLineId }: { fundingLineId: string }) {
  const [label, setLabel] = useState("");
  const [due, setDue] = useState("");
  const { pending, run } = useRun();
  return (
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!label.trim() || !due) return; run(() => addDeliverable(fundingLineId, label, due), () => { setLabel(""); setDue(""); }); }}>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Livrable dû (bilan qualitatif, justificatifs…)" className="h-7 w-64 text-xs" data-testid="add-deliverable-label" />
      <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-36 text-xs" data-testid="add-deliverable-date" />
      <Button type="submit" size="xs" variant="outline" disabled={pending || !label.trim() || !due} data-testid="add-deliverable-submit"><Plus />Livrable</Button>
    </form>
  );
}

export function AddIndicatorForm({ editionId }: { editionId: string }) {
  const [label, setLabel] = useState("");
  const [imposed, setImposed] = useState(false);
  const { pending, run } = useRun();
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; run(() => addIndicator(editionId, label, imposed), () => setLabel("")); }}>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nouvel indicateur…" className="h-8 w-64" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={imposed} onChange={(e) => setImposed(e.target.checked)} className="accent-primary" /> imposé par un financeur</label>
      <Button type="submit" size="sm" variant="outline" disabled={pending || !label.trim()}><Plus />Ajouter</Button>
    </form>
  );
}

export function AddDocLinkForm({ editionId, canCodir }: { editionId: string; canCodir: boolean }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [codir, setCodir] = useState(false);
  const { pending, run } = useRun();
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!label.trim() || !url.trim()) return; run(() => addDocLink(editionId, label, url, codir), () => { setLabel(""); setUrl(""); setCodir(false); }); }}>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé" className="h-8 w-48" />
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="\\serveur\Partage\… ou https://teams…" className="h-8 w-72" />
      {canCodir && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={codir} onChange={(e) => setCodir(e.target.checked)} className="accent-primary" /> CODIR seulement</label>}
      <Button type="submit" size="sm" variant="outline" disabled={pending || !label.trim() || !url.trim()}><Plus />Ajouter</Button>
    </form>
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
    <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (!label.trim() || !ref.trim()) return; run(() => addExpense(editionId, label, Number(spent.replace(",", ".")) || 0, ref), () => { setLabel(""); setSpent(""); setRef(""); }); }}>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Dépense sans devis" className="h-8 w-44" />
      <Input type="number" step="any" value={spent} onChange={(e) => setSpent(e.target.value)} placeholder="Réalisé €" className="h-8 w-28" />
      <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Référence (obligatoire)" className="h-8 w-44" />
      <Button type="submit" size="sm" variant="outline" disabled={pending || !label.trim() || !ref.trim()}><Plus />Enregistrer</Button>
    </form>
  );
}
