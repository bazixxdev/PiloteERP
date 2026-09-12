import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { canEditFunding } from "@/lib/rights";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { AddDeliverableForm, AddFundingLineForm } from "./add-forms";
import { DeliverableDone } from "./deliverable-done";

export function FinancementsTab({ e, me, refs, funders, settings, isPilot }: TabCtx) {
  const rw = canEditFunding(me.role);
  const statusOpts = REF_DEFAULTS.funding_status.map((s) => ({ value: s.code, label: refLabel(refs, "funding_status", s.code) }));
  const funderOpts = funders.map((f) => ({ value: f.id, label: f.name }));
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
          actions={rw ? <AddFundingLineForm editionId={e.id} funders={funders} /> : undefined}
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
                  <div className="mt-2"><AutoField model="fundingLine" id={f.id} field="notes" type="textarea" rows={1} value={f.notes} readOnly={!rw} placeholder="Notes, justificatifs à conserver, lieu de stockage…" /></div>

                  <div className="mt-3 rounded-lg bg-muted/50 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Livrables dus</span>
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
                              <span className={cn("w-28 text-right text-xs", d.done ? "text-mint" : n < 0 ? "text-danger" : n <= settings.deliverableAlertDays ? "text-[#8a5a00]" : "text-muted-foreground")}>
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
