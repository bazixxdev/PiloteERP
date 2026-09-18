import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Wallet } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";
import { canManageTreasury, canViewTreasury } from "@/lib/rights";
import { fmtEuro } from "@/lib/format";
import { withBase } from "@/lib/base-path";
import { buildPlan, isMonth, loadCashRules, loadDerivedFlows, monthLabel, PERIODS, thisMonth } from "@/lib/treasury";
import { cn } from "@/lib/utils";
import { BalanceChart } from "./chart";
import { NewRuleDialog, OpeningDialog, RuleRowActions } from "./controls";

// Trésorerie (module « tresorerie », 18/09) : douze mois glissants depuis le solde de départ. Lignes dérivées des dossiers
// (versements attendus, factures et engagements, cotisations) + règles saisies ; solde fin de mois, point bas, seuil.
export default async function TresoreriePage() {
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  if (!instanceHas(settings, "tresorerie")) notFound();
  if (!canViewTreasury(me)) return <div className="p-6 text-sm text-muted-foreground" data-testid="treasury-denied">La trésorerie se consulte par la direction, la RAF et les responsables de pôle.</div>;
  const rw = canManageTreasury(me);
  const openingMonth = isMonth(settings.cashOpeningMonth) ? settings.cashOpeningMonth : thisMonth();
  const [rules, derived] = await Promise.all([loadCashRules(), loadDerivedFlows(openingMonth)]);
  const plan = buildPlan({ openingMonth, opening: settings.cashOpeningBalance, threshold: settings.cashAlertThreshold, rules, derived });
  const points = plan.months.map((m, i) => ({ month: m, label: monthLabel(m), balance: plan.balances[i] }));
  const inRows = plan.rows.filter((r) => r.direction === "in");
  const outRows = plan.rows.filter((r) => r.direction === "out");
  const Tile = ({ label, value, hint, tone, testId }: { label: string; value: string; hint?: string; tone?: string; testId?: string }) => <div className={cn("rounded-md border bg-card px-4 py-3", tone)} data-testid={testId}><div className="text-[22px] font-bold leading-tight tabular">{value}</div><div className="text-[11px] text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</div></div>;
  const cell = (n: number, strong?: boolean) => <span className={cn("tabular", n === 0 && "text-muted-foreground/50", strong && "font-semibold")}>{n === 0 ? "—" : fmtEuro(n)}</span>;
  const late = derived.filter((f) => f.late);
  const groups = [
    { key: "pay", title: "Versements attendus des financeurs", hint: "Tranches et versements non reçus, à la date attendue ; en retard = attendus avant le mois de départ, placés sur le premier mois.", flows: derived.filter((f) => f.key.startsWith("pay:")) },
    { key: "exp", title: "Factures et engagements", hint: "Dépenses ouvertes des éditions : factures reçues non payées, devis approuvés à facturer — sur le premier mois, par prudence.", flows: derived.filter((f) => f.key.startsWith("exp:")) },
    { key: "due", title: "Cotisations à régler", hint: "Adhésions à régler (module Adhérents), sur le premier mois.", flows: derived.filter((f) => f.key.startsWith("due:")) },
  ];
  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Wallet className="size-5 text-primary" aria-hidden />Plan de trésorerie</span>}
        subtitle={<>Douze mois depuis {monthLabel(openingMonth, true)} · solde de départ {fmtEuro(plan.opening)} · seuil d&apos;alerte {fmtEuro(plan.threshold)}{plan.alerts.length ? <span className="text-danger"> · {plan.alerts.length} mois sous le seuil</span> : <span className="text-mint"> · jamais sous le seuil</span>}</>}
        actions={<>
          <Button asChild variant="outline" size="sm"><a href={withBase("/tresorerie/export")} data-testid="treasury-export"><Download />Exporter</a></Button>
          {rw && <OpeningDialog balance={settings.cashOpeningBalance} month={openingMonth} threshold={settings.cashAlertThreshold} />}
          {rw && <NewRuleDialog defaultMonth={openingMonth} />}
        </>}
      />
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="treasury-tiles">
        <Tile label="solde de départ" value={fmtEuro(plan.opening)} hint={monthLabel(openingMonth, true)} testId="tile-opening" />
        <Tile label="point bas" value={fmtEuro(plan.low.balance)} hint={monthLabel(plan.low.month, true)} tone={plan.low.balance < plan.threshold ? (plan.low.balance < 0 ? "border-danger/50" : "border-warning/50") : "border-mint/40"} testId="tile-low" />
        <Tile label="encaissements sur 12 mois" value={fmtEuro(plan.totalIn)} hint={late.length ? `${late.length} versement${late.length > 1 ? "s" : ""} en retard` : undefined} testId="tile-in" />
        <Tile label="décaissements sur 12 mois" value={fmtEuro(plan.totalOut)} hint={`solde fin de période ${fmtEuro(plan.balances[plan.balances.length - 1])}`} testId="tile-out" />
      </div>
      <div className="mb-4 rounded-md border bg-card p-3"><BalanceChart points={points} threshold={plan.threshold} /></div>

      <div className="mb-4 overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-[12px]" data-testid="treasury-table">
          <thead className="text-left text-[10px] font-semibold text-muted-foreground">
            <tr><th className="sticky left-0 bg-card px-3 py-1.5">Ligne</th>{plan.months.map((m) => <th key={m} className="px-2 py-1.5 text-right whitespace-nowrap">{monthLabel(m)}</th>)}<th className="px-3 py-1.5 text-right">12 mois</th></tr>
          </thead>
          <tbody className="divide-y">
            <tr className="bg-muted/30"><td colSpan={plan.months.length + 2} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Encaissements</td></tr>
            {inRows.length === 0 && <tr><td colSpan={plan.months.length + 2} className="px-3 py-2 text-muted-foreground">Aucun encaissement attendu.</td></tr>}
            {inRows.map((r) => <tr key={`in:${r.category}`} data-testid={`row-in-${r.category}`}><td className="sticky left-0 bg-card px-3 py-1 whitespace-nowrap">{r.category}{r.derived && <span className="ml-1 text-[10px] text-muted-foreground" title="Calculé depuis les dossiers">· calculé</span>}</td>{r.cells.map((c, i) => <td key={i} className="px-2 py-1 text-right">{cell(c)}</td>)}<td className="px-3 py-1 text-right">{cell(r.total, true)}</td></tr>)}
            <tr className="font-semibold" data-testid="row-in-total"><td className="sticky left-0 bg-card px-3 py-1">Total encaissements</td>{plan.inTotals.map((c, i) => <td key={i} className="px-2 py-1 text-right">{cell(c)}</td>)}<td className="px-3 py-1 text-right">{cell(plan.totalIn, true)}</td></tr>
            <tr className="bg-muted/30"><td colSpan={plan.months.length + 2} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Décaissements</td></tr>
            {outRows.length === 0 && <tr><td colSpan={plan.months.length + 2} className="px-3 py-2 text-muted-foreground">Aucun décaissement prévu : ajoutez les règles (salaires et charges, loyer…).</td></tr>}
            {outRows.map((r) => <tr key={`out:${r.category}`} data-testid={`row-out-${r.category}`}><td className="sticky left-0 bg-card px-3 py-1 whitespace-nowrap">{r.category}{r.derived && <span className="ml-1 text-[10px] text-muted-foreground" title="Calculé depuis les dossiers">· calculé</span>}</td>{r.cells.map((c, i) => <td key={i} className="px-2 py-1 text-right">{cell(c)}</td>)}<td className="px-3 py-1 text-right">{cell(r.total, true)}</td></tr>)}
            <tr className="font-semibold" data-testid="row-out-total"><td className="sticky left-0 bg-card px-3 py-1">Total décaissements</td>{plan.outTotals.map((c, i) => <td key={i} className="px-2 py-1 text-right">{cell(c)}</td>)}<td className="px-3 py-1 text-right">{cell(plan.totalOut, true)}</td></tr>
            <tr className="border-t-2 font-bold" data-testid="row-balance"><td className="sticky left-0 bg-card px-3 py-1.5">Solde fin de mois</td>{plan.balances.map((b, i) => <td key={i} className={cn("px-2 py-1.5 text-right tabular", b < 0 ? "bg-danger-soft text-danger" : b < plan.threshold ? "bg-warning-soft text-warning" : "")} data-testid={`balance-${plan.months[i]}`} data-value={Math.round(b)}>{fmtEuro(b)}</td>)}<td className="px-3 py-1.5"></td></tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border bg-card" data-testid="treasury-rules">
          <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3"><div><h2 className="text-[15px] font-bold">Règles de flux</h2><p className="text-[11px] text-muted-foreground">Ce qui ne se déduit pas des dossiers : salaires et charges, loyer, subvention de fonctionnement, prestations… Décochée, une règle sort du plan sans disparaître.</p></div></div>
          {rules.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">Aucune règle encore.</p> : (
            <ul className="divide-y text-[13px]">
              {rules.map((r) => (
                <li key={r.id} className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-1.5", !r.active && "opacity-50")} data-testid={`rule-${r.id}`} data-label={r.label}>
                  <span className="min-w-0"><b className="font-medium">{r.label}</b> <span className="text-xs text-muted-foreground">· {r.category} · {PERIODS.find((p) => p.value === r.period)?.label.toLowerCase()} · dès {monthLabel(r.startMonth)}{r.endMonth ? ` jusqu'à ${monthLabel(r.endMonth)}` : ""}{r.notes ? ` · ${r.notes}` : ""}</span></span>
                  <span className="flex items-center gap-2"><span className={cn("tabular font-semibold", r.direction === "in" ? "text-mint" : "text-danger")}>{r.direction === "in" ? "+" : "−"} {fmtEuro(r.amount)}</span>{rw && <RuleRowActions rule={r} />}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="grid content-start gap-4">
          {groups.map((g) => (
            <section key={g.key} className="rounded-md border bg-card" data-testid={`treasury-${g.key}`}>
              <div className="px-4 pb-2 pt-3"><h2 className="text-[15px] font-bold">{g.title} <span className="text-xs font-normal text-muted-foreground">· {fmtEuro(g.flows.reduce((n, f) => n + f.amount, 0))}</span></h2><p className="text-[11px] text-muted-foreground">{g.hint}</p></div>
              {g.flows.length === 0 ? <p className="px-4 pb-3 text-xs text-muted-foreground">Rien pour l&apos;instant.</p> : (
                <ul className="divide-y text-xs">
                  {g.flows.slice(0, 12).map((f) => (
                    <li key={f.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-1">
                      <span className="min-w-0">{f.href ? <Link href={f.href} className="text-primary hover:underline">{f.label}</Link> : f.label}<span className="text-muted-foreground"> · {monthLabel(f.month)}{f.late ? <span className="text-danger"> · en retard</span> : ""}</span></span>
                      <span className="tabular whitespace-nowrap">{fmtEuro(f.amount)}</span>
                    </li>
                  ))}
                  {g.flows.length > 12 && <li className="px-4 py-1 text-muted-foreground">… et {g.flows.length - 12} de plus</li>}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
