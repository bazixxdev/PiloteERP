import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { canEditActions, canWriteLayer } from "@/lib/rights";
import { dayjs, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { inMyPole } from "@/lib/scope";
import { AddActionForm, AddIndicatorForm } from "./add-forms";
import { Achievements } from "./achievements";
import { ActionPanel } from "./action-extras";
import { TimeCell } from "./time-cell";
import { NextMilestoneCell } from "./next-milestone-cell";
import { milestoneTitle } from "@/lib/actions";
import { V, cap, le, du, ce, aucun, pl } from "@/lib/vocab";

export function ActionsTab({ e, me, refs, people, isPilot, isTeam }: TabCtx) {
  const writable = canEditActions(me, isPilot, isTeam, inMyPole(me, e.project));
  const yearRw = canWriteLayer(me, "year", isPilot, isTeam, inMyPole(me, e.project));
  // « abandoned » (26/09) existe en base mais ne se choisit pas encore ici : ses règles viennent avec la page de l'action.
  const stateOpts = REF_DEFAULTS.action_state.filter((s) => s.code !== "abandoned").map((s) => ({ value: s.code, label: refLabel(refs, "action_state", s.code) }));
  const ownerOpts = people.map((p) => ({ value: p.id, label: p.name }));
  const consumed = (actionId: string) => e.yearEntries.filter((t) => t.actionId === actionId).reduce((s, t) => s + t.hours, 0);

  return (
    <div className="grid gap-4">
      <Section title={cap(pl(V.action))} description={`${e.actions.filter((a) => a.state !== "done").length} à mener sur ${e.actions.length}`} actions={writable ? <AddActionForm editionId={e.id} /> : undefined}>
        {e.actions.length === 0 ? (
          <EmptyState title={cap(aucun(V.action))} hint={`Ajoutez la première ${V.action.one} de ${ce(V.edition)} : un nom, un responsable, un jalon.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm" data-testid="actions-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                <tr>
                  <th className="w-8 py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-2">{cap(V.action)}</th>
                  <th className="py-1.5 pr-2">Responsable</th>
                  <th className="py-1.5 pr-2">Prochain jalon</th>
                  <th className="py-1.5 pr-2">État</th>
                  <th className="min-w-[180px] py-1.5 pr-2" title={`Heures saisies sur ${le(V.action)}, face à l'objectif fixé`}>Temps</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {e.actions.map((a, i) => {
                  const c = consumed(a.id);
                  const own = a.ownerId === me.id;
                  const rw = writable || own;
                  const over = a.timeTarget != null && c > a.timeTarget;
                  const next = a.milestones.find((m) => !m.done) ?? null;
                  const lateMilestone = Boolean(next && a.state !== "done" && a.state !== "abandoned" && dayjs(next.date).isBefore(dayjs(), "day"));
                  return (
                    <tr key={a.id} className="group" data-testid={`${V.action.one}-row-${i}`}>
                      <td className="py-1 pr-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="min-w-[220px] py-1 pr-2">
                        <AutoField model="action" id={a.id} field="name" type="text" value={a.name} readOnly={!rw} testId={`${V.action.one}-name-${i}`} inputClassName="font-medium" label={`Nom ${du(V.action)} ${i + 1}`} />
                        {/* Occurrence : contenu, lieu, participants (retour du 14/09, petits-déjeuners de l'Observatoire). */}
                        {/* Le détail de l'action s'ouvre en panneau latéral (revue du 15/09) ; le tableau reste lisible. */}
                        <ActionPanel name={a.name} index={i} hints={[[...new Set(a.fundings.map((f) => f.fundingLine.funder.name))].join(", ") || null, a.milestones.some((m) => m.isPublic) ? "public" : null, a.tasks.length ? `${a.tasks.length} tâche${a.tasks.length > 1 ? "s" : ""}` : null].filter(Boolean) as string[]}>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="grid gap-0.5 sm:col-span-3"><span className="text-[10px] text-muted-foreground">Contenu</span><AutoField model="action" id={a.id} field="description" type="textarea" rows={2} value={a.description} readOnly={!rw} placeholder="Thème, déroulé…" testId={`${V.action.one}-description-${i}`} label={`Contenu, ${a.name}`} /></div>
                            {/* Lieu, participants et « public » sont portés par les jalons, le financement par les liens de l'action (26/09) :
                                lecture seule ici en attendant la page de l'action ; plus aucun contrôle de l'ancien modèle. */}
                            <div className="grid gap-0.5 sm:col-span-2"><span className="text-[10px] text-muted-foreground">Financement</span><span className="px-2 py-1 text-sm" data-testid={`${V.action.one}-funders-${i}`}>{[...new Set(a.fundings.map((f) => f.fundingLine.funder.name))].join(", ") || "le projet, sans ligne dédiée"}</span></div>
                            <div className="grid gap-0.5"><span className="text-[10px] text-muted-foreground">Agenda du site</span><span className="px-2 py-1 text-sm" data-testid={`${V.action.one}-public-${i}`}>{a.milestones.some((m) => m.isPublic) ? "jalon public" : "non publié"}</span></div>
                            {a.milestones.some((m) => m.venue || m.participants || m.isPublic) && (
                              <ul className="grid gap-0.5 text-xs text-muted-foreground sm:col-span-3">
                                {a.milestones.filter((m) => m.venue || m.participants || m.isPublic).map((m) => <li key={m.id}>{`${dayjs(m.date).format("D MMM YYYY")} · ${m.label}${m.venue ? ` · ${m.venue}` : ""}${m.participants ? ` · ${m.participants}` : ""}${m.isPublic ? " · public" : ""}`}</li>)}
                              </ul>
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-[10px] font-semibold text-muted-foreground">{`Tâches en cours sur ${ce(V.action)}`}</div>
                              {a.tasks.length === 0 ? <p className="text-xs text-muted-foreground">Aucune.</p> : <ul className="mt-1 divide-y text-xs">{a.tasks.map((t) => <li key={t.id} className="flex items-center justify-between gap-2 py-1"><span className="truncate">{t.label}</span><span className="shrink-0 text-muted-foreground">{t.person.name}{t.dueDate ? ` · ${dayjs(t.dueDate).format("D MMM")}` : ""}</span></li>)}</ul>}
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold text-muted-foreground">Temps saisi par personne</div>
                              {byPerson(e.yearEntries.filter((t) => t.actionId === a.id)).length === 0 ? <p className="text-xs text-muted-foreground">Aucune heure saisie.</p> : <ul className="mt-1 divide-y text-xs">{byPerson(e.yearEntries.filter((t) => t.actionId === a.id)).map(([pid, h]) => <li key={pid} className="flex items-center justify-between gap-2 py-1"><span>{people.find((p) => p.id === pid)?.name ?? "—"}</span><b className="tabular">{fmtNumber(h, 1)} h</b></li>)}</ul>}
                            </div>
                            <div className="sm:col-span-2">
                              <div className="text-[10px] font-semibold text-muted-foreground">Réalisations consignées</div>
                              {e.achievements.filter((x) => x.actionId === a.id).length === 0 ? <p className="text-xs text-muted-foreground">{`Aucune : consignez-les sous le tableau, en liant ${le(V.action)}.`}</p> : <ul className="mt-1 divide-y text-xs">{e.achievements.filter((x) => x.actionId === a.id).map((x) => <li key={x.id} className="py-1"><span className="text-muted-foreground">{dayjs(x.date).format("D MMM")} · </span>{x.value != null ? <b className="tabular">{x.value}{x.unit ? ` ${x.unit}` : ""} · </b> : null}{x.label}</li>)}</ul>}
                            </div>
                          </div>
                        </ActionPanel>
                      </td>
                      <td className="min-w-[150px] py-1 pr-2"><AutoField model="action" id={a.id} field="ownerId" type="select" value={a.ownerId} options={ownerOpts} readOnly={!rw} placeholder="—" label={`Responsable, ${a.name}`} /></td>
                      <td className="min-w-[150px] py-1 pr-2"><NextMilestoneCell actionId={a.id} actionName={a.name} date={next?.date ?? null} label={next?.label ?? null} lastDone={a.milestones.filter((m) => m.done).at(-1)?.date ?? null} late={lateMilestone} readOnly={!rw} /></td>
                      <td className="min-w-[130px] py-1 pr-2">
                        {lateMilestone && <span className="mb-0.5 inline-block rounded-sm bg-danger-soft px-1.5 text-[10px] font-medium text-danger" data-testid={`${V.action.one}-late-${i}`}>en retard</span>}
                        {rw ? (
                          <AutoField model="action" id={a.id} field="state" type="select" value={a.state} options={stateOpts} allowEmpty={false} refreshOnSave testId={`${V.action.one}-state-${i}`} label={`État, ${a.name}`} />
                        ) : (
                          <StatusBadge label={refLabel(refs, "action_state", a.state)} color={refColor(refs, "action_state", a.state)} />
                        )}
                      </td>
                      {/* Une colonne Temps compacte : consommé / objectif, avec sa jauge ; l'objectif se modifie en cliquant sur le crayon. */}
                      <td className="py-1 pr-2"><TimeCell actionId={a.id} name={a.name} consumed={c} target={a.timeTarget} canEdit={rw} over={over} /></td>
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

// Heures d'une action par personne, décroissantes.
function byPerson(entries: { hours: number; personId: string }[]): [string, number][] {
  const m = new Map<string, number>();
  for (const t of entries) m.set(t.personId, (m.get(t.personId) ?? 0) + t.hours);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

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
