import Link from "next/link";
import { listFunders } from "@/lib/organisations";
import { DossiersHeader } from "@/components/common/dossiers-nav";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";
import { refColor, refLabel } from "@/lib/refs";
import { allocationOf } from "@/lib/conventions";
import { paymentSummary } from "@/lib/payments";
import { amounts, durationOf, isOpen, isWon } from "@/lib/dossiers";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreateConventionDialog, NewDossierDialog } from "./create-form";
import { ConventionFilters } from "./filters";

type Search = { vue?: string; financeur?: string; statut?: string; type?: string };

// Financements (lot 2 du 19/09, retour de Gaël). Deux vues sur la même table : les **dossiers de financement** — ce qu'on vise,
// à étudier, en réponse, déposé, avec ce qu'on a écarté ou perdu et pourquoi — et les **financements obtenus** (convention,
// arrêté, mécénat… : la forme se dit), avec le notifié, l'affecté aux éditions, le versé.
export default async function ConventionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const obtenus = sp.vue === "obtenus";
  const [me, refs, funders, projects, people, all] = await Promise.all([
    getCurrentPerson(), getRefs(), listFunders(),
    prisma.project.findMany({ where: { archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.person.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.convention.findMany({ include: { funder: true, owner: { select: { name: true } }, targetProject: { select: { id: true, name: true } }, payments: true, lines: { include: { edition: { include: { project: true } }, deliverables: { where: { done: false }, orderBy: { dueDate: "asc" } }, payments: true } } }, orderBy: [{ endYear: "desc" }, { reference: "asc" }] }),
  ]);
  const rw = canEditFunding(me);
  const won = all.filter((c) => isWon(c.status));
  const dossiers = all.filter((c) => !isWon(c.status));
  const year = new Date().getFullYear();
  const isMulti = (c: (typeof all)[number]) => c.endYear > c.startYear || c.lines.length > 1;
  let rows = obtenus ? won : dossiers;
  if (sp.financeur) rows = rows.filter((c) => c.funderId === sp.financeur);
  if (sp.statut) rows = rows.filter((c) => c.status === sp.statut);
  if (obtenus && sp.type === "pluri") rows = rows.filter(isMulti);
  if (obtenus && sp.type === "annuelle") rows = rows.filter((c) => !isMulti(c));
  const statusOpts = Object.values(refs.dossier_status ?? {}).filter((s) => (obtenus ? isWon(s.code) : !isWon(s.code))).map((s) => ({ value: s.code, label: s.label }));

  if (!obtenus) {
    const open = dossiers.filter((c) => isOpen(c.status));
    const closed = dossiers.filter((c) => !isOpen(c.status));
    const shown = sp.statut ? rows : [...rows.filter((c) => isOpen(c.status)), ...rows.filter((c) => !isOpen(c.status))];
    const asked = open.reduce((s, c) => s + (amounts(c.amountRequested, c.amountKind, durationOf(c)).total ?? 0), 0);
    return (
      <div className="p-4 md:p-6">
        <DossiersHeader current="conventions" title="Dossiers de financement"
          summary={`${open.length} dossier${open.length > 1 ? "s" : ""} en cours · ${fmtEuro(asked)} visés${closed.length ? ` · ${closed.length} écarté${closed.length > 1 ? "s" : ""} ou refusé${closed.length > 1 ? "s" : ""}` : ""}`}
          actions={rw ? <NewDossierDialog funders={funders.map((f) => ({ value: f.id, label: f.name }))} projects={projects.map((p) => ({ value: p.id, label: p.name }))} people={people.map((p) => ({ value: p.id, label: p.name }))} /> : undefined} />
        <ConventionFilters funders={funders.map((f) => ({ value: f.id, label: f.name }))} statuses={statusOpts} current={{ vue: "", financeur: sp.financeur ?? "", statut: sp.statut ?? "", type: "" }} withType={false} />
        {shown.length === 0 ? <EmptyState title="Aucun dossier" hint="Un dossier s'ouvre ici, ou depuis un appel à projets (« Ouvrir un dossier »)." /> : (
          <div className="overflow-auto rounded-md border bg-card">
            <table className="w-full text-[13px]" data-testid="dossiers-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                <tr><th className="px-3 py-2">Dossier</th><th className="px-3 py-2">Étape</th><th className="px-3 py-2">Pour</th><th className="px-3 py-2 text-right">Montant visé</th><th className="px-3 py-2">Durée</th><th className="px-3 py-2">Dépôt</th><th className="px-3 py-2">Qui répond</th></tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((c) => {
                  const a = amounts(c.amountRequested, c.amountKind, durationOf(c));
                  const d = c.deadline ? daysFromNow(c.deadline) : null;
                  return (
                    <tr key={c.id} className={cn("align-top", !isOpen(c.status) && "opacity-60")} data-testid={`convention-${c.reference}`} data-status={c.status}>
                      <td className="min-w-[220px] px-3 py-2"><Link href={`/conventions/${c.id}`} className="font-semibold text-primary hover:underline" data-testid={`open-convention-${c.reference}`}>{c.label ?? c.reference}</Link><small className="mt-0.5 block text-[11px] text-muted-foreground">{c.funder.name}{c.scheme ? ` · ${c.scheme}` : ""} · <span className="font-mono text-[10px]">{c.reference}</span></small>{c.decisionNote && <small className="mt-0.5 block text-[11px] text-muted-foreground">{c.decisionNote}</small>}</td>
                      <td className="px-3 py-2"><StatusBadge label={refLabel(refs, "dossier_status", c.status)} color={refColor(refs, "dossier_status", c.status)} /></td>
                      <td className="px-3 py-2 text-xs">{c.targetProject ? <Link href={`/projets/${c.targetProject.id}`} className="hover:underline">{c.targetProject.name}</Link> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular whitespace-nowrap">{a.total != null ? <>{fmtEuro(a.total)}{durationOf(c) > 1 && <small className="block text-[10px] text-muted-foreground">{fmtEuro(a.perYear!)} par an</small>}</> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{durationOf(c) > 1 ? `${durationOf(c)} ans · ${c.startYear} → ${c.endYear}` : `1 an · ${c.startYear}`}</td>
                      <td className={cn("px-3 py-2 text-xs whitespace-nowrap", d !== null && d < 0 && isOpen(c.status) && c.status !== "submitted" && "font-semibold text-danger", d !== null && d >= 0 && d <= 15 && isOpen(c.status) && "text-warning")}>{c.deadline ? fmtDate(c.deadline) : <span className="text-muted-foreground">—</span>}{d !== null && isOpen(c.status) && c.status !== "submitted" ? <small className="block text-[10px]">{d < 0 ? `dépassé de ${-d} j` : d === 0 ? "aujourd'hui" : `dans ${d} j`}</small> : null}</td>
                      <td className="px-3 py-2 text-xs">{c.owner?.name ?? <span className="text-muted-foreground">—</span>}</td>
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

  const totalNotified = won.reduce((s, c) => s + (c.amountNotified ?? 0), 0);
  const totalGranted = won.reduce((s, c) => s + allocationOf(c).granted, 0);
  const overCount = won.filter((c) => allocationOf(c).over).length;
  const payOf = (c: (typeof all)[number]) => paymentSummary(c.amountNotified, [...c.payments, ...c.lines.flatMap((l) => l.payments)]);
  const totalReceived = won.reduce((s, c) => s + payOf(c).received, 0);
  const lateCount = won.reduce((s, c) => s + payOf(c).late.length, 0);
  return (
    <div className="p-4 md:p-6">
      <DossiersHeader current="conventions" title="Financements obtenus"
        summary={`${won.length} financement${won.length > 1 ? "s" : ""} · ${fmtEuro(totalNotified)} notifiés · ${fmtEuro(totalGranted)} affectés aux éditions · ${fmtEuro(totalReceived)} versés${overCount ? ` · ${overCount} en dépassement` : ""}${lateCount ? ` · ${lateCount} versement${lateCount > 1 ? "s" : ""} en retard` : ""}`}
        actions={rw ? <CreateConventionDialog funders={funders.map((f) => ({ value: f.id, label: f.name }))} /> : undefined} />
      <ConventionFilters funders={funders.map((f) => ({ value: f.id, label: f.name }))} statuses={statusOpts} current={{ vue: "obtenus", financeur: sp.financeur ?? "", statut: sp.statut ?? "", type: sp.type ?? "" }} withType />
      {rows.length === 0 ? <EmptyState title={won.length === 0 ? "Aucun financement obtenu" : "Aucun financement pour ces filtres"} hint={won.length === 0 ? "Un dossier déposé et obtenu arrive ici ; un financement déjà acquis s'enregistre directement." : "Changez le filtre."} /> : (
        <div className="overflow-auto rounded-md border bg-card" tabIndex={0} aria-label={`Tableau des ${rows.length} financements obtenus`}>
          <table className="w-full text-[13px]" style={{ minWidth: 860 }} data-testid="conventions-table">
            <thead className="sticky top-0 z-[2] bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">Financeur · dossier</th>
                <th className="px-3 py-2.5">Forme</th>
                <th className="px-3 py-2.5">Période</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="px-3 py-2.5 text-right">Notifié</th>
                <th className="px-3 py-2.5">Affecté · reste</th>
                <th className="px-3 py-2.5">Versé · reste</th>
                <th className="px-3 py-2.5">Éditions couvertes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const a = allocationOf(c);
                const active = c.startYear <= year && year <= c.endYear;
                const pct = a.ceiling ? Math.round((a.granted / a.ceiling) * 100) : null;
                const pay = payOf(c);
                return (
                  <tr key={c.id} className={cn("border-t border-[#e3e9eb] align-top hover:bg-[#f8f9f3]", !active && "text-muted-foreground")} data-testid={`convention-${c.reference}`} data-status={c.status}>
                    <td className={cn("min-w-[200px] px-3 py-3", a.over ? "border-l-[3px] border-l-danger" : "border-l-[3px] border-l-transparent")}>
                      <Link href={`/conventions/${c.id}`} className="font-semibold text-primary hover:underline" data-testid={`open-convention-${c.reference}`}>{c.funder.name}</Link>
                      <small className="mt-1 block text-[11px] text-muted-foreground">{c.label ?? c.scheme ?? ""}</small>
                      <small className="block font-mono text-[10px] text-muted-foreground">{c.reference}</small>
                    </td>
                    <td className="px-3 py-3 text-xs" data-testid={`form-${c.reference}`}>{c.form ? refLabel(refs, "funding_form", c.form) : <span className="text-muted-foreground">à préciser</span>}</td>
                    <td className="px-3 py-3 tabular"><span className="whitespace-nowrap">{c.startYear === c.endYear ? c.startYear : `${c.startYear} → ${c.endYear}`}</span><small className="mt-1 block text-[10px] text-muted-foreground">{isMulti(c) ? "partagé · pluriannuel" : "annuel"}</small></td>
                    <td className="px-3 py-3"><StatusBadge label={refLabel(refs, "dossier_status", c.status)} color={refColor(refs, "dossier_status", c.status)} /></td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular">{c.amountNotified === null ? <span className="text-muted-foreground">—</span> : fmtEuro(c.amountNotified)}{c.amountRequested !== null && <small className="mt-1 block text-[10px] text-muted-foreground">demandé {fmtEuro(c.amountRequested)}</small>}</td>
                    <td className="px-3 py-3 whitespace-nowrap tabular">
                      <span className={cn(a.over && "font-semibold text-danger")} data-testid={`allocated-${c.reference}`}>{fmtEuro(a.granted)}{pct !== null && <span className="text-muted-foreground"> · {pct} %</span>}</span>
                      <small className={cn("mt-1 block text-[10px]", a.remaining !== null && a.remaining < 0 ? "font-semibold text-danger" : "text-mint")}>{a.remaining === null ? "notifié inconnu" : a.remaining < 0 ? `dépassement ${fmtEuro(-a.remaining)}` : `reste ${fmtEuro(a.remaining)}`}</small>
                      {a.ceiling ? <div className="mt-1 h-[4px] w-24 overflow-hidden rounded-[2px] bg-[#e8e9e1]"><i className={cn("block h-full", a.over ? "bg-danger" : "bg-mint")} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div> : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap tabular" data-testid={`received-${c.reference}`}>
                      <span className={cn(pay.late.length > 0 && "font-semibold text-danger")}>{fmtEuro(pay.received)}{pay.pct !== null && <span className="text-muted-foreground"> · {pay.pct} %</span>}</span>
                      <small className={cn("mt-1 block text-[10px]", pay.late.length > 0 ? "font-semibold text-danger" : "text-muted-foreground")}>{pay.late.length > 0 ? `${pay.late.length} en retard` : pay.remaining === null ? "notifié inconnu" : pay.remaining > 0 ? `reste ${fmtEuro(pay.remaining)}` : "tout perçu"}</small>
                    </td>
                    <td className="min-w-[170px] max-w-[210px] px-3 py-3">
                      {c.lines.length === 0 ? <span className="text-xs text-muted-foreground">aucune — à rattacher depuis l&apos;onglet Financements d&apos;une édition</span> : (
                        <div className="flex flex-wrap gap-1">
                          {c.lines.slice(0, 3).map((l) => <Link key={l.id} href={`/edition/${l.editionId}?onglet=budget#recettes`} className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] text-primary hover:underline" title={`${l.edition.project.name} · ${l.edition.year}`}>{l.edition.project.name} · {l.edition.year}</Link>)}
                          {c.lines.length > 3 && <Link href={`/conventions/${c.id}`} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:underline">+{c.lines.length - 3}</Link>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2.5 text-[10px] text-muted-foreground">{rows.length} financement{rows.length > 1 ? "s" : ""} affiché{rows.length > 1 ? "s" : ""} sur {won.length} · les clés de répartition restent dans l&apos;Excel de la RAF · les versements en retard se pilotent dans Échéances et Trésorerie.</p>
    </div>
  );
}
