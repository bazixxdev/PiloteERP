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

export function ActionsTab({ e, me, refs, people, isPilot, isTeam }: TabCtx) {
  const writable = canEditActions(me.role, isPilot, isTeam, inMyPole(me, e.project));
  const yearRw = canWriteLayer(me.role, "year", isPilot, isTeam, inMyPole(me, e.project));
  const stateOpts = REF_DEFAULTS.action_state.map((s) => ({ value: s.code, label: refLabel(refs, "action_state", s.code) }));
  const ownerOpts = people.map((p) => ({ value: p.id, label: p.name }));
  const lineOpts = e.fundingLines.map((f) => ({ value: f.id, label: `${f.funder.name}${f.scheme ? " · " + f.scheme : ""}` }));
  const consumed = (actionId: string) => e.yearEntries.filter((t) => t.actionId === actionId).reduce((s, t) => s + t.hours, 0);

  return (
    <div className="grid gap-4">
      <Section title="Actions" description={`${e.actions.filter((a) => a.state !== "done").length} à mener sur ${e.actions.length}`} actions={writable ? <AddActionForm editionId={e.id} /> : undefined}>
        {e.actions.length === 0 ? (
          <EmptyState title="Aucune action" hint="Ajoutez la première action de cette édition : un nom, un responsable, un jalon." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm" data-testid="actions-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                <tr>
                  <th className="w-8 py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-2">Action</th>
                  <th className="py-1.5 pr-2">Responsable</th>
                  <th className="py-1.5 pr-2">Jalon</th>
                  <th className="py-1.5 pr-2">État</th>
                  <th className="min-w-[180px] py-1.5 pr-2" title="Heures saisies sur l'action, face à l'objectif fixé">Temps</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {e.actions.map((a, i) => {
                  const c = consumed(a.id);
                  const own = a.ownerId === me.id;
                  const rw = writable || own;
                  const over = a.timeTarget != null && c > a.timeTarget;
                  const lateMilestone = a.milestoneDate && a.state !== "done" && dayjs(a.milestoneDate).isBefore(dayjs(), "day");
                  return (
                    <tr key={a.id} className="group" data-testid={`action-row-${i}`}>
                      <td className="py-1 pr-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="min-w-[220px] py-1 pr-2">
                        <AutoField model="action" id={a.id} field="name" type="text" value={a.name} readOnly={!rw} testId={`action-name-${i}`} inputClassName="font-medium" label={`Nom de l'action ${i + 1}`} />
                        {/* Occurrence : contenu, lieu, participants (retour du 14/09, petits-déjeuners de l'Observatoire) ; « dupliquer » pour la suivante. */}
                        {/* Le détail de l'action s'ouvre en panneau latéral (revue du 15/09) ; le tableau reste lisible. */}
                        <ActionPanel actionId={a.id} name={a.name} index={i} canDuplicate={rw} hints={[a.fundingLine ? a.fundingLine.funder.name : null, a.isPublic ? "public" : null, a.tasks.length ? `${a.tasks.length} tâche${a.tasks.length > 1 ? "s" : ""}` : null].filter(Boolean) as string[]}>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="grid gap-0.5 sm:col-span-3"><span className="text-[10px] text-muted-foreground">Contenu</span><AutoField model="action" id={a.id} field="description" type="textarea" rows={2} value={a.description} readOnly={!rw} placeholder="Thème, déroulé…" testId={`action-description-${i}`} label={`Contenu, ${a.name}`} /></div>
                            <div className="grid gap-0.5"><span className="text-[10px] text-muted-foreground">Lieu</span><AutoField model="action" id={a.id} field="venue" type="text" value={a.venue} readOnly={!rw} placeholder="—" label={`Lieu, ${a.name}`} /></div>
                            <div className="grid gap-0.5 sm:col-span-2"><span className="text-[10px] text-muted-foreground">Participants, invités</span><AutoField model="action" id={a.id} field="participants" type="textarea" rows={2} value={a.participants} readOnly={!rw} placeholder="—" label={`Participants, ${a.name}`} /></div>
                            <div className="grid gap-0.5 sm:col-span-2"><span className="text-[10px] text-muted-foreground">Ligne de financement</span><AutoField model="action" id={a.id} field="fundingLineId" type="select" value={a.fundingLineId} options={lineOpts} readOnly={!rw} placeholder="— le projet, sans ligne dédiée —" label={`Ligne de financement, ${a.name}`} /></div>
                            <div className="flex items-end pb-1"><AutoField model="action" id={a.id} field="isPublic" type="bool" value={a.isPublic} readOnly={!rw} testId={`action-public-${i}`} label={`Événement public, ${a.name}`} placeholder="Événement public (agenda du site)" /></div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-[10px] font-semibold text-muted-foreground">Tâches en cours sur cette action</div>
                              {a.tasks.length === 0 ? <p className="text-xs text-muted-foreground">Aucune.</p> : <ul className="mt-1 divide-y text-xs">{a.tasks.map((t) => <li key={t.id} className="flex items-center justify-between gap-2 py-1"><span className="truncate">{t.label}</span><span className="shrink-0 text-muted-foreground">{t.person.name}{t.dueDate ? ` · ${dayjs(t.dueDate).format("D MMM")}` : ""}</span></li>)}</ul>}
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold text-muted-foreground">Temps saisi par personne</div>
                              {byPerson(a.timeEntries).length === 0 ? <p className="text-xs text-muted-foreground">Aucune heure saisie.</p> : <ul className="mt-1 divide-y text-xs">{byPerson(a.timeEntries).map(([pid, h]) => <li key={pid} className="flex items-center justify-between gap-2 py-1"><span>{people.find((p) => p.id === pid)?.name ?? "—"}</span><b className="tabular">{fmtNumber(h, 1)} h</b></li>)}</ul>}
                            </div>
                            <div className="sm:col-span-2">
                              <div className="text-[10px] font-semibold text-muted-foreground">Réalisations consignées</div>
                              {e.achievements.filter((x) => x.actionId === a.id).length === 0 ? <p className="text-xs text-muted-foreground">Aucune : consignez-les sous le tableau, en liant l'action.</p> : <ul className="mt-1 divide-y text-xs">{e.achievements.filter((x) => x.actionId === a.id).map((x) => <li key={x.id} className="py-1"><span className="text-muted-foreground">{dayjs(x.date).format("D MMM")} · </span>{x.value != null ? <b className="tabular">{x.value}{x.unit ? ` ${x.unit}` : ""} · </b> : null}{x.label}</li>)}</ul>}
                            </div>
                          </div>
                        </ActionPanel>
                      </td>
                      <td className="min-w-[150px] py-1 pr-2"><AutoField model="action" id={a.id} field="ownerId" type="select" value={a.ownerId} options={ownerOpts} readOnly={!rw} placeholder="—" label={`Responsable, ${a.name}`} /></td>
                      <td className="min-w-[150px] py-1 pr-2"><AutoField model="action" id={a.id} field="milestoneDate" type="date" value={a.milestoneDate} readOnly={!rw} inputClassName={cn(lateMilestone && "text-danger font-medium")} label={`Jalon, ${a.name}`} placeholder="—" /></td>
                      <td className="min-w-[130px] py-1 pr-2">
                        {lateMilestone && <span className="mb-0.5 inline-block rounded-sm bg-danger-soft px-1.5 text-[10px] font-medium text-danger" data-testid={`action-late-${i}`}>en retard</span>}
                        {rw ? (
                          <AutoField model="action" id={a.id} field="state" type="select" value={a.state} options={stateOpts} allowEmpty={false} refreshOnSave testId={`action-state-${i}`} label={`État, ${a.name}`} />
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

function Timeline({ year, actions, refs }: { year: number; actions: TabCtx["e"]["actions"]; refs: TabCtx["refs"] }) {
  const start = dayjs(`${year}-01-01`);
  const total = dayjs(`${year + 1}-01-01`).diff(start, "day");
  const today = dayjs();
  const todayPct = today.year() === year ? (today.diff(start, "day") / total) * 100 : null;
  const dated = actions.filter((a) => a.milestoneDate);
  if (dated.length === 0) return <p className="text-sm text-muted-foreground">Aucun jalon daté pour l'instant.</p>;
  const colorOf = (state: string) => ({ done: "bg-mint/50", doing: "bg-primary", todo: "bg-muted-foreground/40" }[state] ?? "bg-muted-foreground/40");
  return (
    <div className="relative" data-testid="timeline">
      <div className="mb-1 grid grid-cols-12 text-center text-[10px] font-semibold text-muted-foreground">
        {MONTHS.map((m, i) => <div key={i} className="border-l first:border-l-0">{m}</div>)}
      </div>
      <div className="relative mt-4">
        {todayPct !== null && <div className="absolute top-0 bottom-0 z-10 w-px bg-coral" style={{ left: `${todayPct}%` }} title="Aujourd'hui"><span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-coral">aujourd'hui</span></div>}
        {dated.map((a) => {
          const pct = Math.min(100, Math.max(0, (dayjs(a.milestoneDate!).diff(start, "day") / total) * 100));
          return (
            <div key={a.id} className="relative h-7 border-t border-dashed border-border/70">
              <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${pct}% - 6px)` }}>
                <div className={cn("size-3 rounded-full ring-2 ring-card", a.state !== "done" && dayjs(a.milestoneDate!).isBefore(dayjs(), "day") ? "bg-danger" : colorOf(a.state))} />
              </div>
              <div className={cn("absolute top-1/2 -translate-y-1/2 truncate text-xs", a.state === "done" && "text-muted-foreground")} style={{ left: pct > 70 ? undefined : `calc(${pct}% + 10px)`, right: pct > 70 ? `calc(${100 - pct}% + 10px)` : undefined, maxWidth: "40%" }}>
                {a.name} <span className="text-muted-foreground">· {dayjs(a.milestoneDate!).format("D MMM")} · {refLabel(refs, "action_state", a.state)}</span>{a.state !== "done" && dayjs(a.milestoneDate!).isBefore(dayjs(), "day") && <span className="ml-1 rounded-sm bg-danger-soft px-1.5 text-[10px] font-medium text-danger">en retard</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
