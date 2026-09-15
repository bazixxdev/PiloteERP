import Link from "next/link";
import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { RowPanel } from "@/components/common/row-panel";
import { Reveal } from "@/components/common/reveal";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { canEditFunding } from "@/lib/rights";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { AddDeliverableForm, AddFundingMenu } from "./add-forms";
import { allocationOf, conventionCovers } from "@/lib/conventions";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { UploadForm } from "@/components/attachments/upload-form";
import { ContactLine } from "@/components/funders/contacts";
import { DeliverablesList } from "./deliverables-list";
import { PaymentsList } from "@/components/funding/payments-list";
import { EditionPayments } from "./edition-payments";
import { paymentSummary } from "@/lib/payments";

// Recettes (revue du 15/09) : un tableau compact des lignes de financement — ce que lit le pilote — et, par ligne, un panneau
// de gestion — ce que tient la RAF (dates, codes, convention, contact du dossier, notes, pièces, livrables).
export function FinancementsTab({ e, me, refs, funders, conventions, settings, isPilot }: TabCtx) {
  const covering = conventions.filter((c) => conventionCovers(c, e.year));
  const rw = canEditFunding(me.role);
  const statusOpts = REF_DEFAULTS.funding_status.map((s) => ({ value: s.code, label: refLabel(refs, "funding_status", s.code) }));
  const funderOpts = funders.map((f) => ({ value: f.id, label: f.name }));
  const kinds = REF_DEFAULTS.attachment_kind.map((k) => ({ value: k.code, label: refLabel(refs, "attachment_kind", k.code) }));
  const totalRequested = e.fundingLines.reduce((s, f) => s + (f.amountRequested ?? 0), 0);
  const totalGranted = e.fundingLines.reduce((s, f) => s + (f.amountGranted ?? 0), 0);
  // Versé : reçu sur les lignes de l'édition (les tranches d'une convention partagée se lisent sur la convention).
  const totalReceived = e.fundingLines.reduce((s, f) => s + paymentSummary(f.amountGranted, f.payments).received, 0);
  // Dossiers encore ouverts (à déposer, déposé) : dits dans le sous-titre, pour ne pas les chercher ligne par ligne.
  const pendingLines = e.fundingLines.filter((f) => ["to_submit", "submitted"].includes(f.status));

  return (
    <div className="grid gap-4">
      <Section
        title="Lignes de financement"
        description={<span><b className="text-foreground">{fmtEuro(totalGranted)} obtenus</b> / {fmtEuro(totalRequested)} demandés · <span data-testid="funding-received-total">{fmtEuro(totalReceived)} versés</span> · {e.fundingLines.length} financeur{e.fundingLines.length > 1 ? "s" : ""}{pendingLines.length > 0 && <> · {pendingLines.map((f) => `${f.funder.name} : ${refLabel(refs, "funding_status", f.status).toLowerCase()}`).join(", ")}</>}{e.fundingLines.length === 1 && <strong className="text-warning"> · projet mono-financeur</strong>}{rw && " · tenues par la RAF"}</span>}
        actions={rw ? <AddFundingMenu editionId={e.id} funders={funders} conventions={covering.filter((c) => !c.lines.some((l) => l.editionId === e.id)).map((c) => ({ id: c.id, label: `${funders.find((f) => f.id === c.funderId)?.name ?? ""} · ${c.reference} (${c.startYear}-${c.endYear})` }))} /> : undefined}
        testId="funding-lines"
      >
        {e.fundingLines.length === 0 ? (
          <EmptyState title="Aucune ligne de financement" hint="La RAF ajoute ici chaque financeur avec son dispositif, ses montants et ses livrables dus." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm" data-testid="funding-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-2">Financeur</th>
                  <th className="py-1.5 pr-2">Dispositif</th>
                  <th className="py-1.5 pr-2">Statut</th>
                  <th className="py-1.5 pr-2 text-right">Demandé</th>
                  <th className="py-1.5 pr-2 text-right">Obtenu</th>
                  <th className="py-1.5 pr-2 text-right">Versé</th>
                  <th className="py-1.5 pr-2">Prochain livrable</th>
                  <th className="py-1.5 pr-2">Contact</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {e.fundingLines.map((f, i) => {
                  const next = f.deliverables.filter((d) => !d.done).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
                  const contact = f.contact ?? f.convention?.contact ?? f.funder.contacts.find((c) => c.primary) ?? null;
                  const n = next ? daysFromNow(next.dueDate) : null;
                  return (
                    <tr key={f.id} data-testid={`funding-line-${i}`} data-funder={f.funder.name} className="align-top">
                      <td className="py-2 pr-2 font-semibold">{f.funder.name}{f.convention && <div className="text-[10px] font-normal text-muted-foreground">convention <Link href={`/conventions/${f.convention.id}`} className="text-primary hover:underline">{f.convention.reference}</Link></div>}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{f.scheme || "—"}</td>
                      <td className="py-2 pr-2"><StatusBadge label={refLabel(refs, "funding_status", f.status)} color={refColor(refs, "funding_status", f.status)} /></td>
                      <td className="py-2 pr-2 text-right tabular">{f.amountRequested != null ? fmtEuro(f.amountRequested) : "—"}</td>
                      <td className="py-2 pr-2 text-right tabular font-medium">{f.amountGranted != null ? fmtEuro(f.amountGranted) : "—"}</td>
                      <td className="py-2 pr-2 text-right tabular text-xs" data-testid={`funding-received-${i}`}>{(() => { const ps = paymentSummary(f.amountGranted, f.payments); if (f.payments.length === 0) return f.convention && f.convention.payments.length > 0 ? <span className="text-muted-foreground" title="Versé par tranches sur la convention">sur convention</span> : <span className="text-muted-foreground">—</span>; return <><span className={cn(ps.remaining === 0 ? "text-mint" : "text-foreground")}>{fmtEuro(ps.received)}</span>{ps.late.length > 0 && <div className="text-[11px] font-semibold text-danger">{ps.late.length} en retard</div>}{ps.remaining !== null && ps.remaining > 0 && ps.late.length === 0 && <div className="text-[11px] text-muted-foreground">reste {fmtEuro(ps.remaining)}</div>}</>; })()}</td>
                      <td className="py-2 pr-2 text-xs">{next ? <><span className="text-foreground">{next.label}</span><div className={cn("text-[11px]", n! < 0 ? "font-semibold text-danger" : n! <= settings.deliverableAlertDays ? "text-warning-foreground" : "text-muted-foreground")}>{fmtDate(next.dueDate)} · {n! < 0 ? `${-n!} j de retard` : n === 0 ? "aujourd'hui" : `J-${n}`}</div></> : <span className="text-muted-foreground">aucun en attente</span>}</td>
                      <td className="py-2 pr-2 text-xs" data-testid={`funding-contact-${i}`}><ContactLine c={contact} label={f.contact ? "Contact du dossier" : "Contact"} /> · <Link href={`/financeurs/${f.funderId}`} className="text-primary hover:underline">fiche {f.funder.name}</Link></td>
                      <td className="py-2 text-right">
                        <RowPanel testId={`funding-panel-${i}`} label={rw ? "Gérer" : "Détail"} title={<>{f.funder.name} · {e.project.name} {e.year}</>} description={rw ? "Ligne tenue par la RAF : montants, dates, convention, contact, pièces, livrables." : "Lecture seule : ligne tenue par la RAF."} wide>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Field label="Financeur"><AutoField model="fundingLine" id={f.id} field="funderId" type="select" value={f.funderId} options={funderOpts} readOnly={!rw} allowEmpty={false} inputClassName="font-semibold" label={`Financeur, ligne ${i + 1}`} /></Field>
                            <Field label="Dispositif"><AutoField model="fundingLine" id={f.id} field="scheme" type="text" value={f.scheme} readOnly={!rw} placeholder="Convention, appel à projets…" /></Field>
                            <Field label="Statut">{rw ? <AutoField model="fundingLine" id={f.id} field="status" type="select" value={f.status} options={statusOpts} allowEmpty={false} testId={`funding-status-${i}`} /> : <div className="py-1"><StatusBadge label={refLabel(refs, "funding_status", f.status)} color={refColor(refs, "funding_status", f.status)} /></div>}</Field>
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Demandé"><AutoField model="fundingLine" id={f.id} field="amountRequested" type="number" value={f.amountRequested} readOnly={!rw} suffix="€" label={`Montant demandé, ${f.funder.name}`} placeholder="—" /></Field>
                              <Field label="Obtenu"><AutoField model="fundingLine" id={f.id} field="amountGranted" type="number" value={f.amountGranted} readOnly={!rw} suffix="€" label={`Montant obtenu, ${f.funder.name}`} placeholder="—" /></Field>
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
                        </RowPanel>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <DeliverablesList e={e} settings={settings} canTick={rw || isPilot} canEdit={rw} />
      <EditionPayments e={e} rw={rw} />
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
