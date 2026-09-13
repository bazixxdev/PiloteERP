import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { canEditFunding } from "@/lib/rights";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { AddDeliverableForm, AddFundingLineForm, AttachConventionForm } from "./add-forms";
import { allocationOf, conventionCovers } from "@/lib/conventions";
import Link from "next/link";
import { DeliverableDone } from "./deliverable-done";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { UploadForm } from "@/components/attachments/upload-form";

export function FinancementsTab({ e, me, refs, funders, conventions, settings, isPilot }: TabCtx) {
  const covering = conventions.filter((c) => conventionCovers(c, e.year));
  const rw = canEditFunding(me.role);
  const statusOpts = REF_DEFAULTS.funding_status.map((s) => ({ value: s.code, label: refLabel(refs, "funding_status", s.code) }));
  const funderOpts = funders.map((f) => ({ value: f.id, label: f.name }));
  const kinds = REF_DEFAULTS.attachment_kind.map((k) => ({ value: k.code, label: refLabel(refs, "attachment_kind", k.code) }));
  const reminderDays = settings.reminderDaysBefore.split(",").map(Number);
  const totalRequested = e.fundingLines.reduce((s, f) => s + (f.amountRequested ?? 0), 0);
  const totalGranted = e.fundingLines.reduce((s, f) => s + (f.amountGranted ?? 0), 0);

  const upcoming = e.fundingLines
    .flatMap((f) => f.deliverables.filter((d) => !d.done).map((d) => ({ ...d, funder: f.funder.name })))
    .map((d) => ({ ...d, n: daysFromNow(d.dueDate) }))
    .filter((d) => d.n <= settings.horizonDays)
    .sort((a, b) => a.n - b.n);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        <Section
          title="Lignes de financement"
          description={<span>Remplies par la RAF · {fmtEuro(totalGranted)} obtenus sur {fmtEuro(totalRequested)} demandés{e.fundingLines.length === 1 && <strong className="text-warning"> · projet mono-financeur</strong>}</span>}
          actions={rw ? <div className="flex flex-wrap gap-2"><AttachConventionForm editionId={e.id} conventions={covering.filter((c) => !c.lines.some((l) => l.editionId === e.id)).map((c) => ({ id: c.id, label: `${funders.find((f) => f.id === c.funderId)?.name ?? ""} · ${c.reference} (${c.startYear}-${c.endYear})` }))} /><AddFundingLineForm editionId={e.id} funders={funders} /></div> : undefined}
        >
          {e.fundingLines.length === 0 ? (
            <EmptyState title="Aucune ligne de financement" hint="La RAF ajoute ici chaque financeur avec son dispositif, ses montants et ses livrables dus." />
          ) : (
            <div className="grid gap-4">
              {e.fundingLines.map((f, i) => (
                <div key={f.id} className="rounded-xl border p-3" data-testid={`funding-line-${i}`}>
                  <div className="grid gap-2 md:grid-cols-[1.2fr_1.5fr_1fr_1fr_1fr]">
                    <Field label="Financeur"><AutoField model="fundingLine" id={f.id} field="funderId" type="select" value={f.funderId} options={funderOpts} readOnly={!rw} allowEmpty={false} inputClassName="font-semibold" /></Field>
                    <Field label="Dispositif"><AutoField model="fundingLine" id={f.id} field="scheme" type="text" value={f.scheme} readOnly={!rw} placeholder="Convention, appel à projets…" /></Field>
                    <Field label="Statut">
                      {rw ? <AutoField model="fundingLine" id={f.id} field="status" type="select" value={f.status} options={statusOpts} allowEmpty={false} testId={`funding-status-${i}`} /> : <div className="py-1"><StatusBadge label={refLabel(refs, "funding_status", f.status)} color={refColor(refs, "funding_status", f.status)} /></div>}
                    </Field>
                    <Field label="Demandé"><AutoField model="fundingLine" id={f.id} field="amountRequested" type="number" value={f.amountRequested} readOnly={!rw} suffix="€" /></Field>
                    <Field label="Obtenu"><AutoField model="fundingLine" id={f.id} field="amountGranted" type="number" value={f.amountGranted} readOnly={!rw} suffix="€" /></Field>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
                    <Field label="Dépôt"><AutoField model="fundingLine" id={f.id} field="submittedAt" type="date" value={f.submittedAt} readOnly={!rw} /></Field>
                    <Field label="Réponse"><AutoField model="fundingLine" id={f.id} field="answeredAt" type="date" value={f.answeredAt} readOnly={!rw} /></Field>
                    <Field label="Convention"><AutoField model="fundingLine" id={f.id} field="contractedAt" type="date" value={f.contractedAt} readOnly={!rw} /></Field>
                    <Field label="Code analytique"><AutoField model="fundingLine" id={f.id} field="analyticCode" type="text" value={f.analyticCode} readOnly={!rw} /></Field>
                    <Field label="Clé de répartition (référence)"><AutoField model="fundingLine" id={f.id} field="allocationKeyRef" type="text" value={f.allocationKeyRef} readOnly={!rw} placeholder="Onglet de l'Excel RAF" /></Field>
                    <Field label="Pluriannuel"><div className="py-1"><AutoField model="fundingLine" id={f.id} field="multiYear" type="bool" value={f.multiYear} readOnly={!rw} placeholder="oui" /></div></Field>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-secondary/40 px-2 py-1.5 text-xs" data-testid={`convention-of-${i}`}>
                    <span className="font-semibold text-primary">Convention</span>
                    <div className="w-64"><AutoField model="fundingLine" id={f.id} field="conventionId" type="select" value={f.conventionId} readOnly={!rw} placeholder="— financement annuel propre à l'édition —" refreshOnSave
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

                  <div className="mt-3 rounded-lg bg-muted/50 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground">Pièces (convention, notification, bilan remis)</span>
                      {(rw || isPilot) && <UploadForm editionId={e.id} kinds={kinds} defaultKind="contract" fundingLineId={f.id} compact />}
                    </div>
                    <AttachmentList items={e.attachments.filter((a) => a.fundingLineId === f.id)} refs={refs} compact />
                  </div>

                  <div className="mt-3 rounded-lg bg-muted/50 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground">Livrables dus</span>
                      {rw && <AddDeliverableForm fundingLineId={f.id} />}
                    </div>
                    {f.deliverables.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun livrable renseigné.</p>
                    ) : (
                      <ul className="divide-y">
                        {f.deliverables.map((d) => {
                          const n = daysFromNow(d.dueDate);
                          return (
                            <li key={d.id} className="flex items-center gap-2 py-1 text-sm">
                              <DeliverableDone id={d.id} done={d.done} readOnly={!rw && !isPilot} />
                              <div className="flex-1"><AutoField model="deliverable" id={d.id} field="label" type="text" value={d.label} readOnly={!rw} inputClassName={cn(d.done && "line-through text-muted-foreground")} /></div>
                              <div className="w-36"><AutoField model="deliverable" id={d.id} field="dueDate" type="date" value={d.dueDate} readOnly={!rw} /></div>
                              <span className={cn("w-28 text-right text-xs", d.done ? "text-mint" : n < 0 ? "text-danger" : n <= settings.deliverableAlertDays ? "text-warning-foreground" : "text-muted-foreground")}>
                                {d.done ? `remis ${fmtDate(d.doneAt)}` : n < 0 ? `${-n} j de retard` : n === 0 ? "aujourd'hui" : `dans ${n} j`}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Rappels" description={`J-${reminderDays.join(" et J-")} · horizon ${settings.horizonDays} jours`}>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune échéance financeur dans l'horizon.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((d) => {
              const fire = d.n < 0 || reminderDays.some((r) => d.n <= r);
              return (
                <li key={d.id} className={cn("rounded-lg border p-2 text-sm", fire ? (d.n < 0 ? "border-danger/40 bg-danger-soft/50" : "border-warning/50 bg-warning-soft/60") : "bg-card")}>
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs text-muted-foreground">{d.funder} · {fmtDate(d.dueDate)} · {d.n < 0 ? `${-d.n} j de retard` : `J-${d.n}`}</div>
                  {fire && <div className="mt-1 text-xs">Rappel au pilote et à la RAF</div>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
