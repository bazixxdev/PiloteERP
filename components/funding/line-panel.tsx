import Link from "next/link";
import { AutoField } from "@/components/inline/auto-field";
import { StatusBadge } from "@/components/common/status-badge";
import { Reveal } from "@/components/common/reveal";
import { REF_DEFAULTS, refColor, refLabel, type RefMap } from "@/lib/refs";
import { fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddDeliverableForm } from "@/app/edition/[id]/add-forms";
import { allocationOf, conventionCovers } from "@/lib/conventions";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { UploadForm } from "@/components/attachments/upload-form";
import { PaymentsList } from "@/components/funding/payments-list";
import { paymentSummary } from "@/lib/payments";
import type { EditionFull } from "@/lib/queries";
import type { TabCtx } from "@/app/edition/[id]/types";

// Le corps du panneau d'une ligne de financement : partagé par l'onglet Budget de l'édition et par la matrice « Qui finance
// quoi » (qui l'ouvre sans quitter le tableau). `highlight` = le champ d'où l'on vient, surligné et focalisé — pratique à
// généraliser : on arrive d'un chiffre, on retrouve ce chiffre.
export type FundingLinePanelProps = {
  e: EditionFull;
  f: EditionFull["fundingLines"][number];
  i: number;
  rw: boolean;
  isPilot: boolean;
  refs: RefMap;
  funders: TabCtx["funders"];
  conventions: TabCtx["conventions"];
  highlight?: string | null;
};

export function FundingLinePanelBody({ e, f, i, rw, isPilot, refs, funders, conventions, highlight }: FundingLinePanelProps) {
  const statusOpts = REF_DEFAULTS.funding_status.map((s) => ({ value: s.code, label: refLabel(refs, "funding_status", s.code) }));
  const funderOpts = funders.map((x) => ({ value: x.id, label: x.name }));
  const kinds = REF_DEFAULTS.attachment_kind.map((k) => ({ value: k.code, label: refLabel(refs, "attachment_kind", k.code) }));
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Financeur"><AutoField model="fundingLine" id={f.id} field="funderId" type="select" value={f.funderId} options={funderOpts} readOnly={!rw} allowEmpty={false} inputClassName="font-semibold" label={`Financeur, ligne ${i + 1}`} /></Field>
        <Field label="Dispositif"><AutoField model="fundingLine" id={f.id} field="scheme" type="text" value={f.scheme} readOnly={!rw} placeholder="Convention, appel à projets…" /></Field>
        <Field label="Statut">{rw ? <AutoField model="fundingLine" id={f.id} field="status" type="select" value={f.status} options={statusOpts} allowEmpty={false} testId={`funding-status-${i}`} highlight={highlight === "status"} /> : <div className="py-1"><StatusBadge label={refLabel(refs, "funding_status", f.status)} color={refColor(refs, "funding_status", f.status)} /></div>}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Demandé"><AutoField model="fundingLine" id={f.id} field="amountRequested" type="number" value={f.amountRequested} readOnly={!rw} suffix="€" label={`Montant demandé, ${f.funder.name}`} placeholder="—" highlight={highlight === "amountRequested"} /></Field>
          <Field label="Obtenu"><AutoField model="fundingLine" id={f.id} field="amountGranted" type="number" value={f.amountGranted} readOnly={!rw} suffix="€" label={`Montant obtenu, ${f.funder.name}`} placeholder="—" highlight={highlight === "amountGranted"} /></Field>
        </div>
      </div>
      <details className="group rounded-lg border border-dashed px-2 py-1.5" open>
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-muted-foreground">Détail de gestion <span className="font-normal">· dépôt, réponse, convention, code analytique, clé de répartition · <span className="text-primary group-open:hidden">afficher</span><span className="hidden text-primary group-open:inline">replier</span></span></summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Field label="Dépôt"><AutoField model="fundingLine" id={f.id} field="submittedAt" type="date" value={f.submittedAt} readOnly={!rw} /></Field>
          <Field label="Réponse"><AutoField model="fundingLine" id={f.id} field="answeredAt" type="date" value={f.answeredAt} readOnly={!rw} /></Field>
          <Field label="Convention signée le"><AutoField model="fundingLine" id={f.id} field="contractedAt" type="date" value={f.contractedAt} readOnly={!rw} /></Field>
          <Field label="Code analytique"><AutoField model="fundingLine" id={f.id} field="analyticCode" type="text" value={f.analyticCode} readOnly={!rw} /></Field>
          <Field label="Clé de répartition (référence)"><AutoField model="fundingLine" id={f.id} field="allocationKeyRef" type="text" value={f.allocationKeyRef} readOnly={!rw} placeholder="Onglet de l'Excel RAF" /></Field>
          <Field label="Pluriannuel"><div className="py-1"><AutoField model="fundingLine" id={f.id} field="multiYear" type="bool" value={f.multiYear} readOnly={!rw} placeholder="oui" /></div></Field>
        </div>
        <div className="mt-2"><Field label="Contact du dossier (sinon le contact principal du financeur)"><AutoField model="fundingLine" id={f.id} field="contactId" type="select" value={f.contactId} readOnly={!rw} placeholder="— contact principal —" options={f.funder.contacts.map((c) => ({ value: c.id, label: `${[c.firstName, c.lastName].filter(Boolean).join(" ")}${c.role ? ` · ${c.role}` : ""}` }))} label={`Contact du dossier, ${f.funder.name}`} /></Field></div>
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-secondary/40 px-2 py-1.5 text-xs" data-testid={`convention-of-${i}`}>
          <span className="font-semibold text-primary">Convention</span>
          <div className="w-72"><AutoField model="fundingLine" id={f.id} field="conventionId" type="select" value={f.conventionId} readOnly={!rw} placeholder="Financement annuel (sans convention)" refreshOnSave
            options={conventions.filter((c) => c.funderId === f.funderId && conventionCovers(c, e.year)).map((c) => ({ value: c.id, label: `${c.reference} (${c.startYear}-${c.endYear})` }))} /></div>
          {f.convention && (() => { const a = allocationOf(f.convention); return (
            <span className="text-muted-foreground">
              {f.convention.startYear}-{f.convention.endYear} · notifié {fmtEuro(f.convention.amountNotified)} · affecté {fmtEuro(a.granted)} sur {f.convention.lines.length} édition{f.convention.lines.length > 1 ? "s" : ""}
              {a.remaining !== null && <> · <span className={cn(a.remaining < 0 ? "text-danger font-medium" : "text-mint")}>{a.remaining < 0 ? `dépassement ${fmtEuro(-a.remaining)}` : `reste à affecter ${fmtEuro(a.remaining)}`}</span></>}
              {" · "}<Link href="/conventions" className="text-primary hover:underline">toutes les conventions</Link>
            </span>
          ); })()}
        </div>
        <div className="mt-2"><AutoField model="fundingLine" id={f.id} field="notes" type="textarea" rows={1} value={f.notes} readOnly={!rw} placeholder="Notes, justificatifs à conserver, lieu de stockage…" /></div>
      </details>
      <div className="rounded-lg border p-2" data-testid={`funding-payments-${i}`}>
        <div className="mb-1 text-[10px] font-semibold text-muted-foreground">Versements (attendus, reçus) · posés par la RAF ou la direction</div>
        {f.convention && f.payments.length === 0 && f.convention.payments.length > 0
          ? <p className="text-xs text-muted-foreground">Cette ligne est versée par tranches sur la convention <Link href={`/conventions/${f.convention.id}`} className="text-primary hover:underline">{f.convention.reference}</Link> ({fmtEuro(paymentSummary(f.convention.amountNotified, f.convention.payments).received)} reçus sur {fmtEuro(f.convention.amountNotified)}). Ajoutez un versement ici seulement s'il est propre à cette édition.</p>
          : null}
        <PaymentsList payments={f.payments} reference={f.amountGranted} rw={rw} target={{ fundingLineId: f.id }} compact testId={`payments-line-${i}`} />
      </div>
      <div className="rounded-lg bg-muted/50 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground">Pièces (convention, notification, bilan remis)</span>
          {(rw || isPilot) && <Reveal label="Pièce" size="xs" testId={`upload-open-${i}`}><UploadForm editionId={e.id} kinds={kinds} defaultKind="contract" fundingLineId={f.id} compact /></Reveal>}
        </div>
        <AttachmentList items={e.attachments.filter((a) => a.fundingLineId === f.id)} refs={refs} compact />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{f.deliverables.length === 0 ? "Aucun livrable renseigné." : `${f.deliverables.filter((d) => !d.done).length} livrable${f.deliverables.filter((d) => !d.done).length > 1 ? "s" : ""} à remettre · ${f.deliverables.filter((d) => d.done).length} remis — la liste complète est sous le tableau.`}</span>
        {rw && <AddDeliverableForm fundingLineId={f.id} />}
      </div>
    </>
  );
}

export function fundingPanelTitle(e: { project: { name: string }; year: number }, f: { funder: { name: string } }) {
  return `${f.funder.name} · ${e.project.name} ${e.year}`;
}

export const FUNDING_PANEL_DESCRIPTION = { rw: "Ligne tenue par la RAF : montants, dates, convention, contact, pièces, livrables.", ro: "Lecture seule : ligne tenue par la RAF." };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
