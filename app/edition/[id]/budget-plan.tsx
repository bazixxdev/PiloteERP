import { Download } from "lucide-react";
import { Section } from "@/components/common/section";
import { HelpTip } from "@/components/common/help-tip";
import { StatusBadge } from "@/components/common/status-badge";
import { withBase } from "@/lib/base-path";
import { canPlanBudget, canValidateBudgetOn } from "@/lib/budget-plan";
import type { BudgetPlanView } from "@/lib/budget-plan-db";
import { fmtDate, fmtEuro, fmtNumber } from "@/lib/format";
import { projectPoleIds } from "@/lib/scope";
import { cn } from "@/lib/utils";
import { V, du, le } from "@/lib/vocab";
import type { TabCtx } from "./types";
import { BudgetLineForm, BudgetLineRow, BudgetStatusButtons, OverrideForm } from "./budget-plan-forms";

const STATUS: Record<string, { label: string; color: "warning" | "mint" | "muted" }> = {
  draft: { label: "Brouillon", color: "muted" },
  submitted: { label: "À valider", color: "warning" },
  validated: { label: "Validé", color: "mint" },
};

// Budget prévisionnel (25/09) : le prévu par catégorie face au réalisé (temps valorisé pour le Personnel, grand livre ou dépenses
// pour le reste) et aux engagements restants. Le plan est chargé par la page (une seule lecture pour la section et l'alerte).
export function BudgetPlanSection({ e, me, plan }: Pick<TabCtx, "e" | "me"> & { plan: BudgetPlanView }) {
  const poleIds = projectPoleIds(e.project);
  const canPlan = canPlanBudget(me, { pilotId: e.project.pilotId, poleIds, teamIds: e.team.map((t) => t.personId) });
  const canValidate = canValidateBudgetOn(me, { poleIds });
  const categories = plan.categories.filter((c) => c.active).map((c) => ({ id: c.id, label: c.label }));
  const status = STATUS[plan.status] ?? STATUS.draft;
  const { rows, totals, unclassified } = plan.table;
  const visible = rows.filter((r) => r.planned || r.actual || r.engaged || r.override);
  return (
    <Section
      title="Budget prévisionnel"
      testId="budget-plan"
      description={<span className="inline-flex items-center gap-1.5">{`Le prévu par catégorie ${du(V.edition)}, face au réalisé et aux engagements restants `}<HelpTip title="Comment se lit ce tableau">
        <p>Réalisé du Personnel = heures saisies sur le projet × coût horaire de chaque personne (coût mensuel chargé de la trésorerie ÷ heures attendues du mois). Autres catégories = charges du grand livre classées par numéro de compte (ou dépenses rangées dans la catégorie si le réalisé vient des dépenses).</p>
        <p className="mt-1">Écart = prévu − réalisé − engagé restant : négatif, le prévu est dépassé. Une saisie à la main remplace le calcul, qui reste affiché dessous.</p>
      </HelpTip></span>}
      actions={<div className="flex flex-wrap items-center gap-2">
        <span data-testid="budget-plan-status"><StatusBadge label={status.label} color={status.color} /></span>
        {plan.status === "validated" && plan.validatedAt && <span className="text-[11px] text-muted-foreground">le {fmtDate(plan.validatedAt)}{plan.validatedBy ? ` par ${plan.validatedBy}` : ""}</span>}
        <BudgetStatusButtons editionId={e.id} status={plan.status} canPlan={canPlan} canValidate={canValidate} />
        <a href={withBase(`/edition/${e.id}/budget-plan/export`)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid="budget-plan-export"><Download className="size-3.5" />CSV</a>
      </div>}
    >
      {visible.length === 0 && unclassified === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground" data-testid="budget-plan-empty">{canPlan ? "Aucun prévu encore : ajoutez les lignes du budget présenté aux financeurs." : `Aucun prévu encore : ${le(V.pilote)} le prépare.`}</p>
      ) : (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-sm" data-testid="budget-plan-table">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Catégorie</th>
                <th className="py-1.5 pr-3 text-right font-medium">Prévu</th>
                <th className="py-1.5 pr-3 text-right font-medium">Réalisé</th>
                <th className="py-1.5 pr-3 text-right font-medium">Engagé restant</th>
                <th className="py-1.5 pr-3 text-right font-medium">Écart</th>
                <th className="py-1.5 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const lines = plan.lines.filter((l) => l.categoryId === r.categoryId);
                return (
                  <tr key={r.categoryId} className="border-b align-top last:border-0" data-testid={`budget-row-${r.categoryId}`}>
                    <td className="py-2 pr-3">
                      <b className="font-semibold">{r.label}</b>
                      {lines.length > 0 && (
                        <ul className="mt-1 grid gap-0.5 text-xs text-muted-foreground">
                          {lines.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-1.5">{l.label ?? "—"} · <BudgetLineRow line={l} categories={categories} canEdit={canPlan} /></li>)}
                        </ul>
                      )}
                      {r.source === "time" && (
                        <p className="mt-1 text-[11px] text-muted-foreground" data-testid="budget-personnel-hours">
                          {fmtNumber(plan.personnel.hours, 1)} h saisies{plan.personnel.unvaluedHours > 0 && <span className="text-warning"> · {fmtNumber(plan.personnel.unvaluedHours, 1)} h sans coût horaire{plan.personnel.unvaluedPeople ? ` (${plan.personnel.unvaluedPeople.join(", ")})` : ""}</span>}
                        </p>
                      )}
                      {r.source === "time" && plan.personnel.detail && plan.personnel.detail.length > 0 && (
                        <ul className="mt-1 grid gap-0.5 text-[11px] text-muted-foreground" data-testid="budget-personnel-detail">
                          {plan.personnel.detail.map((p) => <li key={p.name}>{p.name} · {fmtNumber(p.hours, 1)} h · {fmtEuro(p.amount)}</li>)}
                        </ul>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular">{fmtEuro(r.planned)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular" data-testid={`budget-actual-${r.categoryId}`}>
                      <span className={cn(r.override && "font-semibold")}>{fmtEuro(r.actual)}</span>
                      {r.override && <div className="text-[11px] text-muted-foreground" title={r.override.reason}>calculé : {fmtEuro(r.computed)} · saisi à la main</div>}
                      {canValidate && <div><OverrideForm editionId={e.id} categoryId={r.categoryId} current={r.override} /></div>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular">{fmtEuro(r.engaged)}</td>
                    <td className={cn("whitespace-nowrap py-2 pr-3 text-right tabular", r.gap < 0 && "font-semibold text-danger")} data-testid={`budget-gap-${r.categoryId}`}>{fmtEuro(r.gap)}</td>
                    <td className={cn("whitespace-nowrap py-2 text-right tabular", r.pct !== null && r.pct > 100 && "text-danger")}>{r.pct === null ? "—" : `${r.pct} %`}</td>
                  </tr>
                );
              })}
              {unclassified !== 0 && (
                <tr className="border-b" data-testid="budget-row-unclassified">
                  <td className="py-2 pr-3"><b className="font-semibold text-warning">Non classé</b><p className="text-[11px] text-muted-foreground">Charges dont le compte n'entre dans aucune catégorie : complétez les préfixes dans Admin › Référentiels.</p></td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right tabular">—</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right tabular">{fmtEuro(unclassified)}</td>
                  <td colSpan={3} />
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="py-2 pr-3">Total</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular" data-testid="budget-total-planned">{fmtEuro(totals.planned)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular">{fmtEuro(totals.actual)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular">{fmtEuro(totals.engaged)}</td>
                <td className={cn("whitespace-nowrap py-2 pr-3 text-right tabular", totals.gap < 0 && "text-danger")}>{fmtEuro(totals.gap)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {canPlan && categories.length > 0 && <BudgetLineForm editionId={e.id} categories={categories} />}
    </Section>
  );
}
