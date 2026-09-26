import { dayjs, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { beforeDay, milestoneTitle } from "@/lib/actions";
import { refLabel, type RefMap } from "@/lib/refs";
import { V, cap, aucun } from "@/lib/vocab";
import type { YearAction } from "@/lib/actions-db";

type Deliverable = { id: string; label: string; dueDate: Date; done: boolean };

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const ROW_HEIGHT = 28;

const BAR_COLOR: Record<string, string> = {
  done: "bg-mint/50",
  doing: "bg-primary/60",
  todo: "bg-muted-foreground/30",
};
// Abandonnée : même base que le badge (bg-muted), hachurée comme le sélecteur « aucune couleur » (app/notes/color-picker.tsx).
const HATCH = { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 4px, var(--muted-foreground) 4px 5px)" };

// La frise par action (spec 2026-09-26, tâche 8) : une barre par action de l'année, ses jalons de l'année en points, et les
// livrables de l'année en losanges sur une dernière ligne. Même grille de 12 mois et trait « aujourd'hui » que l'ancienne
// frise (un point par jalon) ; ici chaque ligne porte une action, pas un jalon.
export function Timeline({ year, actions, deliverables, refs }: { year: number; actions: YearAction[]; deliverables: Deliverable[]; refs: RefMap }) {
  const start = dayjs(`${year}-01-01`);
  const end = dayjs(`${year}-12-31`);
  const total = dayjs(`${year + 1}-01-01`).diff(start, "day");
  const today = dayjs();
  const todayPct = today.year() === year ? (today.diff(start, "day") / total) * 100 : null;
  const pctOf = (d: Date) => Math.min(100, Math.max(0, (dayjs(d).diff(start, "day") / total) * 100));
  // Livrables de l'année seulement (comme les jalons) : une ligne de financement pluriannuelle porte des livrables sur
  // plusieurs années ; sans ce filtre, un livrable de l'année suivante s'affichait plaqué au 31 décembre.
  const yearDeliverables = deliverables.filter((d) => dayjs(d.dueDate).year() === year);

  if (actions.length === 0) return <p className="text-sm text-muted-foreground" data-testid="timeline">{cap(aucun(V.action))} cette année.</p>;

  return (
    <div className="overflow-x-auto" data-testid="timeline">
      <div className="min-w-[560px]">
        <div className="mb-1 grid grid-cols-12 text-center text-[10px] font-semibold text-muted-foreground">
          {MONTHS.map((m, i) => <div key={i} className="border-l first:border-l-0">{m}</div>)}
        </div>
        <div className="relative mt-4">
          {todayPct !== null && (
            <div className="absolute top-0 bottom-0 z-10 w-px bg-coral" style={{ left: `${todayPct}%` }} title="Aujourd'hui">
              <span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-coral">aujourd&apos;hui</span>
            </div>
          )}
          {actions.map((a, i) => {
            const overflowsBefore = dayjs(a.startDate).isBefore(start, "day");
            const overflowsAfter = dayjs(a.endDate).isAfter(end, "day");
            const barStart = overflowsBefore ? 0 : pctOf(a.startDate);
            const barEnd = overflowsAfter ? 100 : pctOf(a.endDate);
            const width = Math.max(barEnd - barStart, 1.5);
            const yearMilestones = a.milestones.filter((m) => dayjs(m.date).year() === year);
            const stateLabel = refLabel(refs, "action_state", a.state);
            const barLabel = `${a.name} · ${fmtDate(a.startDate)} – ${fmtDate(a.endDate)} · ${stateLabel}`;
            // Le nom se loge à côté de la barre, du côté qui a la place ; une barre qui occupe (presque) toute la largeur
            // n'a de place ni à droite ni à gauche : le nom se lit alors dedans, comme un étiquette de tâche.
            const rightSpace = 100 - barEnd;
            const leftSpace = barStart;
            const namePlacement = rightSpace >= 12 ? "right" : leftSpace >= 12 ? "left" : "inside";
            return (
              <div key={a.id} className="relative border-t border-dashed border-border/70" style={{ height: ROW_HEIGHT }} data-testid={`timeline-row-${i}`}>
                <div
                  className={cn("absolute top-1/2 flex h-3.5 items-center -translate-y-1/2 rounded-sm", a.state === "abandoned" ? "bg-muted" : (BAR_COLOR[a.state] ?? BAR_COLOR.todo))}
                  style={{ left: `${barStart}%`, width: `${width}%`, ...(a.state === "abandoned" ? HATCH : {}) }}
                  title={barLabel}
                  aria-label={barLabel}
                  data-testid={`timeline-bar-${i}`}
                >
                  {overflowsBefore && (
                    <span aria-hidden className="absolute left-0.5 flex size-3 items-center justify-center rounded-full bg-card text-[9px] font-bold text-foreground shadow-sm" data-testid={`timeline-bar-${i}-before`}>◂</span>
                  )}
                  {namePlacement === "inside" && (
                    <span
                      className="truncate rounded-sm bg-card/75 px-1 text-[11px] font-medium text-foreground shadow-sm"
                      style={{ marginLeft: overflowsBefore ? 16 : 6, marginRight: overflowsAfter ? 16 : 6 }}
                      title={a.name}
                    >
                      {a.name}
                    </span>
                  )}
                  {overflowsAfter && (
                    <span aria-hidden className="absolute right-0.5 flex size-3 items-center justify-center rounded-full bg-card text-[9px] font-bold text-foreground shadow-sm" data-testid={`timeline-bar-${i}-after`}>▸</span>
                  )}
                </div>
                {namePlacement !== "inside" && (
                  <div
                    className="absolute top-1/2 max-w-[40%] -translate-y-1/2 truncate text-[11px]"
                    style={namePlacement === "right" ? { left: `calc(${barEnd}% + 8px)` } : { right: `calc(${100 - barStart}% + 8px)` }}
                    title={a.name}
                  >
                    {a.name}
                  </div>
                )}
                {yearMilestones.map((m) => {
                  const late = !m.done && beforeDay(m.date, new Date());
                  const pct = pctOf(m.date);
                  const mLabel = `${milestoneTitle(a.name, m.label)} · ${fmtDate(m.date)}${late ? " · en retard" : m.done ? " · fait" : ""}`;
                  return (
                    <div key={m.id} className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${pct}% - 5px)` }}>
                      <div
                        className={cn("size-2.5 rounded-full ring-2 ring-card", late ? "bg-danger" : m.done ? "bg-mint" : "bg-primary")}
                        title={mLabel}
                        aria-label={mLabel}
                        data-overdue={late || undefined}
                        data-testid={`timeline-milestone-${i}-${m.id}`}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
          {yearDeliverables.length > 0 && (
            <div className="relative border-t" style={{ height: ROW_HEIGHT }} data-testid="timeline-deliverables">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">Livrables</div>
              {yearDeliverables.map((d, di) => {
                const late = !d.done && beforeDay(d.dueDate, new Date());
                const pct = pctOf(d.dueDate);
                const dLabel = `${d.label} · ${fmtDate(d.dueDate)}${late ? " · en retard" : d.done ? " · fait" : ""}`;
                return (
                  <div key={d.id} className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${pct}% - 5px)` }}>
                    <div
                      className={cn("size-2.5 rotate-45 ring-2 ring-card", late ? "bg-danger" : d.done ? "bg-mint" : "bg-muted-foreground/50")}
                      title={dLabel}
                      aria-label={dLabel}
                      data-overdue={late || undefined}
                      data-testid={`timeline-deliverable-${di}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
