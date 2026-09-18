import { Section } from "@/components/common/section";
import { AutoField } from "@/components/inline/auto-field";
import { daysFromNow, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DeliverableDone } from "./deliverable-done";
import type { TabCtx } from "./types";
import { V, au } from "@/lib/vocab";

// Une seule liste des livrables à remettre pour l'édition, toutes lignes confondues, par date (revue du 15/09) :
// remplace la colonne « Rappels » et évite de chercher ligne par ligne. Les livrables remis se replient.
export function DeliverablesList({ e, settings, canTick, canEdit, compact }: Pick<TabCtx, "e" | "settings"> & { canTick: boolean; canEdit: boolean; compact?: boolean }) {
  const all = e.fundingLines.flatMap((f) => f.deliverables.map((d) => ({ ...d, funder: f.funder.name, n: daysFromNow(d.dueDate) })));
  const todo = all.filter((d) => !d.done).sort((a, b) => a.n - b.n);
  const done = all.filter((d) => d.done).sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0));
  const late = todo.filter((d) => d.n < 0).length;
  const status = (d: (typeof all)[number]) => (
    <span className={cn("shrink-0 text-right text-xs whitespace-nowrap", d.done ? "text-mint" : d.n < 0 ? "font-semibold text-danger" : d.n <= settings.deliverableAlertDays ? "text-warning-foreground" : "text-muted-foreground")}>
      {d.done ? `remis ${fmtDate(d.doneAt)}` : d.n < 0 ? `${-d.n} j de retard` : d.n === 0 ? "aujourd'hui" : `J-${d.n}`}
    </span>
  );
  // En compact (Aperçu, demi-colonne), le libellé garde toute la largeur et financeur + date passent dessous : tronqué à
  // « Rapp… », le livrable ne dit plus rien (critique du 16/09).
  const row = (d: (typeof all)[number]) => compact ? (
    <li key={d.id} className="flex items-start gap-2 py-1.5 text-sm" data-testid={`deliverable-${d.id}`}>
      <DeliverableDone id={d.id} done={d.done} readOnly={!canTick} />
      <div className="min-w-0 flex-1 px-2">
        <span className={cn("block", d.done && "line-through text-muted-foreground")}>{d.label}</span>
        <small className="block text-[11px] text-muted-foreground">{d.funder} · {fmtDate(d.dueDate)}</small>
      </div>
      {status(d)}
    </li>
  ) : (
    <li key={d.id} className="flex items-center gap-2 py-1.5 text-sm" data-testid={`deliverable-${d.id}`}>
      <DeliverableDone id={d.id} done={d.done} readOnly={!canTick} />
      <div className="min-w-0 flex-1">
        {canEdit ? <AutoField model="deliverable" id={d.id} field="label" type="text" value={d.label} inputClassName={cn(d.done && "line-through text-muted-foreground")} label={`Livrable, ${d.funder}`} /> : <span className={cn("block px-2", d.done && "line-through text-muted-foreground")}>{d.label}</span>}
      </div>
      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={d.funder}>{d.funder}</span>
      {canEdit ? <div className="w-36 shrink-0"><AutoField model="deliverable" id={d.id} field="dueDate" type="date" value={d.dueDate} label={`Échéance du livrable ${d.label}`} /></div> : <span className="w-24 shrink-0 text-xs tabular text-muted-foreground">{fmtDate(d.dueDate)}</span>}
      <span className="w-24 shrink-0 text-right">{status(d)}</span>
    </li>
  );
  const body = (
    <>
      {todo.length === 0 ? <p className="text-sm text-muted-foreground">Rien à remettre : tous les livrables financeurs sont rendus{all.length === 0 ? " (aucun livrable renseigné)" : ""}.</p> : <ul className="divide-y" data-testid="deliverables-todo">{todo.map(row)}</ul>}
      {done.length > 0 && !compact && (
        <details className="group mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer list-none">✓ {done.length} remis <span className="text-primary group-open:hidden">afficher</span><span className="hidden text-primary group-open:inline">masquer</span></summary>
          <ul className="mt-1 divide-y">{done.map(row)}</ul>
        </details>
      )}
    </>
  );
  if (compact) return body;
  return (
    <Section title="Livrables à remettre" description={<>{todo.length} à remettre{late > 0 && <span className="text-danger"> · {late} en retard</span>} · rappels à J-{settings.reminderDaysBefore.split(",").join(" et J-")}{` ${au(V.pilote)} et ${au(V.raf)}`}</>} testId="deliverables">
      {body}
    </Section>
  );
}
