import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { DossiersNav } from "@/components/common/dossiers-nav";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";
import { refColor, refLabel } from "@/lib/refs";
import { allocationOf } from "@/lib/conventions";
import { paymentSummary } from "@/lib/payments";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreateConventionDialog } from "./create-form";
import { ConventionFilters } from "./filters";

type Search = { financeur?: string; statut?: string; type?: string };

// Conventions partagées (EF-C3) : une liste pour comparer (financeur, période, notifié, affecté, reste, prochaine obligation),
// une page par convention pour lire et modifier (`/conventions/[id]`).
export default async function ConventionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [me, refs, funders, all] = await Promise.all([
    getCurrentPerson(), getRefs(), prisma.funder.findMany({ orderBy: { name: "asc" } }),
    prisma.convention.findMany({ include: { funder: true, payments: true, lines: { include: { edition: { include: { project: true } }, deliverables: { where: { done: false }, orderBy: { dueDate: "asc" } }, payments: true } } }, orderBy: [{ endYear: "desc" }, { reference: "asc" }] }),
  ]);
  const rw = canEditFunding(me);
  const isMulti = (c: (typeof all)[number]) => c.endYear > c.startYear || c.lines.length > 1;
  let rows = all;
  if (sp.financeur) rows = rows.filter((c) => c.funderId === sp.financeur);
  if (sp.statut) rows = rows.filter((c) => c.status === sp.statut);
  if (sp.type === "pluri") rows = rows.filter(isMulti);
  if (sp.type === "annuelle") rows = rows.filter((c) => !isMulti(c));

  const totalNotified = all.reduce((s, c) => s + (c.amountNotified ?? 0), 0);
  const totalGranted = all.reduce((s, c) => s + allocationOf(c).granted, 0);
  const overCount = all.filter((c) => allocationOf(c).over).length;
  const payOf = (c: (typeof all)[number]) => paymentSummary(c.amountNotified, [...c.payments, ...c.lines.flatMap((l) => l.payments)]);
  const totalReceived = all.reduce((s, c) => s + payOf(c).received, 0);
  const lateCount = all.reduce((s, c) => s + payOf(c).late.length, 0);
  const year = new Date().getFullYear();

  return (
    <div className="p-4 md:p-6">
      <DossiersNav current="conventions" />
      <PageHeader
        title="Conventions"
        subtitle={`${all.length} convention${all.length > 1 ? "s" : ""} · ${fmtEuro(totalNotified)} notifiés · ${fmtEuro(totalGranted)} affectés aux éditions · ${fmtEuro(totalReceived)} versés${overCount ? ` · ${overCount} en dépassement` : ""}${lateCount ? ` · ${lateCount} versement${lateCount > 1 ? "s" : ""} en retard` : ""}. Une convention existe une fois, même sur plusieurs années et plusieurs projets ; la somme des affectations ne dépasse pas le notifié.`}
        actions={rw ? <CreateConventionDialog funders={funders.map((f) => ({ value: f.id, label: f.name }))} /> : undefined}
      />

      <ConventionFilters
        funders={funders.map((f) => ({ value: f.id, label: f.name }))}
        statuses={Object.values(refs.funding_status ?? {}).map((s) => ({ value: s.code, label: s.label }))}
        current={{ financeur: sp.financeur ?? "", statut: sp.statut ?? "", type: sp.type ?? "" }}
      />

      {rows.length === 0 ? (
        <EmptyState title={all.length === 0 ? "Aucune convention" : "Aucune convention pour ces filtres"} hint={all.length === 0 ? "Créez-la ici (RAF), puis rattachez-y les éditions depuis leur onglet Financements." : "Changez le filtre pour retrouver les conventions."} />
      ) : (
        <div className="overflow-auto rounded-md border bg-card" tabIndex={0} aria-label={`Tableau des ${rows.length} conventions`}>
          <table className="w-full text-[13px]" style={{ minWidth: 860 }} data-testid="conventions-table">
            <thead className="sticky top-0 z-[2] bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">Financeur · référence</th>
                <th className="px-3 py-2.5">Période</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="px-3 py-2.5 text-right">Notifié</th>
                <th className="px-3 py-2.5">Affecté · reste</th>
                <th className="px-3 py-2.5">Versé · reste</th>
                <th className="px-3 py-2.5">Éditions couvertes</th>
                <th className="px-3 py-2.5">Prochaine obligation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const a = allocationOf(c);
                const next = c.lines.flatMap((l) => l.deliverables.map((d) => ({ d, l }))).sort((x, y) => x.d.dueDate.getTime() - y.d.dueDate.getTime())[0];
                const nextDays = next ? daysFromNow(next.d.dueDate) : null;
                const active = c.startYear <= year && year <= c.endYear;
                const pct = a.ceiling ? Math.round((a.granted / a.ceiling) * 100) : null;
                const pay = payOf(c);
                return (
                  <tr key={c.id} className={cn("border-t border-[#e3e9eb] align-top hover:bg-[#f8f9f3]", !active && "text-muted-foreground")} data-testid={`convention-${c.reference}`}>
                    <td className={cn("min-w-[160px] px-3 py-3", a.over ? "border-l-[3px] border-l-danger" : nextDays !== null && nextDays < 0 ? "border-l-[3px] border-l-warning" : "border-l-[3px] border-l-transparent")}>
                      <Link href={`/conventions/${c.id}`} className="font-semibold text-primary hover:underline" data-testid={`open-convention-${c.reference}`}>{c.funder.name}</Link>
                      <small className="mt-1 block font-mono text-[10px] text-muted-foreground">{c.reference}{c.scheme ? ` · ${c.scheme}` : ""}</small>
                    </td>
                    <td className="px-3 py-3 tabular"><span className="whitespace-nowrap">{c.startYear === c.endYear ? c.startYear : `${c.startYear} → ${c.endYear}`}</span><small className="mt-1 block text-[10px] text-muted-foreground">{isMulti(c) ? "partagée" : "annuelle"}{!active ? " · hors période" : ""}</small></td>
                    <td className="px-3 py-3"><StatusBadge label={refLabel(refs, "funding_status", c.status)} color={refColor(refs, "funding_status", c.status)} /></td>
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
                      {c.lines.length === 0 ? <span className="text-xs text-muted-foreground">aucune — à rattacher depuis l'onglet Financements d'une édition</span> : (
                        <div className="flex flex-wrap gap-1">
                          {c.lines.slice(0, 3).map((l) => <Link key={l.id} href={`/edition/${l.editionId}?onglet=budget#recettes`} className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] text-primary hover:underline" title={`${l.edition.project.name} · ${l.edition.year} · ${fmtEuro(l.amountGranted)} obtenus`}>{l.edition.project.name} · {l.edition.year}</Link>)}
                          {c.lines.length > 3 && <Link href={`/conventions/${c.id}`} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:underline" title={c.lines.slice(3).map((l) => `${l.edition.project.name} · ${l.edition.year}`).join("\n")}>+{c.lines.length - 3} autres</Link>}
                        </div>
                      )}
                    </td>
                    <td className="min-w-[130px] px-3 py-3">
                      {next ? (
                        <>
                          <span className="block max-w-[140px] truncate" title={next.d.label}>{next.d.label}</span>
                          <small className={cn("mt-1 block text-[10px]", nextDays !== null && nextDays < 0 ? "font-semibold text-danger" : "text-muted-foreground")}>{fmtDate(next.d.dueDate)} · {next.l.edition.project.name}{nextDays !== null && nextDays < 0 ? ` · ${-nextDays} j de retard` : ""}</small>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2.5 text-[10px] text-muted-foreground">{rows.length} convention{rows.length > 1 ? "s" : ""} affichée{rows.length > 1 ? "s" : ""} sur {all.length} · les clés de répartition restent dans l'Excel de la RAF · cliquez sur le financeur pour ouvrir la convention.</p>
    </div>
  );
}
