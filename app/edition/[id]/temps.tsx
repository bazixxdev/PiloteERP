import { Section } from "@/components/common/section";
import { Gauge } from "@/components/common/gauge";
import { canPlanLoad, canSeeTimeOf } from "@/lib/rights";
import { AutoField } from "@/components/inline/auto-field";
import Link from "next/link";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { LoadPlanner } from "./load-planner";
import { HelpTip } from "@/components/common/help-tip";
import { ClickToEdit } from "@/components/inline/click-to-edit";
import { V, le, du } from "@/lib/vocab";

export function TempsTab({ e, me, settings, people, isPilot }: TabCtx) {
  const hpd = settings.hoursPerDay || 7;
  const canPlan = canPlanLoad(me, isPilot);
  const canSold = canPlanLoad(me);
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
      <Section title={`Temps consommé / objectif · ${e.year}`} description="Le temps saisi sur le projet pendant l'année, par action." actions={<Link href="/temps" className="text-xs text-primary hover:underline">Saisir mes temps →</Link>}>
        <div className="mb-4 flex items-center gap-4 rounded-xl bg-muted/50 p-3">
          <div>
            <div className="text-2xl font-bold tabular">{fmtNumber(total, 0)} h</div>
            <div className="text-xs text-muted-foreground">consommées sur {target ? `${fmtNumber(target, 0)} h prévues` : "un objectif non fixé"} · {fmtNumber(total / hpd, 1)} jours</div>
          </div>
          <Gauge value={total} max={target || null} alertPercent={90} />
        </div>
        <table className="w-full text-sm" data-testid="time-by-action">
          <thead className="text-left text-[10px] font-semibold text-muted-foreground">
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
            {/* Le temps saisi sur le projet sans action est une information de pilotage, pas une note de bas de page (revue du 15/09). */}
            <tr className={cn(total > 0 && noAction / total > 0.25 ? "bg-warning-soft/60 text-warning-foreground" : "text-muted-foreground")} data-testid="time-no-action">
              <td className="rounded-l-md py-1.5 pl-1 font-medium">Sans action{total > 0 && noAction > 0 && <span className="font-normal"> · {Math.round((noAction / total) * 100)} % du temps du projet</span>}</td>
              <td className="py-1.5 text-right tabular font-semibold">{fmtNumber(noAction, 1)} h</td>
              <td />
              <td className="rounded-r-md py-1.5 pl-4 text-[11px]">{total > 0 && noAction / total > 0.25 ? "à rattacher aux actions dans la saisie hebdomadaire" : ""}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title={`Ressources humaines ${du(V.edition)}`} description={<span className="inline-flex items-center gap-1.5">Charge en jours : prévus, conventionnés, réalisés <HelpTip title="Pourquoi des jours, et d'où viennent les chiffres" testId="hr-help">
        <p className="mt-1">En jours, pas en pourcentage ni en euros : les rythmes changent, les pourcentages se recalculent. Réalisé = heures saisies ÷ {hpd} h (coefficient réglable dans l'admin).</p>
        <p className="mt-2">« Par mois » ventile les jours prévus dans le <Link href="/plan-de-charge" className="text-primary hover:underline">plan de charge</Link>{` ; sans ventilation, le total se lisse sur les douze mois. La valorisation en euros du temps (coût journalier, clés de répartition) reste dans l'Excel ${du(V.raf)} : l'outil fournit les jours réalisés par personne et par ${V.edition.one}, elle applique ses coûts.`}</p>
        <p className="mt-2">« Part de l'année » = jours prévus ÷ jours disponibles de la personne dans l'année.</p>
      </HelpTip></span>}>
        <table className="w-full text-sm" data-testid="hr-table">
          <thead className="text-left text-[10px] font-semibold text-muted-foreground">
            <tr>
              <th className="py-1.5">Personne</th>
              <th className="py-1.5 text-right" title={`Charge de travail prévue sur ${le(V.edition)} (proposée par ${le(V.pilote)}), à répartir par mois pour le plan de charge`}>Prévus · par mois</th>
              <th className="py-1.5 text-right" title="Jours mentionnés dans les conventions : référence financeur, pas une charge">Conventionnés</th>
              <th className="py-1.5 text-right">Réalisés</th>
              <th className="py-1.5 text-right" title="Jours prévus ÷ jours disponibles de la personne dans l'année">Part de l'année</th>
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
                  <td className="w-40 py-1">
                    <div className="flex items-center gap-1">
                      {/* Cadrage annuel : se lit, s'ajuste au crayon (revue du 15/09). */}
                      <ClickToEdit canEdit={canPlan} hint="Ajuster les jours prévus" testId={`planned-edit-${d.personId}`} className="w-24 justify-end" valueClassName="tabular text-sm" value={<>{fmtNumber(d.plannedDays, 1)} j</>} editor={<AutoField model="editionPersonDays" id={d.id} field="plannedDays" type="number" value={d.plannedDays} suffix="j" refreshOnSave />} />
                      <LoadPlanner editionId={e.id} personId={d.personId} personName={d.person.name} year={e.year} plannedDays={d.plannedDays} loads={Object.fromEntries(e.plannedLoads.filter((l) => l.personId === d.personId).map((l) => [l.month, l.days]))} readOnly={!canPlan} />
                    </div>
                  </td>
                  <td className="w-24 py-1"><ClickToEdit canEdit={canSold} hint="Ajuster les jours conventionnés" className="justify-end" valueClassName="tabular text-sm" value={<>{fmtNumber(d.soldDays, 1)} j</>} editor={<AutoField model="editionPersonDays" id={d.id} field="soldDays" type="number" value={d.soldDays} suffix="j" refreshOnSave />} /></td>
                  <td className="w-24 py-1 text-right tabular text-muted-foreground">{seeReal ? `${fmtNumber(h / hpd, 1)} j` : "·"}</td>
                  <td className={cn("w-20 py-1 text-right tabular", pct !== null && pct > 100 && "text-danger font-medium")}>{pct === null ? "—" : `${pct} %`}</td>
                </tr>
              );
            })}
            {e.personDays.length === 0 && <tr><td colSpan={5} className="py-2 text-muted-foreground">{`Aucune personne dans l'équipe : ${le(V.pilote)} la compose depuis la fiche.`}</td></tr>}
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
        {hidden > 0 && <p className="mt-2 text-xs text-muted-foreground">{hidden} réalisé{hidden > 1 ? "s" : ""} masqué{hidden > 1 ? "s" : ""} selon la visibilité du temps.</p>}
      </Section>
    </div>
  );
}
