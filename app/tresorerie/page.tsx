import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Wallet } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";
import { canManageTreasury, canViewTreasury } from "@/lib/rights";
import { fmtEuro } from "@/lib/format";
import { withBase } from "@/lib/base-path";
import { addMonths, buildPlan, HR_CATEGORY, isMonth, loadActuals, loadCashRules, loadDerivedFlows, monthLabel, PERIODS, thisMonth, usualAmounts, type ActualCell } from "@/lib/treasury";
import { cn } from "@/lib/utils";
import { BalanceChart } from "./chart";
import { FlowsTable, NewRuleDialog, OpeningDialog, RuleRowActions, type FlowRow } from "./controls";
import { V, le, de, pl } from "@/lib/vocab";

// Trésorerie (module « tresorerie », 18/09 ; sous-onglets et réel : retour de Gaël le soir même). Douze mois de plan depuis le
// solde de départ, précédés des trois derniers mois **réels** (grand livre) ; le mois en cours en évidence. Onglets : le plan,
// les recettes attendues (versements des financeurs + saisies), les charges (saisies + factures et engagements), les
// ressources humaines (une ligne par personne ou poste), le réel (ce qui s'est passé, mois par mois, face au prévu).
const TABS = [{ key: "plan", label: "Plan" }, { key: "recettes", label: "Recettes attendues" }, { key: "charges", label: "Charges" }, { key: "rh", label: "Ressources humaines" }, { key: "reel", label: "Réel" }] as const;

export default async function TresoreriePage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const sp = await searchParams;
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  if (!instanceHas(settings, "tresorerie")) notFound();
  if (!canViewTreasury(me)) return <div className="p-6 text-sm text-muted-foreground" data-testid="treasury-denied">{`La trésorerie se consulte par ${le(V.direction)}, ${le(V.raf)} et les responsables ${de(V.pole)}.`}</div>;
  const rw = canManageTreasury(me);
  const vue = TABS.some((t) => t.key === sp.vue) ? sp.vue! : "plan";
  const current = thisMonth();
  const openingMonth = isMonth(settings.cashOpeningMonth) ? settings.cashOpeningMonth : current;
  const pastMonths = [addMonths(current, -3), addMonths(current, -2), addMonths(current, -1)];
  const [rules, derived, people] = await Promise.all([loadCashRules(), loadDerivedFlows(openingMonth), prisma.person.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  const plan = buildPlan({ openingMonth, opening: settings.cashOpeningBalance, threshold: settings.cashAlertThreshold, rules, derived });
  const actuals = await loadActuals([...pastMonths, ...plan.months]);
  const usual = usualAmounts(actuals.cells, pastMonths);
  const actual = (m: string, direction: "in" | "out", category: string) => actuals.cells.filter((c) => c.month === m && c.direction === direction && c.category === category).reduce((n, c) => n + c.amount, 0);
  const actualTotal = (m: string, direction: "in" | "out") => actuals.cells.filter((c) => c.month === m && c.direction === direction).reduce((n, c) => n + c.amount, 0);
  const points = plan.months.map((m, i) => ({ month: m, label: monthLabel(m), balance: plan.balances[i] }));
  // Lignes du tableau : celles du plan, plus les catégories qui n'existent que dans le réel des mois passés.
  const extraRows = Array.from(new Map(actuals.cells.filter((c) => pastMonths.includes(c.month) && !plan.rows.some((r) => r.direction === c.direction && r.category === c.category)).map((c) => [`${c.direction}|${c.category}`, { category: c.category, direction: c.direction, derived: false, cells: plan.months.map(() => 0), total: 0 }])).values());
  const rows = [...plan.rows, ...extraRows];
  const inRows = rows.filter((r) => r.direction === "in"); const outRows = rows.filter((r) => r.direction === "out");
  const hrRules = rules.filter((r) => r.kind === "hr"); const flowRules = rules.filter((r) => r.kind !== "hr");
  const categories = { in: Array.from(new Set(flowRules.filter((r) => r.direction === "in").map((r) => r.category))), out: Array.from(new Set(flowRules.filter((r) => r.direction === "out").map((r) => r.category))) };
  const monthly = (r: (typeof rules)[number]) => { const step = PERIODS.find((p) => p.value === r.period)?.step ?? 1; return step === 0 ? 0 : r.amount / step; };
  const monthLabels: Record<string, string> = {};
  for (const m of [...pastMonths, ...plan.months, ...rules.flatMap((r) => [r.startMonth, r.endMonth ?? ""]), ...derived.map((f) => f.month)]) if (m && !monthLabels[m]) monthLabels[m] = monthLabel(m);
  const flowRows = (direction: "in" | "out"): FlowRow[] => [
    ...flowRules.filter((r) => r.direction === direction).map((r) => ({ id: r.id, source: "saisie", label: r.label, category: r.category, period: r.period, startMonth: r.startMonth, endMonth: r.endMonth, amount: r.amount, monthly: monthly(r), notes: r.notes, active: r.active, rule: r })),
    ...derived.filter((f) => f.direction === direction).map((f) => ({ id: f.key, source: f.key.startsWith("pay:") ? "versement" : f.key.startsWith("due:") ? "cotisation" : f.category === "Factures à payer" ? "facture" : "engagement", label: f.label, category: f.category, period: null, startMonth: null, endMonth: null, amount: f.amount, monthly: 0, notes: null, active: true, href: f.href, month: f.month, late: f.late })),
  ];
  const late = derived.filter((f) => f.late);
  const Tile = ({ label, value, hint, tone, testId }: { label: string; value: string; hint?: string; tone?: string; testId?: string }) => <div className={cn("rounded-md border bg-card px-4 py-3", tone)} data-testid={testId}><div className="text-[22px] font-bold leading-tight tabular">{value}</div><div className="text-[11px] text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</div></div>;
  const cell = (n: number, strong?: boolean) => <span className={cn("tabular", n === 0 && "text-muted-foreground/50", strong && "font-semibold")}>{n === 0 ? "—" : fmtEuro(n)}</span>;
  const colCls = (m: string) => cn("px-2 py-1 text-right whitespace-nowrap", m === current && "bg-info-soft/60", pastMonths.includes(m) && "bg-muted/40 text-muted-foreground");
  const href = (v: string) => `/tresorerie${v === "plan" ? "" : `?vue=${v}`}`;
  const RuleList = ({ list, empty, testId }: { list: typeof rules; empty: string; testId: string }) => list.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">{empty}</p> : (
    <ul className="divide-y text-[13px]" data-testid={testId}>
      {list.map((r) => (
        <li key={r.id} className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-1.5", !r.active && "opacity-50")} data-testid={`rule-${r.id}`} data-label={r.label}>
          <span className="min-w-0"><b className="font-medium">{r.label}</b>{r.kind === "hr" && r.person ? <span className="text-xs text-muted-foreground"> · {r.person.name}</span> : ""} <span className="text-xs text-muted-foreground">· {r.kind === "hr" ? "par mois" : `${r.category} · ${PERIODS.find((p) => p.value === r.period)?.label.toLowerCase()}`} · {r.kind === "hr" ? "depuis" : "dès"} {monthLabel(r.startMonth)}{r.endMonth ? ` jusqu'à ${monthLabel(r.endMonth)}` : ""}</span>{r.notes && <span className="block text-[11px] text-muted-foreground" data-testid={`rule-notes-${r.id}`}>{r.notes}</span>}</span>
          <span className="flex items-center gap-2"><span className={cn("tabular font-semibold", r.direction === "in" ? "text-mint" : "text-danger")}>{r.direction === "in" ? "+" : "−"} {fmtEuro(r.amount)}</span>{rw && <RuleRowActions rule={r} usual={usual} people={people} />}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Wallet className="size-5 text-primary" aria-hidden />Trésorerie</span>}
        subtitle={<>Mois en cours : <b>{monthLabel(current, true)}</b> · plan sur douze mois depuis {monthLabel(openingMonth, true)} · solde de départ {fmtEuro(plan.opening)} · seuil {fmtEuro(plan.threshold)}{plan.alerts.length ? <span className="text-danger"> · {plan.alerts.length} mois sous le seuil</span> : <span className="text-mint"> · jamais sous le seuil</span>}</>}
        actions={<>
          <Button asChild variant="outline" size="sm"><a href={withBase("/tresorerie/export")} data-testid="treasury-export"><Download />Exporter</a></Button>
          {rw && <OpeningDialog balance={settings.cashOpeningBalance} month={openingMonth} threshold={settings.cashAlertThreshold} />}
          {rw && vue === "recettes" && <NewRuleDialog defaultMonth={current} preset="in" usual={usual} categories={categories} testId="new-rule-in" />}
          {rw && vue === "rh" && <NewRuleDialog defaultMonth={current} preset="hr" usual={usual} people={people} testId="new-rule-hr" />}
          {rw && vue === "plan" && <NewRuleDialog defaultMonth={current} preset="in" usual={usual} categories={categories} testId="new-rule-in" />}
          {rw && (vue === "charges" || vue === "plan" || vue === "reel") && <NewRuleDialog defaultMonth={current} preset="out" usual={usual} categories={categories} testId="new-rule" />}
        </>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b" data-testid="treasury-tabs">
        {TABS.map((t) => <Link key={t.key} href={href(t.key)} className={cn("-mb-px border-b-2 px-3 py-1.5 text-sm", vue === t.key ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")} aria-current={vue === t.key ? "page" : undefined} data-testid={`treasury-tab-${t.key}`}>{t.label}</Link>)}
      </div>

      {vue === "plan" && (
        <>
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
                <tr><th className="sticky left-0 bg-card px-3 py-1.5">Ligne</th>{pastMonths.map((m) => <th key={m} className={cn(colCls(m), "font-normal")} title="Réel (grand livre)">{monthLabel(m)}<span className="block text-[9px]">réel</span></th>)}{plan.months.map((m) => <th key={m} className={colCls(m)} data-testid={m === current ? "col-current" : undefined}>{monthLabel(m)}{m === current && <span className="block text-[9px] text-primary">en cours</span>}</th>)}<th className="px-3 py-1.5 text-right">12 mois</th></tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-muted/30"><td colSpan={plan.months.length + pastMonths.length + 2} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Encaissements</td></tr>
                {inRows.length === 0 && <tr><td colSpan={plan.months.length + pastMonths.length + 2} className="px-3 py-2 text-muted-foreground">Aucun encaissement attendu.</td></tr>}
                {inRows.map((r) => <tr key={`in:${r.category}`} data-testid={`row-in-${r.category}`}><td className="sticky left-0 bg-card px-3 py-1 whitespace-nowrap">{r.category}{r.derived && <span className="ml-1 text-[10px] text-muted-foreground" title="Calculé depuis les dossiers">· calculé</span>}</td>{pastMonths.map((m) => <td key={m} className={colCls(m)}>{cell(actual(m, "in", r.category))}</td>)}{r.cells.map((c, i) => <td key={i} className={colCls(plan.months[i])}>{cell(c)}</td>)}<td className="px-3 py-1 text-right">{cell(r.total, true)}</td></tr>)}
                <tr className="font-semibold" data-testid="row-in-total"><td className="sticky left-0 bg-card px-3 py-1">Total encaissements</td>{pastMonths.map((m) => <td key={m} className={colCls(m)}>{cell(actualTotal(m, "in"))}</td>)}{plan.inTotals.map((c, i) => <td key={i} className={colCls(plan.months[i])}>{cell(c)}</td>)}<td className="px-3 py-1 text-right">{cell(plan.totalIn, true)}</td></tr>
                <tr className="bg-muted/30"><td colSpan={plan.months.length + pastMonths.length + 2} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Décaissements</td></tr>
                {outRows.length === 0 && <tr><td colSpan={plan.months.length + pastMonths.length + 2} className="px-3 py-2 text-muted-foreground">Aucun décaissement prévu : ajoutez les charges (salaires, loyer…).</td></tr>}
                {outRows.map((r) => <tr key={`out:${r.category}`} data-testid={`row-out-${r.category}`}><td className="sticky left-0 bg-card px-3 py-1 whitespace-nowrap">{r.category}{r.derived && <span className="ml-1 text-[10px] text-muted-foreground" title="Calculé depuis les dossiers">· calculé</span>}</td>{pastMonths.map((m) => <td key={m} className={colCls(m)}>{cell(actual(m, "out", r.category))}</td>)}{r.cells.map((c, i) => <td key={i} className={colCls(plan.months[i])}>{cell(c)}</td>)}<td className="px-3 py-1 text-right">{cell(r.total, true)}</td></tr>)}
                <tr className="font-semibold" data-testid="row-out-total"><td className="sticky left-0 bg-card px-3 py-1">Total décaissements</td>{pastMonths.map((m) => <td key={m} className={colCls(m)}>{cell(actualTotal(m, "out"))}</td>)}{plan.outTotals.map((c, i) => <td key={i} className={colCls(plan.months[i])}>{cell(c)}</td>)}<td className="px-3 py-1 text-right">{cell(plan.totalOut, true)}</td></tr>
                <tr className="border-t-2 font-bold" data-testid="row-balance"><td className="sticky left-0 bg-card px-3 py-1.5">Solde fin de mois</td>{pastMonths.map((m) => <td key={m} className={colCls(m)}></td>)}{plan.balances.map((b, i) => <td key={i} className={cn("px-2 py-1.5 text-right tabular", b < 0 ? "bg-danger-soft text-danger" : b < plan.threshold ? "bg-warning-soft text-warning" : "", plan.months[i] === current && "ring-1 ring-inset ring-primary/30")} data-testid={`balance-${plan.months[i]}`} data-value={Math.round(b)}>{fmtEuro(b)}</td>)}<td className="px-3 py-1.5"></td></tr>
              </tbody>
            </table>
            <p className="px-3 py-1.5 text-[11px] text-muted-foreground">Les trois mois grisés sont le <b>réel</b> lu dans le grand livre ({actuals.source ? (actuals.source === "pennylane" ? "Pennylane" : "fichier importé") : "aucun import : Admin › Import / export › Réalisé comptable"}) ; le mois en cours et les suivants sont le <b>prévu</b>. Détail dans l&apos;onglet Réel.</p>
          </div>
        </>
      )}

      {vue === "recettes" && (
        <section className="rounded-md border bg-card" data-testid="treasury-in">
          <div className="px-4 pb-2 pt-3"><h2 className="text-[15px] font-bold">Recettes attendues</h2><p className="text-[11px] text-muted-foreground">Ce qu&apos;on attend d&apos;encaisser : les recettes saisies (subvention de fonctionnement, chiffre d&apos;affaires anticipé, remboursement… à une date ou récurrentes) et, calculés depuis les dossiers, les versements attendus des financeurs (à la date attendue ; en retard = placés sur le premier mois) et les cotisations à régler.</p></div>
          <FlowsTable rows={flowRows("in")} rw={rw} usual={usual} people={people} categories={categories} monthLabels={monthLabels} testId="flows-in" />
        </section>
      )}

      {vue === "charges" && (
        <section className="rounded-md border bg-card" data-testid="treasury-out">
          <div className="px-4 pb-2 pt-3"><h2 className="text-[15px] font-bold">Charges</h2><p className="text-[11px] text-muted-foreground">{`Ce qu'on va décaisser : les charges saisies (loyer, leasing, fonctionnement, prêt, assurances… avec un premier mois et un dernier si ça s'arrête) et, calculés depuis les ${pl(V.edition)}, les factures reçues non payées et les devis approuvés à facturer (sur le premier mois, par prudence). Les salaires sont dans l'onglet Ressources humaines.`}</p></div>
          <FlowsTable rows={flowRows("out")} rw={rw} usual={usual} people={people} categories={categories} monthLabels={monthLabels} testId="flows-out" />
        </section>
      )}

      {vue === "rh" && (
        <section className="rounded-md border bg-card" data-testid="treasury-hr">
          <div className="flex flex-wrap items-start justify-between gap-2 px-4 pb-2 pt-3"><div><h2 className="text-[15px] font-bold">Ressources humaines</h2><p className="text-[11px] text-muted-foreground">Une ligne par personne ou poste : son coût mensuel chargé, depuis quand, jusqu&apos;à quand. Le total alimente « Salaires et charges » du plan ; une embauche en mars ou une fin de contrat en juin se lisent ici.</p></div><span className="text-sm tabular" data-testid="hr-total"><b>{fmtEuro(hrRules.filter((r) => r.active).reduce((n, r) => n + r.amount, 0))}</b> <span className="text-xs text-muted-foreground">par mois aujourd&apos;hui{usual[`out|${HR_CATEGORY}`] ? ` · réel des 3 derniers mois : ${fmtEuro(usual[`out|${HR_CATEGORY}`])} par mois` : ""}</span></span></div>
          <RuleList list={hrRules} empty="Aucune ressource humaine saisie : ajoutez l'équipe (ou un montant global en charge « Salaires et charges »)." testId="rules-hr" />
        </section>
      )}

      {vue === "reel" && (
        <section className="rounded-md border bg-card" data-testid="treasury-actuals">
          <div className="px-4 pb-2 pt-3"><h2 className="text-[15px] font-bold">Réel — ce qui s&apos;est passé</h2><p className="text-[11px] text-muted-foreground">Écritures datées du grand livre ({actuals.source ? (actuals.source === "pennylane" ? "Pennylane" : "fichier importé") : "aucun import"}), rangées dans les catégories du plan d&apos;après le compte (64 → salaires, 613 → loyer, 74 → versements des financeurs, 756 → cotisations…). Réel comptable, pas bancaire : les relevés de compte viendront plus tard. Le mois en cours montre le réel à date face au prévu.</p></div>
          {actuals.cells.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">Pas encore de réel : importez le grand livre (Admin › Import / export › Réalisé comptable) ou branchez Pennylane.</p> : (
            <table className="w-full text-[12px]" data-testid="actuals-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="px-3 py-1.5">Catégorie</th>{pastMonths.map((m) => <th key={m} className="px-2 py-1.5 text-right">{monthLabel(m)}</th>)}<th className="px-2 py-1.5 text-right bg-info-soft/60" colSpan={3}>{monthLabel(current)} · en cours<span className="block text-[9px] font-normal">réel à date · prévu · écart</span></th></tr></thead>
              <tbody className="divide-y">
                {(["in", "out"] as const).map((dir) => <RealRows key={dir} dir={dir} rows={rows.filter((r) => r.direction === dir)} pastMonths={pastMonths} current={current} plan={plan} cells={actuals.cells} />)}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

function RealRows({ dir, rows, pastMonths, current, plan, cells }: { dir: "in" | "out"; rows: { category: string; direction: "in" | "out"; cells: number[] }[]; pastMonths: string[]; current: string; plan: { months: string[] }; cells: ActualCell[] }) {
  const actual = (m: string, category: string) => cells.filter((c) => c.month === m && c.direction === dir && c.category === category).reduce((n, c) => n + c.amount, 0);
  const ci = plan.months.indexOf(current);
  const fmt = (n: number) => n === 0 ? <span className="text-muted-foreground/50">—</span> : <span className="tabular">{fmtEuro(n)}</span>;
  return (
    <>
      <tr className="bg-muted/30"><td colSpan={pastMonths.length + 4} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{dir === "in" ? "Encaissements" : "Décaissements"}</td></tr>
      {rows.map((r) => {
        const real = actual(current, r.category); const planned = ci >= 0 ? r.cells[ci] : 0; const gap = real - planned;
        return <tr key={r.category} data-testid={`real-${dir}-${r.category}`}><td className="px-3 py-1 whitespace-nowrap">{r.category}</td>{pastMonths.map((m) => <td key={m} className="px-2 py-1 text-right">{fmt(actual(m, r.category))}</td>)}<td className="px-2 py-1 text-right bg-info-soft/40">{fmt(real)}</td><td className="px-2 py-1 text-right bg-info-soft/40 text-muted-foreground">{fmt(planned)}</td><td className={cn("px-2 py-1 text-right bg-info-soft/40 tabular", gap !== 0 && (dir === "out" ? gap > 0 : gap < 0) ? "text-danger" : gap !== 0 ? "text-mint" : "text-muted-foreground/50")}>{gap === 0 ? "—" : `${gap > 0 ? "+" : "−"} ${fmtEuro(Math.abs(gap))}`}</td></tr>;
      })}
    </>
  );
}
