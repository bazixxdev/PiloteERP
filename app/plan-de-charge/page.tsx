import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { isTransversal } from "@/lib/scope";
import { dayjs, fmtNumber } from "@/lib/format";
import { loadPlan, monthKeys } from "@/lib/load";
import { cn } from "@/lib/utils";
import { LoadGrid } from "./grid";
import { LoadFilters } from "./filters";
import { FreezeControl } from "./freeze";
import { canEditFunding } from "@/lib/rights";
import { fmtDate } from "@/lib/format";

type Search = { debut?: string; horizon?: string; pole?: string; vue?: string; avenir?: string };

// Plan de charge : jours prévus par personne et par mois (éditions en cours et à venir) face à la capacité ; réalisé sur les mois passés.
export default async function PlanDeChargePage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const [me, settings, poles] = await Promise.all([getCurrentPerson(), getSettings(), prisma.pole.findMany({ orderBy: { name: "asc" } })]);
  const sp = { ...raw, pole: raw.pole === "tous" ? "" : raw.pole ?? (isTransversal(me) ? "" : me.poleId ?? "") };
  const start = /^\d{4}-\d{2}$/.test(sp.debut ?? "") ? sp.debut! : dayjs().startOf("month").format("YYYY-MM");
  const horizon = [6, 12, 18].includes(Number(sp.horizon)) ? Number(sp.horizon) : 12;
  const months = monthKeys(start, horizon);
  // Éditions en cours et validées par défaut ; « à venir » ajoute les proposées et re-challengées ; « à venir seulement » les isole.
  const future = sp.avenir === "seul" ? ["proposed", "rechallenged", "validated"] : sp.avenir === "non" ? ["in_progress", "validated"] : ["in_progress", "validated", "proposed", "rechallenged"];
  const rows = await loadPlan(months, { statuses: future, hoursPerDay: settings.hoursPerDay || 7, poleId: sp.pole || null, operatingDaysPerMonth: settings.operatingDaysPerMonth || 0 });
  // Année pilotée = celle du premier mois affiché ; figée au séminaire, ses modifications ultérieures se voient.
  const focusYear = Number(start.slice(0, 4));
  const freeze = await prisma.loadFreeze.findUnique({ where: { year: focusYear }, include: { frozenBy: true } });
  const changedAfter = freeze ? await prisma.changeLog.findMany({ where: { field: { startsWith: "plannedLoad:" }, createdAt: { gt: freeze.frozenAt }, edition: { year: focusYear } }, include: { author: true, edition: { include: { project: true } } }, orderBy: { createdAt: "desc" }, take: 20 }) : [];
  const changedPeople = new Set(changedAfter.map((c) => c.field.split(":")[1]));
  // Éditions proposables dans une cellule, avec le droit de la personne courante (pilote de l'édition, RAF, direction, responsable de pôle).
  const years = [...new Set(months.map((m) => Number(m.slice(0, 4))))];
  const allEditions = await prisma.edition.findMany({ where: { status: { in: future }, year: { in: years } }, include: { project: true }, orderBy: [{ project: { name: "asc" } }, { year: "asc" }] });
  const canEditAll = me.role === "director" || me.role === "raf" || me.role === "pole_lead";
  const editionOpts = allEditions.map((e) => ({ id: e.id, label: `${e.project.name} · ${e.year}`, year: e.year, editable: canEditAll || e.project.pilotId === me.id }));
  const today = dayjs().format("YYYY-MM");
  const over = rows.filter((r) => months.some((m) => r.months[m].capacity > 0 && r.months[m].planned > r.months[m].capacity));
  const totalPlanned = rows.reduce((s, r) => s + months.reduce((x, m) => x + r.months[m].planned, 0), 0);
  const totalCap = rows.reduce((s, r) => s + months.reduce((x, m) => x + r.months[m].capacity, 0), 0);

  // Vue par projet : mêmes cellules, regroupées par édition.
  const byEdition = new Map<string, { project: string; year: number; status: string; months: Record<string, number> }>();
  for (const r of rows) for (const m of months) for (const c of r.months[m].cells) {
    const e = byEdition.get(c.editionId) ?? { project: c.project, year: c.year, status: c.status, months: {} };
    e.months[m] = Math.round(((e.months[m] ?? 0) + c.days) * 10) / 10;
    byEdition.set(c.editionId, e);
  }
  const editions = [...byEdition.entries()].sort((a, b) => a[1].project.localeCompare(b[1].project, "fr") || a[1].year - b[1].year);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Plan de charge"
        subtitle={`${months.length} mois à partir de ${dayjs(start + "-01").format("MMMM YYYY")} · ${rows.length} personne${rows.length > 1 ? "s" : ""} · ${fmtNumber(totalPlanned, 0)} j prévus pour ${fmtNumber(totalCap, 0)} j de capacité${over.length ? ` · ${over.length} personne${over.length > 1 ? "s" : ""} en dépassement sur au moins un mois` : " · personne en dépassement"}.`}
      />
      <LoadFilters poles={poles.map((p) => ({ value: p.id, label: p.name }))} current={{ debut: start, horizon: String(horizon), pole: sp.pole ?? "", vue: sp.vue ?? "personnes", avenir: sp.avenir ?? "" }} allValue={isTransversal(me) ? "" : "tous"} />

      <FreezeControl year={focusYear} frozen={freeze ? { at: fmtDate(freeze.frozenAt), by: freeze.frozenBy.name, note: freeze.note } : null} canFreeze={canEditFunding(me.role)} />
      {changedAfter.length > 0 && (
        <details className="mb-3 rounded-md border border-l-4 border-l-warning bg-card px-3.5 py-2 text-xs" data-testid="load-changed-after">
          <summary className="cursor-pointer list-none"><b>{changedAfter.length} modification{changedAfter.length > 1 ? "s" : ""} après validation</b> · {[...changedPeople].length} personne{changedPeople.size > 1 ? "s" : ""} concernée{changedPeople.size > 1 ? "s" : ""}</summary>
          <ul className="mt-1.5 grid gap-0.5 text-[11px] text-muted-foreground">{changedAfter.map((c) => <li key={c.id}>{fmtDate(c.createdAt, "D MMM HH:mm")} · {c.author.name} · <Link href={`/edition/${c.editionId}?onglet=temps`} className="text-primary hover:underline">{c.edition.project.name}</Link> · {c.before} → {c.after}</li>)}</ul>
        </details>
      )}
      {over.length > 0 && (
        <div className="mb-3 rounded-md border-l-4 border-l-danger bg-danger-soft/50 px-3.5 py-2.5 text-xs" data-testid="load-over">
          <b>Dépassements :</b> {over.map((r) => `${r.person.name} (${months.filter((m) => r.months[m].capacity > 0 && r.months[m].planned > r.months[m].capacity).map((m) => dayjs(m + "-01").format("MMM")).join(", ")})`).join(" · ")}.
        </div>
      )}

      {rows.length === 0 ? <EmptyState title="Personne dans ce périmètre" hint="Changez de pôle." /> : sp.vue === "projets" ? (
        <div className="overflow-auto rounded-md border bg-card" tabIndex={0} aria-label="Plan de charge par projet">
          <table className="w-full text-[12px]" style={{ minWidth: 200 + months.length * 64 }} data-testid="load-by-project">
            <thead className="sticky top-0 z-[2] bg-[#f1f5f6] text-[10px] font-semibold text-muted-foreground">
              <tr><th className="sticky left-0 z-[3] bg-[#f1f5f6] px-3 py-2.5 text-left">Édition</th>{months.map((m) => <th key={m} className={cn("px-1 py-2.5 text-center whitespace-nowrap", m === today && "bg-[#f5f1e4] text-foreground")}>{dayjs(m + "-01").format("MMM YY")}</th>)}<th className="px-2 py-2.5 text-right">Total</th></tr>
            </thead>
            <tbody>
              {editions.map(([id, e]) => {
                const t = months.reduce((s, m) => s + (e.months[m] ?? 0), 0);
                return (
                  <tr key={id} className="border-t border-[#e3e9eb]">
                    <td className="sticky left-0 z-[1] bg-card px-3 py-1.5 whitespace-nowrap"><Link href={`/edition/${id}?onglet=temps`} className="font-medium text-primary hover:underline">{e.project}</Link> <span className="text-muted-foreground">· {e.year}</span>{e.status !== "in_progress" && <span className="ml-1 rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">à venir</span>}</td>
                    {months.map((m) => <td key={m} className={cn("px-1 py-1.5 text-center tabular", !e.months[m] && "text-muted-foreground/50")}>{e.months[m] ? fmtNumber(e.months[m], 1) : "·"}</td>)}
                    <td className="px-2 py-1.5 text-right font-semibold tabular">{fmtNumber(t, 0)} j</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <LoadGrid rows={rows} months={months} today={today} groupByPole={!sp.pole} editions={editionOpts} changedPeople={[...changedPeople]} />
      )}

      <p className="mt-2.5 text-[10px] text-muted-foreground">Capacité d'un mois = jours disponibles de l'année (admin, congés déduits) répartis selon le rythme de la personne{settings.operatingDaysPerMonth ? `, moins ${settings.operatingDaysPerMonth} j de fonctionnement par mois (réunions transverses, café, entretiens)` : ""}. Cliquez une cellule pour modifier les jours de chaque édition ou en ajouter une (droit : pilote de l'édition, RAF, direction, responsable de pôle). « lissé » : total annuel non ventilé, étalé sur 12 mois — modifier un mois pose la ventilation, aussi possible depuis l'onglet Temps de l'édition. Ocre à partir de 85 % de la capacité, terre au-delà de 100 %. Sur les mois passés, « réel » = heures saisies ÷ {settings.hoursPerDay || 7}.</p>
    </div>
  );
}
