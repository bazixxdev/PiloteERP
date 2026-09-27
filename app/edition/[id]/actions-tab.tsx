import Link from "next/link";
import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { canEditActions, canWriteLayer } from "@/lib/rights";
import { dayjs, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { inMyPole } from "@/lib/scope";
import { AddActionForm, AddIndicatorForm } from "./add-forms";
import { Achievements } from "./achievements";
import { TimeCell } from "./time-cell";
import { attachable, attachOptions, beforeDay, milestoneTitle, openForWork, spanLabel } from "@/lib/actions";
import { V, cap, le, ce, aucun, pl } from "@/lib/vocab";
import { Timeline } from "./timeline";

export function ActionsTab({ e, me, refs, people, isPilot, isTeam }: TabCtx) {
  const writable = canEditActions(me, isPilot, isTeam, inMyPole(me, e.project));
  const yearRw = canWriteLayer(me, "year", isPilot, isTeam, inMyPole(me, e.project));
  const stateOpts = REF_DEFAULTS.action_state.map((s) => ({ value: s.code, label: refLabel(refs, "action_state", s.code) }));
  const ownerOpts = people.map((p) => ({ value: p.id, label: p.name }));

  // Le tableau se lit ; le détail (contenu, période, jalons, personnes, tâches, heures) est sur la page de l'action.
  return (
    <div className="grid gap-4">
      <Section title={cap(pl(V.action))} description={`${e.actions.filter(openForWork).length} à mener sur ${e.actions.length}`} actions={writable ? <AddActionForm editionId={e.id} year={e.year} /> : undefined}>
        {e.actions.length === 0 ? (
          <EmptyState title={cap(aucun(V.action))} hint={`Ajoutez la première ${V.action.one} de ${ce(V.edition)} : un nom, puis sa période et ses jalons sur sa page.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm" data-testid="actions-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                <tr>
                  <th className="w-8 py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-2">{cap(V.action)}</th>
                  <th className="py-1.5 pr-2">Responsable</th>
                  <th className="py-1.5 pr-2">Période</th>
                  <th className="py-1.5 pr-2">Prochain jalon</th>
                  <th className="py-1.5 pr-2">État</th>
                  <th className="min-w-[150px] py-1.5 pr-2" title={`Heures saisies sur ${le(V.action)} en ${e.year}, face à l'objectif fixé`}>{`Heures ${e.year}`}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {e.actions.map((a, i) => {
                  const own = a.ownerId === me.id;
                  const associate = a.people.some((p) => p.personId === me.id);
                  // Mêmes droits que les commandes (actionRights) : le responsable et l'équipe de l'année gèrent le responsable ;
                  // les personnes associées modifient état et objectif. Les commandes se gardent elles-mêmes.
                  const rwOwner = writable || own;
                  const rw = rwOwner || associate;
                  const over = a.timeTarget != null && a.hoursYear > a.timeTarget;
                  const next = a.milestones.find((m) => !m.done) ?? null;
                  const lateMilestone = Boolean(next && openForWork(a) && beforeDay(next.date, new Date()));
                  const span = spanLabel(a, e.year);
                  return (
                    <tr key={a.id} className="group align-top" data-testid={`${V.action.one}-row-${i}`}>
                      <td className="py-1.5 pr-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="min-w-[190px] py-1.5 pr-2">
                        <Link href={`/action/${a.id}?annee=${e.year}`} className={cn("font-medium text-primary hover:underline", a.state === "abandoned" && "text-muted-foreground line-through")} data-testid={`${V.action.one}-link-${i}`}>{a.name}</Link>
                      </td>
                      <td className="min-w-[140px] py-0.5 pr-2"><AutoField model="action" id={a.id} field="ownerId" type="select" value={a.ownerId} options={ownerOpts} readOnly={!rwOwner} placeholder="—" label={`Responsable, ${a.name}`} /></td>
                      <td className="min-w-[120px] py-1.5 pr-2 text-xs" data-testid={`${V.action.one}-period-${i}`}>
                        <div className="tabular">{fmtDate(a.startDate, "D MMM YY")} – {fmtDate(a.endDate, "D MMM YY")}</div>
                        {span && <div className="text-[10px] text-muted-foreground">{span}</div>}
                      </td>
                      <td className="min-w-[110px] max-w-[180px] py-1.5 pr-2 text-xs" data-testid={`${V.action.one}-next-${i}`}>
                        {next ? (
                          <>
                            <div className={cn("tabular", lateMilestone ? "font-medium text-danger" : "text-foreground")}>{fmtDate(next.date)}</div>
                            {next.label !== a.name && <div className="truncate text-[10px] text-muted-foreground" title={milestoneTitle(a.name, next.label)}>{next.label}</div>}
                          </>
                        ) : <span className="italic text-muted-foreground">—</span>}
                      </td>
                      <td className="min-w-[120px] py-0.5 pr-2">
                        {lateMilestone && <span className="mb-0.5 inline-block rounded-sm bg-danger-soft px-1.5 text-[10px] font-medium text-danger" data-testid={`${V.action.one}-late-${i}`}>en retard</span>}
                        {rw ? (
                          <AutoField model="action" id={a.id} field="state" type="select" value={a.state} options={stateOpts} allowEmpty={false} refreshOnSave testId={`${V.action.one}-state-${i}`} label={`État, ${a.name}`} />
                        ) : (
                          <StatusBadge label={refLabel(refs, "action_state", a.state)} color={refColor(refs, "action_state", a.state)} />
                        )}
                      </td>
                      {/* Heures de l'année, face à l'objectif ; l'objectif se modifie en cliquant sur le crayon. */}
                      <td className="py-1.5 pr-2"><TimeCell actionId={a.id} name={a.name} consumed={a.hoursYear} target={a.timeTarget} canEdit={rw} over={over} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Frise chronologique" description={`Une barre par ${V.action.one} de l'année, ses jalons et les livrables.`}>
        <Timeline year={e.year} actions={e.actions} deliverables={e.fundingLines.flatMap((fl) => fl.deliverables)} refs={refs} />
      </Section>

      {/* Objets vivants (revue du 15/09) : les réalisations se consignent au fil de l'eau ici, près des actions ; les indicateurs
          se mettent à jour au réel. La fiche les relit, le bilan les reprend. */}
      <div id="realisations" className="grid scroll-mt-20 gap-4 xl:grid-cols-2">
        <Section title="Réalisations au fil de l'année" description="Inscrits, publics, livrables produits : notez au fil de l'eau, ce sera le bilan." testId="achievements-section">
          <Achievements editionId={e.id} items={e.achievements.map((a) => ({ id: a.id, kind: a.kind, label: a.label, value: a.value, unit: a.unit, date: dayjs(a.date).format("YYYY-MM-DD"), author: a.author.name, authorId: a.authorId, action: a.action?.name ?? null }))} actions={e.actions.filter(attachable).map((a) => ({ id: a.id, name: a.name }))} canWrite={yearRw} meId={me.id} canDeleteAll={me.role === "director" || isPilot} />
        </Section>
        <Section title="Indicateurs" description="Cible fixée à la rédaction de la fiche, réalisé mis à jour dans l'année ; imposés par un financeur ou propres au projet.">
          <table className="mb-3 w-full text-sm" data-testid="indicators">
            <thead className="text-left text-[10px] font-semibold text-muted-foreground">
              <tr><th className="py-1">Indicateur</th><th className="w-24 py-1 text-right">Cible</th><th className="w-24 py-1 text-right">Réalisé</th><th className="w-16 py-1 text-center" title="Imposé par un financeur">Imposé</th></tr>
            </thead>
            <tbody className="divide-y">
              {e.indicators.map((i, n) => (
                <tr key={i.id}>
                  <td className="py-0.5">
                    <AutoField model="indicator" id={i.id} field="label" type="text" value={i.label} readOnly={!yearRw} />
                    {/* Son action (26/09) : l'indicateur se lit aussi sur la page de l'action. */}
                    <div className="flex items-center gap-1 pl-2 text-[11px] text-muted-foreground"><span className="shrink-0">{cap(V.action)}</span><AutoField model="indicator" id={i.id} field="actionId" type="select" value={i.actionId} options={attachOptions(e.actions, i.action)} readOnly={!yearRw} placeholder="—" refreshOnSave label={`${cap(V.action)}, ${i.label}`} testId={`indicator-action-${n}`} className="min-w-0 max-w-[220px] flex-1" inputClassName="text-[11px]" /></div>
                  </td>
                  <td className="py-0.5"><AutoField model="indicator" id={i.id} field="target" type="text" value={i.target} readOnly={!yearRw} inputClassName="text-right tabular" /></td>
                  <td className="py-0.5"><AutoField model="indicator" id={i.id} field="actual" type="text" value={i.actual} readOnly={!yearRw} inputClassName="text-right tabular font-medium" placeholder="—" /></td>
                  <td className="py-0.5 text-center"><AutoField model="indicator" id={i.id} field="imposed" type="bool" value={i.imposed} readOnly={!yearRw} /></td>
                </tr>
              ))}
              {e.indicators.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">Aucun indicateur.</td></tr>}
            </tbody>
          </table>
          {yearRw && <AddIndicatorForm editionId={e.id} />}
        </Section>
      </div>
    </div>
  );
}

