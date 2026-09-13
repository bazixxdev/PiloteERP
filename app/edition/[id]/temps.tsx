import { Section } from "@/components/common/section";
import { Gauge } from "@/components/common/gauge";
import { canEditFunding, canSeeTimeOf } from "@/lib/rights";
import { AutoField } from "@/components/inline/auto-field";
import Link from "next/link";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";

export function TempsTab({ e, me, settings, people, isPilot }: TabCtx) {
  const hpd = settings.hoursPerDay || 7;
  const canPlan = isPilot || canEditFunding(me.role) || me.role === "pole_lead";
  const canSold = canEditFunding(me.role) || me.role === "pole_lead";
  const byAction = new Map<string | null, number>();
  const byPerson = new Map<string, number>();
  for (const t of e.yearEntries) {
    byAction.set(t.actionId, (byAction.get(t.actionId) ?? 0) + t.hours);
    byPerson.set(t.personId, (byPerson.get(t.personId) ?? 0) + t.hours);
  }
  const total = e.yearEntries.reduce((s, t) => s + t.hours, 0);
  const target = e.actions.reduce((s, a) => s + (a.timeTarget ?? 0), 0);
  const noAction = byAction.get(null) ?? 0;
  const hidden = [...byPerson.keys()].filter((id) => { const p = people.find((x) => x.id === id); return !p || !canSeeTimeOf(me, p, settings.timeVisibility); }).length;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Section title={`Temps consommé / objectif · ${e.year}`} description="Le temps saisi sur le projet pendant l'année, par action.">
        <div className="mb-4 flex items-center gap-4 rounded-xl bg-muted/50 p-3">
          <div>
            <div className="text-2xl font-bold tabular">{fmtNumber(total, 0)} h</div>
            <div className="text-xs text-muted-foreground">consommées sur {target ? `${fmtNumber(target, 0)} h prévues` : "un objectif non fixé"} · {fmtNumber(total / hpd, 1)} jours</div>
          </div>
          <Gauge value={total} max={target || null} alertPercent={90} />
        </div>
        <table className="w-full text-sm" data-testid="time-by-action">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr><th className="py-1.5">Action</th><th className="py-1.5 text-right">Consommé</th><th className="py-1.5 text-right">Objectif</th><th className="py-1.5 pl-4">Avancement</th></tr>
          </thead>
          <tbody className="divide-y">
            {e.actions.map((a) => {
              const c = byAction.get(a.id) ?? 0;
              return (
                <tr key={a.id}>
                  <td className="py-1.5">{a.name}</td>
                  <td className={cn("py-1.5 text-right tabular", a.timeTarget && c > a.timeTarget && "font-semibold text-danger")}>{fmtNumber(c, 1)} h</td>
                  <td className="py-1.5 text-right tabular text-muted-foreground">{a.timeTarget ? `${a.timeTarget} h` : "—"}</td>
                  <td className="py-1.5 pl-4"><Gauge value={c} max={a.timeTarget} alertPercent={90} compact /></td>
                </tr>
              );
            })}
            <tr className="text-muted-foreground">
              <td className="py-1.5 italic">Sur le projet, sans action</td>
              <td className="py-1.5 text-right tabular">{fmtNumber(noAction, 1)} h</td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Ressources humaines de l'édition" description={`Charge en jours, pas en pourcentage ni en euros : les rythmes changent, les % se recalculent. Réalisé = heures saisies ÷ ${hpd} h (coefficient réglable dans l'admin).`}>
        <table className="w-full text-sm" data-testid="hr-table">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-1.5">Personne</th>
              <th className="py-1.5 text-right" title="Charge de travail prévue sur l'édition (proposée par le pilote)">Prévus</th>
              <th className="py-1.5 text-right" title="Jours mentionnés dans les conventions : référence financeur, pas une charge">Conventionnés</th>
              <th className="py-1.5 text-right">Réalisés</th>
              <th className="py-1.5 text-right" title="Prévus ÷ jours disponibles de la personne dans l'année">% dispo.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {e.personDays.map((d) => {
              const p = people.find((x) => x.id === d.personId);
              const h = byPerson.get(d.personId) ?? 0;
              const seeReal = p ? canSeeTimeOf(me, p, settings.timeVisibility) : false;
              const avail = d.availableDays ?? p?.availableDays ?? 0;
              const pct = avail ? Math.round((d.plannedDays / avail) * 100) : null;
              return (
                <tr key={d.id}>
                  <td className="py-1">{seeReal && d.personId !== me.id ? <Link href={`/temps?personne=${d.personId}`} className="hover:underline" title="Voir la grille de cette personne">{d.person.name}</Link> : d.person.name}</td>
                  <td className="w-24 py-1"><AutoField model="editionPersonDays" id={d.id} field="plannedDays" type="number" value={d.plannedDays} readOnly={!canPlan} suffix="j" refreshOnSave /></td>
                  <td className="w-24 py-1"><AutoField model="editionPersonDays" id={d.id} field="soldDays" type="number" value={d.soldDays} readOnly={!canSold} suffix="j" refreshOnSave /></td>
                  <td className="w-24 py-1 text-right tabular text-muted-foreground">{seeReal ? `${fmtNumber(h / hpd, 1)} j` : "·"}</td>
                  <td className={cn("w-20 py-1 text-right tabular", pct !== null && pct > 100 && "text-danger font-medium")}>{pct === null ? "—" : `${pct} %`}</td>
                </tr>
              );
            })}
            {e.personDays.length === 0 && <tr><td colSpan={5} className="py-2 text-muted-foreground">Aucune personne dans l'équipe : le pilote la compose depuis la fiche.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right tabular">{fmtNumber(e.personDays.reduce((s, d) => s + d.plannedDays, 0), 1)} j</td>
              <td className="py-1.5 text-right tabular">{fmtNumber(e.personDays.reduce((s, d) => s + d.soldDays, 0), 1)} j</td>
              <td className="py-1.5 text-right tabular">{fmtNumber(total / hpd, 1)} j</td>
              <td className="py-1.5 text-right tabular text-muted-foreground" title="Équivalent temps plein : jours prévus ÷ 200">{fmtNumber(e.personDays.reduce((s, d) => s + d.plannedDays, 0) / 200, 2)} ETP</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">La valorisation en euros du temps (coût journalier, clés de répartition) reste dans l'Excel de la RAF : l'outil fournit les jours réalisés par personne et par édition, elle applique ses coûts. {hidden > 0 && `${hidden} réalisé${hidden > 1 ? "s" : ""} masqué${hidden > 1 ? "s" : ""} selon la visibilité du temps.`}</p>
      </Section>
    </div>
  );
}
