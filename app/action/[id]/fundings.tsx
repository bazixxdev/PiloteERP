"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/common/reveal";
import { SearchableSelect, type SelectOption } from "@/components/common/searchable-select";
import { linkFunding, setFundingAmount, unlinkFunding } from "@/app/actions/actions";
import { fmtEuro, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRun } from "@/components/common/use-run";

// Une ligne liée : son financeur, son dispositif, son année, le montant affecté à l'action ; `ceiling` = l'obtenu (à défaut le
// demandé) de la ligne, `allocated` = la somme des montants de TOUTES les actions sur cette ligne, `over` = le dépassement.
export type FundingLinkView = { lineId: string; funder: string; scheme: string | null; year: number; convention: string | null; amount: number | null; ceiling: number | null; ceilingKind: "obtenu" | "demandé" | null; allocated: number; over: number | null };
export type BalanceView = { title: string; income: number; spending: number; hours: number; time: { cost: number | null; note: string | null } | null; gap: number; gapLabel: string };

// Montant saisi → nombre ≥ 0, null si vide, undefined si illisible (« 12 000,50 » accepté).
const parseAmount = (s: string): number | null | undefined => {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

// Financements de l'action (spec actions § 2) : les lignes liées, avec un montant facultatif, et l'équilibre de l'année
// affichée. Les contrôles suivent le droit de modifier l'action ; chaque commande se garde elle-même.
export function Fundings({ actionId, canEdit, links, candidates, balance }: { actionId: string; canEdit: boolean; links: FundingLinkView[]; candidates: SelectOption[]; balance: BalanceView }) {
  return (
    <div className="grid gap-4">
      {links.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="fundings-empty">Aucune ligne de financement liée.</p> : (
        <ul className="divide-y" data-testid="fundings">
          {links.map((l, i) => <LinkRow key={l.lineId} actionId={actionId} l={l} i={i} canEdit={canEdit} />)}
        </ul>
      )}
      {canEdit && (candidates.length > 0 ? <AddLink actionId={actionId} candidates={candidates} /> : links.length === 0 && <p className="text-xs text-muted-foreground">Aucune ligne de financement sur les années couvertes.</p>)}
      <Balance b={balance} />
    </div>
  );
}

function LinkRow({ actionId, l, i, canEdit }: { actionId: string; l: FundingLinkView; i: number; canEdit: boolean }) {
  const { pending, run } = useRun();
  const shown = (v: number | null) => (v === null ? "" : String(v));
  const [value, setValue] = useState(shown(l.amount));
  useEffect(() => { setValue(shown(l.amount)); }, [l.amount]);
  const commit = () => {
    const n = parseAmount(value);
    if (n === undefined) { toast.error("Montant invalide : un nombre positif, ou vide."); setValue(shown(l.amount)); return; }
    if (n === l.amount) return;
    run(() => setFundingAmount(actionId, l.lineId, n), undefined, (msg) => { toast.error(msg); setValue(shown(l.amount)); });
  };
  const where = [l.scheme, l.convention].filter(Boolean).join(" · ");
  return (
    <li className={cn("grid gap-x-3 gap-y-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]", pending && "opacity-70")} data-testid={`funding-row-${i}`} data-line={l.lineId}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <b className="font-semibold">{l.funder}</b>
          <span className="rounded-sm bg-muted px-1.5 text-[11px] tabular text-muted-foreground" data-testid={`funding-year-${i}`}>{l.year}</span>
        </div>
        {where && <div className="truncate text-xs text-muted-foreground" title={where}>{where}</div>}
        {l.ceiling !== null && (
          <div className={cn("text-[11px]", l.over !== null ? "font-medium text-warning-foreground" : "text-muted-foreground")} data-testid={`funding-share-${i}`}>
            {`Réparti ${fmtEuro(l.allocated)} sur ${fmtEuro(l.ceiling)} ${l.ceilingKind}`}{l.over !== null && ` · +${fmtEuro(l.over)} au-delà`}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 sm:justify-end">
        {canEdit ? (
          <>
            <div className="relative">
              <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
                placeholder="Montant" className="h-8 w-32 pr-6 text-right tabular" aria-label={`Montant, ${l.funder} ${l.year}`} data-testid={`funding-amount-${i}`} />
              <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
            </div>
            <Button type="button" size="xs" variant="ghost" className="text-muted-foreground hover:text-danger max-md:size-11" disabled={pending} aria-label={`Retirer le lien, ${l.funder} ${l.year}`} title="Retirer le lien" data-testid={`funding-unlink-${i}`}
              onClick={() => { if (!confirm(`Retirer le lien avec ${l.funder} ${l.year} ? Les autres années restent liées.`)) return; run(() => unlinkFunding(actionId, l.lineId), () => toast.success("Lien retiré")); }}><Trash2 /></Button>
          </>
        ) : <span className="text-sm tabular" data-testid={`funding-amount-${i}`}>{l.amount === null ? <span className="text-muted-foreground">montant non précisé</span> : fmtEuro(l.amount)}</span>}
      </div>
    </li>
  );
}

function AddLink({ actionId, candidates }: { actionId: string; candidates: SelectOption[] }) {
  const [lineId, setLineId] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = () => {
    const n = parseAmount(amount);
    if (n === undefined) { toast.error("Montant invalide : un nombre positif, ou vide."); return; }
    start(async () => {
      const r = await linkFunding(actionId, lineId, n);
      if (!r.ok) { toast.error(r.error); return; }
      const linked = r.data?.linked ?? 1;
      toast.success(linked > 1 ? `Rattachée à ${linked} lignes du dossier` : "Ligne liée");
      setLineId(""); setAmount("");
      router.refresh();
    });
  };
  return (
    <Reveal label="Lier une ligne de financement" testId="funding-add" className="justify-self-start">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <SearchableSelect options={candidates} value={lineId} onChange={setLineId} placeholder="Ligne de financement…" aria-label="Ligne de financement" data-testid="funding-add-line" className="w-72 max-w-full" />
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant (facultatif)" className="h-8 w-40" aria-label="Montant affecté" data-testid="funding-add-amount" />
        <Button type="submit" size="sm" variant="outline" disabled={pending || !lineId} data-testid="funding-add-submit"><Link2 />Lier</Button>
      </form>
    </Reveal>
  );
}

function Balance({ b }: { b: BalanceView }) {
  const tile = (label: string, value: string, testId: string, hint?: string | null, tone?: string) => (
    <div className="min-w-0 rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-base font-semibold tabular", tone)} data-testid={testId}>{value}</div>
      {hint && <div className="text-[11px] leading-snug text-muted-foreground">{hint}</div>}
    </div>
  );
  return (
    <div className="grid gap-2" data-testid="funding-balance">
      <div className="text-xs font-semibold">{b.title}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tile("Recettes", fmtEuro(b.income), "balance-income", "montants affectés")}
        {tile("Dépenses", fmtEuro(b.spending), "balance-spending", "réalisé + engagé")}
        {b.time && tile("Temps valorisé", b.time.cost === null ? `${fmtNumber(b.hours, 1)} h` : fmtEuro(b.time.cost), "balance-time", b.time.note)}
        {tile(b.gapLabel, fmtEuro(b.gap), "balance-gap", null, b.gap < 0 ? "text-danger" : "text-mint")}
      </div>
    </div>
  );
}
