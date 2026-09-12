import { Section } from "@/components/common/section";
import { Gauge } from "@/components/common/gauge";
import { canSeeTimeOf } from "@/lib/rights";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";

export function TempsTab({ e, me, settings, people }: TabCtx) {
  const byAction = new Map<string | null, number>();
  const byPerson = new Map<string, number>();
  for (const t of e.yearEntries) {
    byAction.set(t.actionId, (byAction.get(t.actionId) ?? 0) + t.hours);
    byPerson.set(t.personId, (byPerson.get(t.personId) ?? 0) + t.hours);
  }
  const total = e.yearEntries.reduce((s, t) => s + t.hours, 0);
  const target = e.actions.reduce((s, a) => s + (a.timeTarget ?? 0), 0);
  const noAction = byAction.get(null) ?? 0;
  const visiblePeople = [...byPerson.entries()]
    .map(([id, h]) => ({ p: people.find((x) => x.id === id), h }))
    .filter((x) => x.p && canSeeTimeOf(me, x.p, settings.timeVisibility))
    .sort((a, b) => b.h - a.h);
  const hidden = byPerson.size - visiblePeople.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Section title={`Temps consommé / objectif · ${e.year}`} description="Le temps saisi sur le projet pendant l'année, par action.">
        <div className="mb-4 flex items-center gap-4 rounded-xl bg-muted/50 p-3">
          <div>
            <div className="text-2xl font-bold tabular">{fmtNumber(total, 0)} h</div>
            <div className="text-xs text-muted-foreground">consommées sur {target ? `${fmtNumber(target, 0)} h prévues` : "un objectif non fixé"} · {fmtNumber(total / 7, 1)} jours</div>
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

      <Section title="Par personne" description={hidden > 0 ? `${hidden} personne${hidden > 1 ? "s" : ""} masquée${hidden > 1 ? "s" : ""} selon la visibilité du temps.` : "Selon la visibilité réglée dans l'admin."}>
        {visiblePeople.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun temps visible pour vous.</p>
        ) : (
          <ul className="divide-y text-sm">
            {visiblePeople.map(({ p, h }) => (
              <li key={p!.id} className="flex items-center justify-between py-1.5">
                <span>{p!.name}</span>
                <span className="tabular text-muted-foreground">{fmtNumber(h, 1)} h · {fmtNumber(h / 7, 1)} j</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
