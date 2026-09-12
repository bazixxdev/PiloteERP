import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { Gauge } from "@/components/common/gauge";
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
  const card = (label: string, value: string, hint?: string, cls?: string, testId?: string) => (
    <div className={cn("rounded-xl border bg-card p-3", cls)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="px-0.5 py-1 text-lg font-semibold tabular" data-testid={testId}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
  return (
    <div className="grid gap-4">
      <Section title="Enveloppe de dépenses directes" description={rw ? "Enveloppe et réalisé hors devis saisis par la RAF ; le reste est calculé. Base HT/TTC unique par édition (à arbitrer, A06)." : "Lecture seule : montants tenus par la RAF."}>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-3">
            <div className="text-xs font-medium text-muted-foreground">Enveloppe validée</div>
            <AutoField model="edition" id={e.id} field="budgetEnvelope" type="number" value={e.budgetEnvelope} readOnly={!rw} suffix="€" inputClassName="text-lg font-semibold" refreshOnSave testId="budget-budgetEnvelope" placeholder={rw ? "À renseigner" : "Enveloppe à renseigner"} />
          </div>
          {card("Réalisé", fmtEuro(b.realized), `dont ${fmtEuro(b.realizedLinked)} rattachés à un devis`, undefined, "budget-realized")}
          {card("Engagements restant à réaliser", fmtEuro(b.remainingCommitments), "devis approuvés non encore facturés", undefined, "budget-committed")}
          {card("Disponible", b.available === null ? "—" : fmtEuro(b.available), b.available !== null && b.available < 0 ? "dépassement, à faire remonter" : "enveloppe − réalisé − engagements", b.available !== null && b.available < 0 ? "border-danger bg-danger-soft/50" : "bg-mint-soft/60", "budget-remaining")}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Consommation (réalisé + engagements restants)</span>
          {e.budgetEnvelope ? <Gauge value={b.used} max={e.budgetEnvelope} alertPercent={settings.envelopeAlertPercent} /> : <span className="text-sm text-[#8a5a00]">Enveloppe à renseigner{b.used > 0 ? ` · ${fmtEuro(b.used)} déjà consommés` : ""}</span>}
          <span className="text-xs text-muted-foreground">alerte à {settings.envelopeAlertPercent} % · {lastUpdate ? `dernière actualisation ${fmtDate(lastUpdate)}` : "aucune dépense"}</span>
        </div>
      </Section>

      <Section title="Dépenses" description="Un devis approuvé crée l'engagement une seule fois ; la RAF rattache le réalisé (factures) à cette ligne. Une dépense sans devis se saisit avec sa référence." actions={rw ? <AddExpenseForm editionId={e.id} /> : undefined}>
        {e.expenses.length === 0 ? <p className="text-sm text-muted-foreground">Aucune dépense sur cette édition.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="expenses">
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
