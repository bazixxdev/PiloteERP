"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Archive, ArchiveRestore, FilePlus2, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addCall, promoteCall, renewCall, setCallActive, setCallStatus } from "@/app/actions/calls";
import { CALL_STATUSES } from "@/lib/calls";
import { AMOUNT_KINDS } from "@/lib/dossiers";
import { SearchableSelect, Select } from "@/components/common/searchable-select";
import { V, cap, le } from "@/lib/vocab";

type Opt = { value: string; label: string };
type R = { ok: true } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error); return; } after?.(); router.refresh(); });
  return { pending, run };
}

// Nouvel appel repéré : financeur, intitulé, programme, échéance (ou fil de l'eau), montant visé, projet, lien, description. Le reste
// se complète en place, dans le panneau de l'appel (19/09).
export function AddCallDialog({ funders, defaultFunderId, projects = [] }: { funders: Opt[]; defaultFunderId?: string; projects?: Opt[] }) {
  const [open, setOpen] = useState(false);
  const [funderId, setFunderId] = useState(defaultFunderId ?? funders[0]?.value ?? "");
  const [funderName, setFunderName] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [amountKind, setAmountKind] = useState("total");
  const [years, setYears] = useState("1");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [label, setLabel] = useState("");
  const [scheme, setScheme] = useState("");
  const [deadline, setDeadline] = useState("");
  const [rolling, setRolling] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="call-add-open"><Plus />Nouvel appel</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); start(async () => {
          const r = await addCall({ funderId, funderName, label, scheme, deadline: deadline || null, rolling, recurring, description, amountValue: amountValue || null, amountKind, durationYears: years || null, targetProjectId: targetProjectId || null, link });
          if (!r.ok) { toast.error(r.error); return; }
          toast.success("Appel à projets repéré"); setOpen(false); setLabel(""); setScheme(""); setDeadline(""); setDescription(""); setLink(""); setFunderName(""); setAmountValue(""); setTargetProjectId(""); router.refresh();
        }); }}>
          <DialogHeader><DialogTitle>Nouvel appel à projets</DialogTitle><DialogDescription>{`Une opportunité repérée, avant toute décision. ${cap(le(V.codir))} dira ensuite « à étudier », « on dépose » ou « écarté ».`}</DialogDescription></DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="grid gap-1"><Label htmlFor="call-funder">Financeur</Label><SearchableSelect id="call-funder" options={funders} value={funderId} onChange={setFunderId} emptyOption="— nouveau financeur, ci-dessous —" data-testid="call-funder" className="w-full" />{!funderId && <Input value={funderName} onChange={(e) => setFunderName(e.target.value)} placeholder="Nom du nouveau financeur (créé dans l'annuaire)" className="h-8 text-xs" data-testid="call-funder-name" />}</div>
            <div className="grid gap-1"><Label htmlFor="call-label">Intitulé</Label><Input id="call-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="AAP Transition écologique 2027" required data-testid="call-label" /></div>
            <div className="grid gap-1"><Label htmlFor="call-scheme">Programme du financeur (dispositif, axe) — facultatif</Label><Input id="call-scheme" value={scheme} onChange={(e) => setScheme(e.target.value)} placeholder="FSE+ axe inclusion, Axe 2 · économie circulaire…" data-testid="call-scheme" /><p className="text-[11px] text-muted-foreground">Le cadre dans lequel l&apos;appel s&apos;inscrit chez le financeur : sert à retrouver les appels d&apos;un même programme d&apos;une année sur l&apos;autre, et pré-remplit le dossier.</p></div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <div className="grid gap-1"><Label htmlFor="call-deadline">Date limite de dépôt</Label><Input id="call-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={rolling} data-testid="call-deadline" /></div>
              <label className="flex h-8 items-center gap-1.5 text-xs"><input type="checkbox" checked={rolling} onChange={(e) => setRolling(e.target.checked)} className="accent-primary" data-testid="call-rolling" /> au fil de l&apos;eau</label>
            </div>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="accent-primary" /> revient chaque année</label>
            <div className="grid grid-cols-[7rem_1fr_5rem] gap-2">
              <div className="grid gap-1"><Label htmlFor="call-amount-value">Montant visé (€)</Label><Input id="call-amount-value" inputMode="decimal" value={amountValue} onChange={(e) => setAmountValue(e.target.value)} className="text-right" data-testid="call-amount-value" /></div>
              <div className="grid gap-1"><Label htmlFor="call-amount-kind">Ce montant est</Label><Select id="call-amount-kind" value={amountKind} onChange={(e) => setAmountKind(e.target.value)} className="h-9 text-sm" data-testid="call-amount-kind">{AMOUNT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select></div>
              <div className="grid gap-1"><Label htmlFor="call-years">Durée (ans)</Label><Input id="call-years" type="number" min={1} max={10} value={years} onChange={(e) => setYears(e.target.value)} data-testid="call-years" /></div>
            </div>
            <div className="grid gap-1"><Label htmlFor="call-project">Projet visé (facultatif)</Label><SearchableSelect id="call-project" options={projects} value={targetProjectId} onChange={setTargetProjectId} emptyOption="— à préciser —" searchFrom={1} className="w-full" data-testid="call-project" /></div>
            <div className="grid gap-1"><Label htmlFor="call-link">Lien vers l&apos;appel (facultatif)</Label><Input id="call-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></div>
            <div className="grid gap-1"><Label htmlFor="call-description">Description (facultatif)</Label><textarea id="call-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Ce qui est financé, les conditions, ce qu'on en pense… (repris dans le dossier à l'ouverture)" className="rounded-md border bg-card px-2.5 py-1.5 text-sm" data-testid="call-description" /></div>
          </div>
          <DialogFooter><Button type="submit" disabled={pending || !label.trim() || (!funderId && !funderName.trim())} data-testid="call-submit">Repérer</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Statut d'équipe (CODIR) : un sélecteur, en place ; « — » remet à zéro.
export function CallStatusSelect({ id, value, readOnly }: { id: string; value: string | null; readOnly: boolean }) {
  const { pending, run } = useRun();
  const [v, setV] = useState(value ?? "");
  const current = CALL_STATUSES.find((s) => s.value === v);
  const tone = current?.color === "mint" ? "border-mint/50 bg-mint-soft text-mint" : current?.color === "warning" ? "border-warning/50 bg-warning-soft text-warning-foreground" : current ? "bg-muted text-muted-foreground" : "bg-card";
  if (readOnly) return <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${tone}`}>{current?.label ?? "Pas encore regardé"}</span>;
  return (
    <Select className={`h-7 rounded-md border px-1.5 text-xs font-medium ${tone}`} value={v} disabled={pending} aria-label="Statut d'équipe" data-testid={`call-status-${id}`}
      onChange={(e) => { const next = e.target.value; setV(next); run(() => setCallStatus(id, next || null), () => toast.success(next ? `Statut posé : ${CALL_STATUSES.find((s) => s.value === next)?.label}` : "Statut retiré")); }}>
      <option value="">Pas encore regardé</option>
      {CALL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </Select>
  );
}

// Actions par ligne : Ouvrir un dossier (→ dossier de financement à étudier), Reconduire (annuel, clôturé), Retirer / Remettre.
export function CallRowActions({ id, label, canPromote, canSpot, promoted, recurringClosed, active }: { id: string; label: string; canPromote: boolean; canSpot: boolean; promoted: boolean; recurringClosed: boolean; active: boolean }) {
  const { pending, run } = useRun();
  const router = useRouter();
  const [pendingP, startP] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {canPromote && !promoted && active && (
        <Button size="xs" variant="outline" disabled={pendingP} data-testid={`call-promote-${id}`} title="Ouvrir le dossier de financement (à étudier), prérempli depuis cet appel"
          onClick={() => startP(async () => { const r = await promoteCall(id); if (!r.ok) { toast.error(r.error); return; } toast.success(r.data?.existed ? "Ce dossier existe déjà" : "Dossier ouvert, à étudier"); router.push(`/conventions/${r.data!.conventionId}`); })}>
          <FilePlus2 />Ouvrir un dossier
        </Button>
      )}
      {canSpot && recurringClosed && <Button size="xs" variant="ghost" disabled={pending} data-testid={`call-renew-${id}`} title="Créer l'appel de l'année suivante" onClick={() => run(() => renewCall(id), () => toast.success("Appel de l'année suivante créé"))}><RotateCw />Reconduire</Button>}
      {canSpot && (active
        ? <Button size="xs" variant="ghost" disabled={pending} title={`Retirer « ${label} » de la liste (il reste en base)`} aria-label={`Retirer ${label}`} data-testid={`call-archive-${id}`} onClick={() => run(() => setCallActive(id, false), () => toast.success("Appel retiré de la liste"))}><Archive /></Button>
        : <Button size="xs" variant="ghost" disabled={pending} title="Remettre dans la liste" aria-label={`Remettre ${label}`} data-testid={`call-restore-${id}`} onClick={() => run(() => setCallActive(id, true), () => toast.success("Appel remis dans la liste"))}><ArchiveRestore /></Button>)}
    </div>
  );
}

const Filter = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="inline-flex items-center gap-1.5 rounded-[5px] border bg-card px-2 py-1 text-[11px]">{label}{children}</label>
);

export function CallFilters({ funders, current }: { funders: Opt[]; current: { financeur: string; statut: string; vue: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const set = (key: string, value: string) => {
    const next = { ...current, [key]: value };
    const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  const sel = "max-w-[175px] h-5 gap-1 border-0 bg-transparent px-0 text-[11px] focus:outline-none focus-visible:ring-0";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="call-filters">
      <Filter label="Financeur">
        <Select className={sel} value={current.financeur} onChange={(e) => set("financeur", e.target.value)} aria-label="Filtrer par financeur">
          <option value="">Tous les financeurs</option>
          {funders.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </Select>
      </Filter>
      <Filter label="Statut d'équipe">
        <Select className={sel} value={current.statut} onChange={(e) => set("statut", e.target.value)} aria-label="Filtrer par statut d'équipe">
          <option value="">Tous</option>
          <option value="none">Pas encore regardés</option>
          {CALL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
      </Filter>
      <Filter label="Vue">
        <Select className={sel} value={current.vue} onChange={(e) => set("vue", e.target.value)} aria-label="Vue">
          <option value="">Actifs (écartés masqués)</option>
          <option value="tous">Tous, écartés et retirés compris</option>
        </Select>
      </Filter>
    </div>
  );
}
