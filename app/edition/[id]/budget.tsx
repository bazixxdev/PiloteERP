import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { canWriteLayer } from "@/lib/rights";
import { budgetOf } from "@/lib/budget";
import { fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { AddExpenseForm } from "./add-forms";

// Budget des dépenses directes : quatre montants, formules sans double comptage (devis → engagement, facture rattachée → réalisé).
export function BudgetTab({ e, me, settings, isPilot, isTeam }: TabCtx) {
  const rw = canWriteLayer(me.role, "budget", isPilot, isTeam);
  const b = budgetOf(e);
  const lastUpdate = e.expenses.reduce<Date | null>((m, x) => (!m || x.updatedAt > m ? x.updatedAt : m), null);
  const statusOpts = [{ value: "open", label: "En cours" }, { value: "closed", label: "Soldée" }];
  // Cellules de budget V2 : libellé discret, montant en grand, lecture en dessous.
  const card = (label: string, value: string, hint?: string, cls?: string, testId?: string) => (
    <div className={cn("rounded-md border bg-card px-3 py-4", cls)}>
      <small className="text-xs text-muted-foreground">{label}</small>
      <b className="mt-2 block text-[25px] font-semibold leading-tight tracking-[-0.7px] tabular" data-testid={testId}>{value}</b>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
  const pctSpent = e.budgetEnvelope ? Math.min(100, Math.round((b.realized / e.budgetEnvelope) * 100)) : 0;
  const pctCommitted = e.budgetEnvelope ? Math.min(100 - pctSpent, Math.round((b.remainingCommitments / e.budgetEnvelope) * 100)) : 0;
  const pct = pctSpent + pctCommitted;
  return (
    <div className="grid gap-4">
      <Section title="Enveloppe de dépenses directes" description={rw ? "Enveloppe et réalisé hors devis saisis par la RAF ; le reste est calculé. Base HT/TTC unique par édition (à arbitrer, A06)." : "Lecture seule : montants tenus par la RAF."}>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border bg-card px-3 py-4">
            <small className="text-xs text-muted-foreground">Enveloppe validée</small>
            <AutoField model="edition" id={e.id} field="budgetEnvelope" type="number" value={e.budgetEnvelope} readOnly={!rw} suffix="€" inputClassName="mt-1 text-[25px] font-semibold tracking-[-0.7px]" refreshOnSave testId="budget-budgetEnvelope" placeholder={rw ? "À renseigner" : "Enveloppe à renseigner"} />
          </div>
          {card("Réalisé", fmtEuro(b.realized), `dont ${fmtEuro(b.realizedLinked)} rattachés à un devis`, undefined, "budget-realized")}
          {card("Engagements restant à réaliser", fmtEuro(b.remainingCommitments), "devis approuvés non encore facturés", undefined, "budget-committed")}
          {card("Reste", b.available === null ? "—" : fmtEuro(b.available), b.available !== null && b.available < 0 ? "dépassement, à faire remonter" : "enveloppe − réalisé − engagements", b.available !== null && b.available < 0 ? "border-danger bg-danger-soft/50" : pct >= settings.envelopeAlertPercent ? "[&>b]:text-warning-foreground" : undefined, "budget-remaining")}
        </div>
        {e.budgetEnvelope ? (
          <>
            <div className="mt-4 flex items-baseline justify-between text-xs"><span>Consommation · réalisé et engagé</span><b className={cn("tabular", pct >= 100 ? "text-danger" : pct >= settings.envelopeAlertPercent ? "text-warning-foreground" : "")}>{pct} %</b></div>
            <div className="mt-1.5 flex h-[5px] overflow-hidden rounded-[3px] bg-[#e8e9e1]" title="Réalisé, puis engagé restant">
              <i className={cn("block h-full", pct >= 100 ? "bg-danger" : pct >= settings.envelopeAlertPercent ? "bg-warning" : "bg-mint")} style={{ width: `${pctSpent}%` }} />
              <i className="block h-full bg-[#abc1af]" style={{ width: `${pctCommitted}%` }} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Réalisé : {fmtEuro(b.realized)} · engagé restant à facturer : {fmtEuro(b.remainingCommitments)} · reste : {b.available === null ? "—" : fmtEuro(b.available)}. {lastUpdate ? `Dernière actualisation ${fmtDate(lastUpdate)}.` : "Aucune dépense."}</p>
            {pct >= settings.envelopeAlertPercent && <div className={cn("mt-3 flex items-start gap-2.5 rounded-md px-3 py-3 text-xs", pct >= 100 ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning-foreground")}><span>!</span><span>Enveloppe consommée à {pct} %. Le seuil de vigilance est de {settings.envelopeAlertPercent} %.</span></div>}
          </>
        ) : (
          <p className="mt-4 text-xs text-warning-foreground">Enveloppe à renseigner{b.used > 0 ? ` · ${fmtEuro(b.used)} déjà consommés` : ""}.</p>
        )}
      </Section>

      <Section title="Dépenses" description="Un devis approuvé crée l'engagement une seule fois ; la RAF rattache le réalisé (factures) à cette ligne. Une dépense sans devis se saisit avec sa référence." actions={rw ? <AddExpenseForm editionId={e.id} /> : undefined}>
        {e.expenses.length === 0 ? <p className="text-sm text-muted-foreground">Aucune dépense sur cette édition.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="expenses">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                <tr><th className="py-1.5 pr-2">Objet</th><th className="py-1.5 pr-2">Fournisseur</th><th className="py-1.5 pr-2 text-right">Engagé</th><th className="py-1.5 pr-2 text-right">Réalisé</th><th className="py-1.5 pr-2 text-right">Reste engagé</th><th className="py-1.5 pr-2">État</th><th className="py-1.5 pr-2">Référence</th><th className="py-1.5">Origine</th></tr>
              </thead>
              <tbody className="divide-y">
                {e.expenses.map((x) => {
                  const rest = x.status === "open" ? Math.max(0, x.committed - x.spent) : 0;
                  return (
                    <tr key={x.id}>
                      <td className="min-w-[200px] py-1 pr-2"><AutoField model="expense" id={x.id} field="label" type="text" value={x.label} readOnly={!rw} inputClassName="font-medium" /></td>
                      <td className="min-w-[140px] py-1 pr-2"><AutoField model="expense" id={x.id} field="supplier" type="text" value={x.supplier} readOnly={!rw} placeholder="—" /></td>
                      <td className="w-28 py-1 pr-2 text-right tabular">{x.validationId ? fmtEuro(x.committed) : <AutoField model="expense" id={x.id} field="committed" type="number" value={x.committed} readOnly={!rw} suffix="€" refreshOnSave />}</td>
                      <td className="w-32 py-1 pr-2"><AutoField model="expense" id={x.id} field="spent" type="number" value={x.spent} readOnly={!rw} suffix="€" refreshOnSave testId={`expense-spent-${x.id}`} /></td>
                      <td className={cn("w-28 py-1 pr-2 text-right tabular", x.spent > x.committed && x.committed > 0 && "text-danger font-medium")} title={x.spent > x.committed && x.committed > 0 ? "Facture supérieure à l'engagement : écart à faire remonter" : undefined}>{fmtEuro(rest)}</td>
                      <td className="w-28 py-1 pr-2"><AutoField model="expense" id={x.id} field="status" type="select" value={x.status} options={statusOpts} allowEmpty={false} readOnly={!rw} refreshOnSave /></td>
                      <td className="min-w-[120px] py-1 pr-2"><AutoField model="expense" id={x.id} field="reference" type="text" value={x.reference} readOnly={!rw} placeholder="n° facture, ligne Excel" /></td>
                      <td className="py-1 text-xs text-muted-foreground">{x.validation ? `devis validé · ${x.validation.requester.name} · ${fmtDate(x.validation.decidedAt)}` : "saisie RAF"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Exemple : enveloppe 8 000 €, devis validé 1 000 € → réalisé 0, engagement restant 1 000, disponible 7 000. Facture partielle de 400 € → réalisé 400, engagement restant 600, disponible toujours 7 000. Facture finale 900 € et reliquat soldé → réalisé 900, engagement restant 0, disponible 7 100.</p>
      </Section>
    </div>
  );
}
