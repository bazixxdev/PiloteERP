import Link from "next/link";
import { Download } from "lucide-react";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { canSeeTimeOf, isCodir } from "@/lib/rights";
import { loadFundedActions } from "@/lib/funded-actions-db";
import { hiddenPeopleLabel } from "@/lib/funded-actions";
import { withBase } from "@/lib/base-path";
import { fmtEuro, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { V, cap, aucun, e, pl, un } from "@/lib/vocab";

// Les actions financées, vues depuis le financement (panneau de ligne, page du dossier) : pour chaque action liée, sur l'année de
// la ligne, le montant affecté, les heures (détail par personne selon la visibilité du temps, comme la page de l'action ; les
// autres en une ligne agrégée), les jalons faits et les réalisations. Qui lit ? qui voit la ligne ; rien de plus ne sort que ce
// que montrent déjà la page de l'action et l'onglet Budget. L'export CSV (heures par personne) est réservé au droit de la
// matrice (codir.access) : le lien n'apparaît qu'à qui l'a, la route se garde elle-même.
export async function FundedActions({ lines, year, title, exportHref, showProject = false, testId = "funded-actions", className }: {
  lines: string[];
  year: number;
  title?: string;
  exportHref?: string;
  showProject?: boolean;
  testId?: string;
  className?: string;
}) {
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  const items = await loadFundedActions(lines, (p) => canSeeTimeOf(me, p, settings.timeVisibility));
  return (
    <div className={cn("rounded-lg border p-2", className)} data-testid={testId} data-year={year}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground">{title ?? `${cap(pl(V.action))} financé${e(V.action)}s en ${year}`} · heures, jalons faits et réalisations de l&apos;année</span>
        {exportHref && isCodir(me) && items.length > 0 && (
          <a href={withBase(exportHref)} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline" data-testid={`${testId}-export`}><Download className="size-3" />CSV</a>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-empty`}>{`${cap(aucun(V.action))} financé${e(V.action)} en ${year} : le lien se pose sur la page d'${un(V.action)}.`}</p>
      ) : (
        <ul className="divide-y text-xs">
          {items.map((f, i) => (
            <li key={`${f.lineId}-${f.action.id}`} className="grid gap-0.5 py-1.5" data-testid={`funded-action-${i}`} data-action={f.action.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0">
                  <Link href={`/action/${f.action.id}?annee=${f.year}`} className="font-medium text-primary hover:underline" data-testid={`funded-action-name-${i}`}>{f.action.name}</Link>
                  {showProject && <span className="text-muted-foreground"> · {f.action.projectName}</span>}
                </span>
                <span className="tabular" data-testid={`funded-amount-${i}`}>{f.amount === null ? <span className="text-muted-foreground">montant non précisé</span> : <b>{fmtEuro(f.amount)}</b>}</span>
              </div>
              <div className="text-muted-foreground">
                <b className="tabular text-foreground" data-testid={`funded-hours-${i}`}>{fmtNumber(f.totalHours, 1)} h</b>
                {` · ${f.milestonesDone} jalon${f.milestonesDone > 1 ? "s" : ""} fait${f.milestonesDone > 1 ? "s" : ""} · ${f.achievements} réalisation${f.achievements > 1 ? "s" : ""}`}
              </div>
              {(f.visible.length > 0 || f.hidden.count > 0) && (
                <ul className="flex flex-wrap gap-x-3 gap-y-0.5" data-testid={`funded-people-${i}`}>
                  {f.visible.map((v) => <li key={v.person.id}>{v.person.name} <b className="tabular">{fmtNumber(v.hours, 1)} h</b></li>)}
                  {f.hidden.count > 0 && <li className="text-muted-foreground" data-testid={`funded-hidden-${i}`}>{hiddenPeopleLabel(f.hidden.count)}.</li>}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
