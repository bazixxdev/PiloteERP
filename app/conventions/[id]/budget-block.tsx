import { Section } from "@/components/common/section";
import { loadBudgetPlan } from "@/lib/budget-plan-db";
import { fmtEuro } from "@/lib/format";
import type { Actor } from "@/lib/rights";
import { cn } from "@/lib/utils";
import { V, du, pl } from "@/lib/vocab";

// Budget des projets financés par le dossier (25/09, lecture) : le prévu et le réalisé par catégorie, pour chaque année,
// additionnés depuis les éditions rattachées. Le budget se tient sur l'édition ; ici, il se lit seulement.
export async function ConventionBudget({ editions, me }: { editions: { id: string; year: number; projectId: string }[]; me: Actor }) {
  const plans = await Promise.all(editions.map(async (e) => ({ year: e.year, plan: await loadBudgetPlan(e, me) })));
  const years = [...new Set(plans.map((p) => p.year))].sort();
  const labels = new Map<string, { label: string; order: number }>();
  const cell = new Map<string, { planned: number; actual: number }>();
  for (const { year, plan } of plans) for (const r of plan.table.rows) {
    if (!r.planned && !r.actual) continue;
    labels.set(r.categoryId, { label: r.label, order: plan.categories.find((c) => c.id === r.categoryId)?.order ?? 0 });
    const k = `${r.categoryId}:${year}`;
    const v = cell.get(k) ?? { planned: 0, actual: 0 };
    cell.set(k, { planned: v.planned + r.planned, actual: v.actual + r.actual });
  }
  const cats = [...labels].sort((a, b) => a[1].order - b[1].order);
  return (
    <Section title={`Budget des ${pl(V.projet)} financés`} description={`Prévu et réalisé par catégorie, additionnés depuis le budget prévisionnel de chaque ${V.edition.one} rattachée ; ils se tiennent sur la page ${du(V.edition)}.`} testId="convention-budget">
      {cats.length === 0 ? <p className="text-sm text-muted-foreground">Aucun budget prévisionnel saisi sur les {pl(V.edition)} rattachées.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1.5 pr-3 font-medium">Catégorie</th>{years.map((y) => <th key={y} className="py-1.5 pr-3 text-right font-medium">{y} · prévu / réalisé</th>)}</tr></thead>
            <tbody>
              {cats.map(([id, { label }]) => (
                <tr key={id} className="border-b last:border-0">
                  <td className="py-1.5 pr-3">{label}</td>
                  {years.map((y) => { const v = cell.get(`${id}:${y}`); return <td key={y} className={cn("py-1.5 pr-3 text-right tabular", v && v.actual > v.planned && "text-danger")}>{v ? `${fmtEuro(v.planned)} / ${fmtEuro(v.actual)}` : "—"}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
