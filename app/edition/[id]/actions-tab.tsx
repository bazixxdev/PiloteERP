import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { canEditActions } from "@/lib/rights";
import { dayjs, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { AddActionForm } from "./add-forms";

export function ActionsTab({ e, me, refs, people, isPilot, isTeam }: TabCtx) {
  const writable = canEditActions(me.role, isPilot, isTeam, e.project.poleId === me.poleId);
  const stateOpts = REF_DEFAULTS.action_state.map((s) => ({ value: s.code, label: refLabel(refs, "action_state", s.code) }));
  const ownerOpts = people.map((p) => ({ value: p.id, label: p.name }));
  const lineOpts = e.fundingLines.map((f) => ({ value: f.id, label: `${f.funder.name}${f.scheme ? " · " + f.scheme : ""}` }));
  const consumed = (actionId: string) => e.yearEntries.filter((t) => t.actionId === actionId).reduce((s, t) => s + t.hours, 0);

  return (
    <div className="grid gap-4">
      <Section title="Actions" description="Édition en ligne : cliquez dans une cellule, la sauvegarde est automatique." actions={writable ? <AddActionForm editionId={e.id} /> : undefined}>
        {e.actions.length === 0 ? (
          <EmptyState title="Aucune action" hint="Ajoutez la première action de cette édition : un nom, un responsable, un jalon." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="actions-table">
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8 py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-2">Action</th>
                  <th className="py-1.5 pr-2">Responsable</th>
                  <th className="py-1.5 pr-2">Jalon</th>
                  <th className="py-1.5 pr-2 text-right">Objectif (h)</th>
                  <th className="py-1.5 pr-2 text-right">Consommé</th>
                  <th className="py-1.5 pr-2">État</th>
                  <th className="py-1.5 pr-2">Ligne de financement</th>
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
                      <td className="min-w-[220px] py-1 pr-2"><AutoField model="action" id={a.id} field="name" type="text" value={a.name} readOnly={!rw} testId={`action-name-${i}`} inputClassName="font-medium" /></td>
                      <td className="min-w-[150px] py-1 pr-2"><AutoField model="action" id={a.id} field="ownerId" type="select" value={a.ownerId} options={ownerOpts} readOnly={!rw} placeholder="—" /></td>
                      <td className="min-w-[140px] py-1 pr-2"><AutoField model="action" id={a.id} field="milestoneDate" type="date" value={a.milestoneDate} readOnly={!rw} inputClassName={cn(lateMilestone && "text-danger font-medium")} /></td>
                      <td className="w-28 py-1 pr-2"><AutoField model="action" id={a.id} field="timeTarget" type="number" value={a.timeTarget} readOnly={!rw} suffix="h" /></td>
                      <td className={cn("w-24 py-1 pr-2 text-right tabular", over && "font-semibold text-danger")}>{fmtNumber(c, 0)} h</td>
                      <td className="min-w-[130px] py-1 pr-2">
                        {rw ? (
                          <AutoField model="action" id={a.id} field="state" type="select" value={a.state} options={stateOpts} allowEmpty={false} refreshOnSave testId={`action-state-${i}`} />
                        ) : (
                          <StatusBadge label={refLabel(refs, "action_state", a.state)} color={refColor(refs, "action_state", a.state)} />
                        )}
                      </td>
                      <td className="min-w-[160px] py-1 pr-2"><AutoField model="action" id={a.id} field="fundingLineId" type="select" value={a.fundingLineId} options={lineOpts} readOnly={!rw} placeholder="— projet —" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Timeline" description={`Jalons datés de l'année ${e.year}, sans dépendances.`}>
        <Timeline year={e.year} actions={e.actions} refs={refs} />
      </Section>
    </div>
  );
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function Timeline({ year, actions, refs }: { year: number; actions: TabCtx["e"]["actions"]; refs: TabCtx["refs"] }) {
  const start = dayjs(`${year}-01-01`);
  const total = dayjs(`${year + 1}-01-01`).diff(start, "day");
  const today = dayjs();
  const todayPct = today.year() === year ? (today.diff(start, "day") / total) * 100 : null;
  const dated = actions.filter((a) => a.milestoneDate);
  if (dated.length === 0) return <p className="text-sm text-muted-foreground">Aucun jalon daté pour l'instant.</p>;
  const colorOf = (state: string) => ({ done: "bg-mint", doing: "bg-primary", late: "bg-danger", todo: "bg-muted-foreground/40" }[state] ?? "bg-muted-foreground/40");
  return (
    <div className="relative" data-testid="timeline">
      <div className="mb-1 grid grid-cols-12 text-center text-[10px] font-semibold text-muted-foreground">
        {MONTHS.map((m, i) => <div key={i} className="border-l first:border-l-0">{m}</div>)}
      </div>
      <div className="relative">
        {todayPct !== null && <div className="absolute top-0 bottom-0 z-10 w-px bg-coral" style={{ left: `${todayPct}%` }} title="Aujourd'hui" />}
        {dated.map((a) => {
          const pct = Math.min(100, Math.max(0, (dayjs(a.milestoneDate!).diff(start, "day") / total) * 100));
          return (
            <div key={a.id} className="relative h-7 border-t border-dashed border-border/70">
              <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${pct}% - 6px)` }}>
                <div className={cn("size-3 rounded-full ring-2 ring-card", colorOf(a.state))} />
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 truncate text-xs" style={{ left: pct > 70 ? undefined : `calc(${pct}% + 10px)`, right: pct > 70 ? `calc(${100 - pct}% + 10px)` : undefined, maxWidth: "40%" }}>
                {a.name} <span className="text-muted-foreground">· {dayjs(a.milestoneDate!).format("D MMM")} · {refLabel(refs, "action_state", a.state)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
