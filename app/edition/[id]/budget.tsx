import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { Gauge } from "@/components/common/gauge";
import { canWriteLayer } from "@/lib/rights";
import { fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";

export function BudgetTab({ e, me, settings, isPilot, isTeam }: TabCtx) {
  const rw = canWriteLayer(me.role, "budget", isPilot, isTeam);
  const remaining = e.budgetEnvelope == null ? null : e.budgetEnvelope - e.committed - e.spent;
  const approved = e.validations.filter((v) => v.status === "approved" && (v.kind === "quote" || v.kind === "expense") && v.amount);
  const cell = (label: string, field: "budgetEnvelope" | "committed" | "spent", value: number | null) => (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <AutoField model="edition" id={e.id} field={field} type="number" value={value} readOnly={!rw} suffix="€" inputClassName="text-lg font-semibold" refreshOnSave testId={`budget-${field}`} />
    </div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Section title="Enveloppe de dépenses directes" description={rw ? "Montants saisis par la RAF depuis son suivi ; le reste est calculé." : "Lecture seule : montants saisis par la RAF."}>
        <div className="grid gap-3 sm:grid-cols-4">
          {cell("Enveloppe validée", "budgetEnvelope", e.budgetEnvelope)}
          {cell("Engagé (devis validés)", "committed", e.committed)}
          {cell("Réalisé (factures)", "spent", e.spent)}
          <div className={cn("rounded-xl border p-3", remaining !== null && remaining < 0 ? "border-danger bg-danger-soft/50" : "bg-mint-soft/60")}>
            <div className="text-xs font-medium text-muted-foreground">Reste</div>
            <div className="px-2 py-1 text-lg font-semibold tabular" data-testid="budget-remaining">{fmtEuro(remaining)}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Consommation (engagé + réalisé)</span>
          <Gauge value={e.committed + e.spent} max={e.budgetEnvelope} alertPercent={settings.envelopeAlertPercent} />
          <span className="text-xs text-muted-foreground">alerte à {settings.envelopeAlertPercent} %</span>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Aucun calcul comptable ici : pas de rapprochement, pas de clés de répartition. Les montants viennent du suivi de la RAF.</p>
      </Section>

      <Section title="Devis et dépenses validés" description="Chaque validation approuvée s'ajoute automatiquement à l'engagé.">
        {approved.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun devis validé sur cette édition.</p>
        ) : (
          <ul className="divide-y text-sm">
            {approved.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div>{v.label}</div>
                  <div className="text-xs text-muted-foreground">{v.decider?.name} · {fmtDate(v.decidedAt)}</div>
                </div>
                <span className="tabular font-medium">{fmtEuro(v.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
