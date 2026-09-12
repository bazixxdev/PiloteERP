import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Gauge } from "@/components/common/gauge";
import { AlertChips } from "@/components/common/alert-chips";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getRefs, getSettings } from "@/lib/session";
import { loadPortfolio } from "@/lib/queries";
import { refColor, refLabel } from "@/lib/refs";
import { dayjs, daysFromNow, fmtDate, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PortfolioFilters } from "./filters";

type Search = { pole?: string; statut?: string; alerte?: string; mode?: string; trimestre?: string };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [settings, refs, poles] = await Promise.all([getSettings(), getRefs(), prisma.pole.findMany({ orderBy: { name: "asc" } })]);
  const codir = sp.mode === "codir";
  const all = await loadPortfolio(settings, { statuses: ["in_progress", "validated"] });

  let rows = all;
  if (sp.pole) rows = rows.filter((r) => r.project.poleId === sp.pole);
  if (sp.statut) rows = rows.filter((r) => r.status === sp.statut);
  if (sp.alerte === "oui") rows = rows.filter((r) => r.alerts.length > 0);
  if (sp.alerte === "danger") rows = rows.filter((r) => r.hasDanger);
  if (sp.trimestre) {
    // Filtre trimestre (EF-H3) : éditions ayant un jalon ou un livrable dans le trimestre choisi.
    const [y, q] = sp.trimestre.split("-T").map(Number);
    const start = dayjs(`${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`);
    const end = start.add(3, "month");
    rows = rows.filter((r) =>
      r.actions.some((a) => a.milestoneDate && dayjs(a.milestoneDate).isAfter(start) && dayjs(a.milestoneDate).isBefore(end)) ||
      r.fundingLines.some((f) => f.deliverables.some((d) => dayjs(d.dueDate).isAfter(start) && dayjs(d.dueDate).isBefore(end))),
    );
  }
  if (codir) rows = rows.filter((r) => r.alerts.length > 0 || r.pendingValidations > 0);

  const totalAlerts = all.reduce((s, r) => s + r.alerts.length, 0);
  const totalPending = all.reduce((s, r) => s + r.pendingValidations, 0);
  const thisQuarter = `${dayjs().year()}-T${Math.floor(dayjs().month() / 3) + 1}`;

  return (
    <div className={cn("p-6", codir && "min-h-full bg-sidebar/5")}>
      <PageHeader
        title={codir ? "Mode CODIR" : "Portefeuille"}
        subtitle={
          codir
            ? `${rows.length} édition${rows.length > 1 ? "s" : ""} en alerte ou avec des validations en attente · ${totalPending} validation${totalPending > 1 ? "s" : ""} à traiter`
            : `${all.length} éditions en cours · ${totalAlerts} alerte${totalAlerts > 1 ? "s" : ""} · ${totalPending} validation${totalPending > 1 ? "s" : ""} en attente`
        }
        actions={
          codir ? (
            <Button asChild variant="outline"><Link href="/portefeuille">Quitter le mode CODIR</Link></Button>
          ) : (
            <>
              <Button asChild variant="outline"><Link href="/validations">Validations en attente</Link></Button>
              <Button asChild className="bg-coral text-white hover:bg-coral/90" data-testid="codir-mode"><Link href="/portefeuille?mode=codir"><Maximize2 />Mode CODIR</Link></Button>
            </>
          )
        }
      />

      {!codir && (
        <PortfolioFilters
          poles={poles.map((p) => ({ value: p.id, label: p.name }))}
          statuses={["in_progress", "validated"].map((s) => ({ value: s, label: refLabel(refs, "edition_status", s) }))}
          current={{ pole: sp.pole ?? "", statut: sp.statut ?? "", alerte: sp.alerte ?? "", trimestre: sp.trimestre ?? "" }}
          thisQuarter={thisQuarter}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState title={codir ? "Rien à signaler" : "Aucune édition ne correspond"} hint={codir ? "Aucune alerte ni validation en attente : la revue CODIR peut être courte." : "Élargissez les filtres ou créez une édition depuis l'admin."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full table-fixed text-sm" style={{ minWidth: 1100 }} data-testid="portfolio-table">
            <colgroup>{["19%", "10%", "8%", "13%", "13%", "9%", "9%", "4%", "15%"].map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
            <thead className="bg-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Projet</th>
                <th className="px-3 py-2.5">Pilote</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Prochain jalon</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Livrable financeur</th>
                <th className="px-3 py-2.5">Enveloppe</th>
                <th className="px-3 py-2.5">Temps</th>
                <th className="px-3 py-2.5 text-center">Valid.</th>
                <th className="px-3 py-2.5">Alertes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const ms = r.nextMilestone;
                const dl = r.nextDeliverable;
                const msDays = ms ? daysFromNow(ms.date) : null;
                const dlDays = dl ? daysFromNow(dl.dueDate) : null;
                return (
                  <tr key={r.id} className={cn("hover:bg-muted/40", r.hasDanger && "bg-danger-soft/30")}>
                    <td className="px-4 py-2.5">
                      <Link href={`/edition/${r.id}`} className="font-medium text-primary hover:underline">{r.project.name}</Link>
                      <div className="text-xs text-muted-foreground">{r.year} · {r.project.analyticCode} · {r.project.pole.name}</div>
                    </td>
                    <td className="truncate px-3 py-2.5 text-xs" title={r.project.pilot.name}>{r.project.pilot.name}</td>
                    <td className="px-3 py-2.5"><StatusBadge label={refLabel(refs, "edition_status", r.status)} color={refColor(refs, "edition_status", r.status)} /></td>
                    <td className="px-3 py-2.5">
                      {ms ? (
                        <div className={cn(msDays !== null && msDays < 0 && "text-danger")}>
                          <div className="truncate" title={ms.name}>{ms.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{fmtDate(ms.date)}{msDays !== null && msDays < 0 ? ` · ${-msDays} j de retard` : ""}</div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {dl ? (
                        <div className={cn(dlDays !== null && dlDays <= settings.deliverableAlertDays && "text-[#8a5a00]", dlDays !== null && dlDays < 0 && "text-danger")}>
                          <div className="truncate" title={dl.label}>{dl.label}</div>
                          <div className="truncate text-xs text-muted-foreground">{dl.funder} · {fmtDate(dl.dueDate)}</div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-2.5"><Gauge value={r.used} max={r.budgetEnvelope} alertPercent={settings.envelopeAlertPercent} compact /></td>
                    <td className="px-3 py-2.5 text-xs tabular whitespace-nowrap">
                      <span className={cn(r.timeTarget && r.timeConsumed > r.timeTarget && "text-danger font-medium")}>{fmtNumber(r.timeConsumed, 0)} h</span>
                      <span className="text-muted-foreground"> / {r.timeTarget ? `${fmtNumber(r.timeTarget, 0)} h` : "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {r.pendingValidations > 0 ? <Link href={`/edition/${r.id}?onglet=validations`} className="inline-flex size-6 items-center justify-center rounded-full bg-coral text-xs font-semibold text-white">{r.pendingValidations}</Link> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-2.5"><AlertChips alerts={r.alerts} max={codir ? 4 : 2} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
