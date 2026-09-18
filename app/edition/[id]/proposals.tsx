"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, GitPullRequestArrow, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { decideChange, proposeChange } from "@/app/actions/proposals";
import { cn } from "@/lib/utils";
import { Select } from "@/components/common/searchable-select";
import { V, cap, le, du, au } from "@/lib/vocab";

export type ProposalView = { id: string; field: string; fieldLabel: string; proposed: string; reason: string; author: string; authorId: string; createdAt: string; status: string; decidedBy: string | null; decidedAt: string | null; comment: string | null };
export type ProposableField = { key: string; label: string; current: string; multiline: boolean; group?: string };

// « Proposer une modification » sur une fiche verrouillée : la rubrique, la nouvelle valeur, et surtout pourquoi.
export function ProposeChangeDialog({ editionId, fields, layerTitle, compact }: { editionId: string; fields: ProposableField[]; layerTitle: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState(fields[0]?.key ?? "");
  const [proposed, setProposed] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const current = fields.find((f) => f.key === field);
  if (fields.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && current) setProposed(current.current); }}>
      <DialogTrigger asChild><Button size="xs" variant="outline" data-testid={`propose-${compact ? "compact" : "layer"}`}><GitPullRequestArrow />Proposer une modification</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Proposer une modification · {layerTitle}</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await proposeChange(editionId, field, proposed, reason); if (!r.ok) toast.error(r.error); else { toast.success(`Proposition envoyée ${au(V.pilote)}, au garant et ${au(V.direction)}`); setOpen(false); setReason(""); router.refresh(); } }); }}>
          <p className="text-xs text-muted-foreground">{`La fiche est validée : rien n'y change en silence. ${cap(le(V.pilote))} (ou ${le(V.direction)}) accepte, et l'historique garde qui a changé quoi, et pourquoi.`}</p>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Rubrique</span>
            <Select value={field} onChange={(e) => { setField(e.target.value); setProposed(fields.find((f) => f.key === e.target.value)?.current ?? ""); }} className="h-9 rounded-md border bg-card px-2 text-sm" data-testid="propose-field">
              {/* Un seul bouton pour toute la fiche (revue du 15/09) : les rubriques se choisissent par couche. */}
              {[...new Set(fields.map((f) => f.group ?? ""))].map((g) => g
                ? <optgroup key={g} label={g}>{fields.filter((f) => f.group === g).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>
                : fields.filter((f) => !f.group).map((f) => <option key={f.key} value={f.key}>{f.label}</option>))}
            </Select>
          </label>
          {current && <div className="rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground"><b>Aujourd'hui :</b> {current.current || "— vide —"}</div>}
          <label className="grid gap-1 text-xs"><span className="font-semibold">Nouvelle valeur</span>
            <textarea value={proposed} onChange={(e) => setProposed(e.target.value)} rows={current?.multiline ? 5 : 2} className="rounded-md border bg-card p-2 text-sm" data-testid="propose-value" />
          </label>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Pourquoi ? <span className="font-normal text-muted-foreground">(financeur, stratégie, faisabilité…)</span></span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required className="rounded-md border bg-card p-2 text-sm" placeholder="Ex. : le financeur demande 20 orientations, pas 30." data-testid="propose-reason" />
          </label>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={pending || !reason.trim()} data-testid="propose-submit">Envoyer la proposition</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Propositions en attente et décidées : le pilote ou la direction accepte (la valeur s'applique) ou refuse (avec un mot).
export function ProposalsPanel({ proposals, canDecide, meId, isDirector }: { proposals: ProposalView[]; canDecide: boolean; meId: string; isDirector: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [comment, setComment] = useState<Record<string, string>>({});
  const open = proposals.filter((p) => p.status === "pending");
  const done = proposals.filter((p) => p.status !== "pending");
  if (proposals.length === 0) return null;
  const decide = (id: string, d: "accepted" | "refused") => start(async () => { const r = await decideChange(id, d, comment[id] ?? ""); if (!r.ok) toast.error(r.error); else { toast.success(d === "accepted" ? "Modification appliquée et tracée" : "Proposition refusée"); router.refresh(); } });
  return (
    <div className="rounded-md border border-l-4 border-l-primary bg-card px-4 py-3" data-testid="proposals">
      <div className="mb-2 text-sm font-semibold">{open.length ? `${open.length} modification${open.length > 1 ? "s" : ""} proposée${open.length > 1 ? "s" : ""}` : "Modifications proposées"} <span className="text-xs font-normal text-muted-foreground">· sur cette fiche validée</span></div>
      <ul className="grid gap-2">
        {open.map((p) => (
          <li key={p.id} className="rounded-md bg-info-soft/60 px-3 py-2 text-xs" data-testid={`proposal-${p.id}`}>
            <div><b>{p.fieldLabel}</b> · proposé par {p.author} · {p.createdAt}</div>
            <p className="mt-1 whitespace-pre-line rounded bg-card px-2 py-1">{p.proposed || "— vider la rubrique —"}</p>
            <p className="mt-1 text-muted-foreground"><b>Pourquoi :</b> {p.reason}</p>
            {canDecide && (p.authorId !== meId || isDirector) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input value={comment[p.id] ?? ""} onChange={(e) => setComment((c) => ({ ...c, [p.id]: e.target.value }))} placeholder="Un mot (facultatif)" aria-label="Commentaire de décision" className="h-7 min-w-[200px] flex-1 rounded-md border bg-card px-2 text-xs" />
                <Button size="xs" disabled={pending} onClick={() => decide(p.id, "accepted")} data-testid={`proposal-accept-${p.id}`}><Check />Accepter et appliquer</Button>
                <Button size="xs" variant="outline" disabled={pending} onClick={() => decide(p.id, "refused")} data-testid={`proposal-refuse-${p.id}`}><X />Refuser</Button>
              </div>
            )}
            {!canDecide && <p className="mt-1 text-[10px] text-muted-foreground">{`En attente ${du(V.pilote)} ou ${du(V.direction)}.`}</p>}
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <details className="group mt-2 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer list-none">{done.length} proposition{done.length > 1 ? "s" : ""} décidée{done.length > 1 ? "s" : ""} <span className="text-primary group-open:hidden">afficher</span><span className="hidden text-primary group-open:inline">masquer</span></summary>
          <ul className="mt-1 grid gap-1">
            {done.map((p) => <li key={p.id} className={cn("rounded px-2 py-1", p.status === "accepted" ? "bg-mint-soft" : "bg-muted")}><b>{p.fieldLabel}</b> · {p.author} · {p.status === "accepted" ? "acceptée" : "refusée"} par {p.decidedBy ?? "—"} le {p.decidedAt}{p.comment ? ` — ${p.comment}` : ""}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
