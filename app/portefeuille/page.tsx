import Link from "next/link";
import { Lightbulb, Maximize2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Gauge } from "@/components/common/gauge";
import { AlertChips, AlertSummary } from "@/components/common/alert-chips";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { inMyScope, isTransversal, perimeterFrom, byRelevance, TIER_LABEL, type Tier } from "@/lib/scope";
import { PerimeterChips } from "@/components/common/perimeter";
import { loadPortfolio } from "@/lib/queries";
import { isCodir } from "@/lib/rights";
import { refColor, refLabel } from "@/lib/refs";
import { dayjs, daysFromNow, fmtDate, fmtEuro, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PortfolioFilters } from "./filters";

type Search = { pole?: string; statut?: string; alerte?: string; mode?: string; trimestre?: string; perimetre?: string };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [settings, refs, poles, me] = await Promise.all([getSettings(), getRefs(), prisma.pole.findMany({ orderBy: { name: "asc" } }), getCurrentPerson()]);
  // Le mode CODIR n'existe que pour les rôles CODIR : ni bouton, ni vue filtrée pour les autres.
  const codir = sp.mode === "codir" && isCodir(me.role);
  const everything = await loadPortfolio(settings, { statuses: ["in_progress", "validated"] });
  const perimeter = perimeterFrom(me, sp.perimetre);
  const all = perimeter === "pole" ? everything.filter((r) => inMyScope(me, r.project, r.team.map((t) => t.personId))) : everything;

  let rows = all;
  if (sp.pole) rows = rows.filter((r) => r.project.poleId === sp.pole);
  if (sp.statut) rows = rows.filter((r) => r.status === sp.statut);
  if (sp.alerte === "oui") rows = rows.filter((r) => r.alerts.length > 0);
  if (sp.alerte === "danger") rows = rows.filter((r) => r.hasDanger);
  if (sp.alerte === "calme") rows = rows.filter((r) => r.alerts.length === 0);
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
  // Ce qui me concerne d'abord : je pilote, je contribue, mon pôle, le reste ; puis les alertes fortes.
  const ranked = byRelevance(me, rows, (r) => ({ project: r.project, teamIds: r.team.map((t) => t.personId), ownerIds: r.actions.map((a) => a.ownerId ?? "") }), (a, b) => Number(b.hasDanger) - Number(a.hasDanger) || b.alerts.length - a.alerts.length);
  const groups = [0, 1, 2, 3].map((t) => ({ tier: t as Tier, rows: ranked.filter((r) => r.tier === t) })).filter((g) => g.rows.length > 0);
  const showGroups = !codir && !isTransversal(me) && groups.length > 1;
  // Les alertes d'abord (fortes, puis modérées), ensuite l'ordre alphabétique.
  const rank = (r: (typeof rows)[number]) => (r.hasDanger ? 0 : r.alerts.length > 0 ? 1 : 2);
  rows = [...rows].sort((a, b) => rank(a) - rank(b) || a.project.name.localeCompare(b.project.name, "fr"));

  const inAlert = all.filter((r) => r.alerts.length > 0).length;
  const totalPending = all.reduce((s, r) => s + r.pendingValidations, 0);
  const calm = all.length - inAlert;
  const thisQuarter = `${dayjs().year()}-T${Math.floor(dayjs().month() / 3) + 1}`;
  const year = dayjs().year();
  const lastTime = await prisma.timeEntry.aggregate({ _max: { date: true } });

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={codir ? "Mode CODIR" : "Portefeuille des éditions"}
        subtitle={
          codir
            ? `${rows.length} édition${rows.length > 1 ? "s" : ""} en alerte ou avec des validations en attente · ${totalPending} validation${totalPending > 1 ? "s" : ""} à traiter`
            : `${year} · ${all.length} éditions en cours · ${poles.length} pôles`
        }
        actions={
          codir ? (
            <Button asChild variant="outline"><Link href="/portefeuille">Quitter le mode CODIR</Link></Button>
          ) : isCodir(me.role) ? (
            <Button asChild data-testid="codir-mode"><Link href="/codir"><Maximize2 />Mode CODIR</Link></Button>
          ) : (
            <Button asChild variant="outline" data-testid="propose-project"><Link href="/projets/proposer"><Lightbulb />Proposer un projet</Link></Button>
          )
        }
      />

      {!codir && (
        <div className="mb-5 grid grid-cols-2 rounded-md border bg-card md:grid-cols-4" data-testid="portfolio-summary">
          <div className="border-b border-r p-4 md:border-b-0"><div className="text-[26px] font-semibold leading-tight tracking-[-1px] tabular">{all.length}</div><span className="mt-1 block text-[11px] text-muted-foreground">éditions en cours</span></div>
          <div className={cn("border-b p-4 md:border-b-0 md:border-r", inAlert > 0 && "bg-[#fcf4e3]")}><div className={cn("text-[26px] font-semibold leading-tight tracking-[-1px] tabular", inAlert > 0 && "text-warning-foreground")}>{inAlert}</div><span className="mt-1 block text-[11px] text-muted-foreground">éditions en alerte</span></div>
          <Link href="/validations" className={cn("border-r p-4 hover:bg-muted/40", totalPending > 0 && "bg-[#fbefe9]")}><div className={cn("text-[26px] font-semibold leading-tight tracking-[-1px] tabular", totalPending > 0 && "text-danger")}>{totalPending}</div><span className="mt-1 block text-[11px] text-muted-foreground">validations en attente</span></Link>
          <div className="p-4"><div className="pt-1 text-base font-semibold text-mint">✓ Tout va bien</div><span className="mt-1 block text-[11px] text-muted-foreground">pour {calm === all.length ? "toutes les" : `les ${calm} autres`} éditions</span></div>
        </div>
      )}

      {!codir && !isTransversal(me) && (
        <div className="mb-3"><PerimeterChips current={perimeter} poleName={me.pole?.name ?? null} hrefFor={(p) => `/portefeuille?perimetre=${p}`} /></div>
      )}
      {!codir && (
        <PortfolioFilters
          poles={poles.map((p) => ({ value: p.id, label: p.name }))}
          statuses={["in_progress", "validated"].map((s) => ({ value: s, label: refLabel(refs, "edition_status", s) }))}
          current={{ pole: sp.pole ?? "", statut: sp.statut ?? "", alerte: sp.alerte ?? "", trimestre: sp.trimestre ?? "", perimetre: sp.perimetre ?? "" }}
          showPole={isTransversal(me) || perimeter === "cress"}
          thisQuarter={thisQuarter}
          year={year}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState icon="○" title={codir ? "Rien à signaler" : "Aucune édition pour ces filtres"} hint={codir ? "Aucune alerte ni validation en attente : la revue CODIR peut être courte." : "Changez le filtre pour retrouver les projets."} />
      ) : (
        <div className="overflow-auto rounded-md border bg-card" tabIndex={0} aria-label={`Tableau des ${rows.length} éditions, défilement horizontal et vertical`}>
          {/* Les alertes se lisent sous le nom du projet, sans défilement horizontal ; le corps est en 13 px. */}
          <table className="w-full text-[13px]" style={{ minWidth: 900 }} data-testid="portfolio-table">
            <thead className="sticky top-0 z-[2] bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">Projet / édition · alertes</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Pôle · pilote</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Prochain jalon</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Livrable financeur</th>
                <th className="px-3 py-2.5">Enveloppe</th>
                <th className="px-3 py-2.5">Temps</th>
                <th className="px-3 py-2.5">Validations</th>
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((g) => [
                ...(showGroups ? [(
                  <tr key={`g-${g.tier}`} className="bg-muted/40" data-testid={`group-${g.tier}`}>
                    <td colSpan={7} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{TIER_LABEL[g.tier]} · {g.rows.length}</td>
                  </tr>
                )] : []),
                ...g.rows.map((r) => {
                const ms = r.nextMilestone;
                const dl = r.nextDeliverable;
                const msDays = ms ? daysFromNow(ms.date) : null;
                const dlDays = dl ? daysFromNow(dl.dueDate) : null;
                const timeOver = Boolean(r.timeTarget && r.timeConsumed > r.timeTarget);
                return (
                  <tr key={r.id} className="border-t border-[#e3e9eb] align-middle hover:bg-[#f8f9f3]" data-alert={r.hasDanger ? "danger" : r.alerts.length ? "warning" : "none"}>
                    <td className={cn("min-w-[220px] max-w-[280px] px-3 py-3", r.hasDanger ? "border-l-[3px] border-l-danger" : r.alerts.length > 0 ? "border-l-[3px] border-l-warning" : "border-l-[3px] border-l-transparent")}>
                      <Link href={`/edition/${r.id}`} className="font-semibold text-primary hover:underline">{r.project.name}</Link>
                      <small className="mt-1 block text-[10px] text-muted-foreground">Édition {r.year} · {r.project.analyticCode}</small>
                      {r.alerts.length > 0 ? <div className="mt-1.5">{codir ? <AlertChips alerts={r.alerts} max={4} /> : <AlertSummary alerts={r.alerts} />}</div> : null}
                    </td>
                    <td className="px-3 py-3">
                      <span title={r.project.pole.name}>{r.project.pole.name.split(/\s+(?:&|et)\s+/)[0]}</span>
                      <small className="mt-1 block text-[10px] text-muted-foreground">{r.project.pilot.name}</small>
                      {/* « En cours » ne se répète pas ligne à ligne : seul un statut différent s'écrit. */}
                      {r.status !== "in_progress" && <div className="mt-1"><StatusBadge label={refLabel(refs, "edition_status", r.status)} color={refColor(refs, "edition_status", r.status)} /></div>}
                    </td>
                    <td className="px-3 py-3">
                      {ms ? (
                        <>
                          <span className="block max-w-[150px] truncate" title={ms.name}>{ms.name}</span>
                          <small className={cn("mt-1 block text-[10px]", msDays !== null && msDays < 0 ? "font-semibold text-danger" : "text-muted-foreground")}>{fmtDate(ms.date, "D MMM")}{msDays !== null && msDays < 0 ? ` · dépassé de ${-msDays} j` : ""}</small>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {dl ? (
                        <>
                          <span className="block max-w-[150px] truncate" title={dl.label}>{dl.label}</span>
                          <small className={cn("mt-1 block text-[10px]", dlDays !== null && dlDays < 0 ? "font-semibold text-danger" : dlDays !== null && dlDays <= settings.deliverableAlertDays ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>{dl.funder} · {fmtDate(dl.dueDate, "D MMM")}{dlDays !== null && dlDays >= 0 && dlDays <= settings.deliverableAlertDays ? ` · J−${dlDays}` : ""}</small>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3"><Gauge value={r.used} max={r.budgetEnvelope} alertPercent={settings.envelopeAlertPercent} compact amount={r.budgetEnvelope ? fmtEuro(r.budgetEnvelope) : undefined} /></td>
                    <td className="px-3 py-3 whitespace-nowrap tabular">
                      <span className={cn(timeOver && "font-semibold text-danger")}>{fmtNumber(r.timeConsumed, 0)} / {r.timeTarget ? fmtNumber(r.timeTarget, 0) : "—"} h</span>
                      {(timeOver || !r.timeTarget) && <small className={cn("mt-1 block text-[10px]", timeOver ? "text-danger" : "text-muted-foreground")}>{timeOver ? "! Objectif dépassé" : "Sans objectif"}</small>}
                    </td>
                    <td className="px-3 py-3">
                      {r.pendingValidations > 0 ? <Link href={`/edition/${r.id}?onglet=validations`}><StatusBadge label={`${r.pendingValidations} en attente`} color="warning" dot={false} /></Link> : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
                }),
              ])}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap justify-between gap-4 text-[10px] text-muted-foreground">
        <span data-testid="portfolio-count">{rows.length} édition{rows.length > 1 ? "s" : ""} affichée{rows.length > 1 ? "s" : ""} sur {all.length} · les alertes apparaissent en premier</span>
        <span>Toutes les éditions listées sont en cours, sauf mention · seuils : enveloppe à {settings.envelopeAlertPercent} % · livrable à J−{settings.deliverableAlertDays}</span>
      </div>
      {lastTime._max.date && <p className="py-3 text-xs text-muted-foreground">✓ Temps consolidés jusqu'au {fmtDate(lastTime._max.date, "D MMMM")}.</p>}
    </div>
  );
}
