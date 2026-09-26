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
import { milestoneTitle, spanLabel } from "@/lib/actions";
import { V, cap, le, ce, aucun, pl } from "@/lib/vocab";

export function ActionsTab({ e, me, refs, people, isPilot, isTeam }: TabCtx) {
  const writable = canEditActions(me, isPilot, isTeam, inMyPole(me, e.project));
  const yearRw = canWriteLayer(me, "year", isPilot, isTeam, inMyPole(me, e.project));
  const stateOpts = REF_DEFAULTS.action_state.map((s) => ({ value: s.code, label: refLabel(refs, "action_state", s.code) }));
  const ownerOpts = people.map((p) => ({ value: p.id, label: p.name }));

  // Le tableau se lit ; le détail (contenu, période, jalons, personnes, tâches, heures) est sur la page de l'action.
  return (
    <div className="grid gap-4">
      <Section title={cap(pl(V.action))} description={`${e.actions.filter((a) => a.state !== "done" && a.state !== "abandoned").length} à mener sur ${e.actions.length}`} actions={writable ? <AddActionForm editionId={e.id} year={e.year} /> : undefined}>
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
                  const lateMilestone = Boolean(next && a.state !== "done" && a.state !== "abandoned" && dayjs(next.date).isBefore(dayjs(), "day"));
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

      <Section title="Frise chronologique" description={`Jalons datés de l'année ${e.year}, sans dépendances.`}>
        <Timeline year={e.year} actions={e.actions} refs={refs} />
      </Section>

      {/* Objets vivants (revue du 15/09) : les réalisations se consignent au fil de l'eau ici, près des actions ; les indicateurs
          se mettent à jour au réel. La fiche les relit, le bilan les reprend. */}
      <div id="realisations" className="grid scroll-mt-20 gap-4 xl:grid-cols-2">
        <Section title="Réalisations au fil de l'année" description="Inscrits, publics, livrables produits : notez au fil de l'eau, ce sera le bilan." testId="achievements-section">
          <Achievements editionId={e.id} items={e.achievements.map((a) => ({ id: a.id, kind: a.kind, label: a.label, value: a.value, unit: a.unit, date: dayjs(a.date).format("YYYY-MM-DD"), author: a.author.name, authorId: a.authorId, action: a.action?.name ?? null }))} actions={e.actions.map((a) => ({ id: a.id, name: a.name }))} canWrite={yearRw} meId={me.id} canDeleteAll={me.role === "director" || isPilot} />
        </Section>
        <Section title="Indicateurs" description="Cible fixée à la rédaction de la fiche, réalisé mis à jour dans l'année ; imposés par un financeur ou propres au projet.">
          <table className="mb-3 w-full text-sm" data-testid="indicators">
            <thead className="text-left text-[10px] font-semibold text-muted-foreground">
              <tr><th className="py-1">Indicateur</th><th className="w-24 py-1 text-right">Cible</th><th className="w-24 py-1 text-right">Réalisé</th><th className="w-16 py-1 text-center" title="Imposé par un financeur">Imposé</th></tr>
            </thead>
            <tbody className="divide-y">
              {e.indicators.map((i) => (
                <tr key={i.id}>
                  <td className="py-0.5"><AutoField model="indicator" id={i.id} field="label" type="text" value={i.label} readOnly={!yearRw} /></td>
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

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// Frise provisoire (la frise par action vient avec la tâche 8) : un point par jalon de l'année, au nom de l'action.
function Timeline({ year, actions, refs }: { year: number; actions: TabCtx["e"]["actions"]; refs: TabCtx["refs"] }) {
  const start = dayjs(`${year}-01-01`);
  const total = dayjs(`${year + 1}-01-01`).diff(start, "day");
  const today = dayjs();
  const todayPct = today.year() === year ? (today.diff(start, "day") / total) * 100 : null;
  const dated = actions.flatMap((a) => a.milestones.filter((m) => dayjs(m.date).year() === year).map((m) => ({ id: m.id, name: milestoneTitle(a.name, m.label), date: m.date, state: m.done ? "done" : a.state, late: !m.done && a.state !== "done" && a.state !== "abandoned" && dayjs(m.date).isBefore(dayjs(), "day") })))
    .sort((x, y) => x.date.getTime() - y.date.getTime());
  if (dated.length === 0) return <p className="text-sm text-muted-foreground">Aucun jalon daté pour l'instant.</p>;
  const colorOf = (state: string) => ({ done: "bg-mint/50", doing: "bg-primary", todo: "bg-muted-foreground/40" }[state] ?? "bg-muted-foreground/40");
  return (
    <div className="relative" data-testid="timeline">
      <div className="mb-1 grid grid-cols-12 text-center text-[10px] font-semibold text-muted-foreground">
        {MONTHS.map((m, i) => <div key={i} className="border-l first:border-l-0">{m}</div>)}
      </div>
      <div className="relative mt-4">
        {todayPct !== null && <div className="absolute top-0 bottom-0 z-10 w-px bg-coral" style={{ left: `${todayPct}%` }} title="Aujourd'hui"><span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-coral">aujourd'hui</span></div>}
        {dated.map((m) => {
          const pct = Math.min(100, Math.max(0, (dayjs(m.date).diff(start, "day") / total) * 100));
          return (
            <div key={m.id} className="relative h-7 border-t border-dashed border-border/70">
              <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${pct}% - 6px)` }}>
                <div className={cn("size-3 rounded-full ring-2 ring-card", m.late ? "bg-danger" : colorOf(m.state))} />
              </div>
              <div className={cn("absolute top-1/2 -translate-y-1/2 truncate text-xs", m.state === "done" && "text-muted-foreground")} style={{ left: pct > 70 ? undefined : `calc(${pct}% + 10px)`, right: pct > 70 ? `calc(${100 - pct}% + 10px)` : undefined, maxWidth: "40%" }}>
                {m.name} <span className="text-muted-foreground">· {dayjs(m.date).format("D MMM")} · {refLabel(refs, "action_state", m.state)}</span>{m.late && <span className="ml-1 rounded-sm bg-danger-soft px-1.5 text-[10px] font-medium text-danger">en retard</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
