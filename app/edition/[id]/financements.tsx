import Link from "next/link";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { RowPanel } from "@/components/common/row-panel";
import { refColor, refLabel } from "@/lib/refs";
import { canEditFunding } from "@/lib/rights";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { AddFundingMenu } from "./add-forms";
import { conventionCovers } from "@/lib/conventions";
import { ContactLine } from "@/components/funders/contacts";
import { DeliverablesList } from "./deliverables-list";
import { EditionPayments } from "./edition-payments";
import { paymentSummary } from "@/lib/payments";
import { FundingLinePanelBody, fundingPanelTitle, FUNDING_PANEL_DESCRIPTION } from "@/components/funding/line-panel";

// Recettes (revue du 15/09) : un tableau compact des lignes de financement — ce que lit le pilote — et, par ligne, un panneau
// de gestion — ce que tient la RAF (dates, codes, convention, contact du dossier, notes, pièces, livrables).
export function FinancementsTab({ e, me, refs, funders, conventions, settings, isPilot, openLine, openField }: TabCtx) {
  const covering = conventions.filter((c) => conventionCovers(c, e.year));
  const rw = canEditFunding(me);
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
                        <RowPanel testId={`funding-panel-${i}`} defaultOpen={openLine === f.id} label={rw ? "Gérer" : "Détail"} title={fundingPanelTitle(e, f)} description={rw ? FUNDING_PANEL_DESCRIPTION.rw : FUNDING_PANEL_DESCRIPTION.ro} wide>
                          <FundingLinePanelBody e={e} f={f} i={i} rw={rw} isPilot={isPilot} refs={refs} funders={funders} conventions={conventions} highlight={openLine === f.id ? openField : null} />
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

