import { prisma } from "./db";

// Trésorerie (module « tresorerie », 18/09). Un plan mensuel sur douze mois glissants, calculé : ce que les dossiers savent
// déjà (versements attendus des financeurs, factures reçues et engagements des éditions, cotisations à régler) plus les
// règles saisies (salaires et charges, loyer, subvention de fonctionnement, prestations…). Rien n'est ressaisi ; le solde de
// départ vient du relevé bancaire (paramètres). Module pur pour la projection : pas de base, testable.

export type Month = string; // AAAA-MM
export const PERIODS: { value: string; label: string; step: number }[] = [
  { value: "monthly", label: "Chaque mois", step: 1 },
  { value: "quarterly", label: "Chaque trimestre", step: 3 },
  { value: "semiannual", label: "Chaque semestre", step: 6 },
  { value: "annual", label: "Chaque année", step: 12 },
  { value: "once", label: "Une fois", step: 0 },
];
export const DIRECTIONS = [{ value: "in", label: "Encaissement" }, { value: "out", label: "Décaissement" }];
// Catégories proposées (libellé libre accepté) : celles d'un budget associatif.
export const CASH_CATEGORIES = { in: ["Subvention de fonctionnement", "Cotisations", "Prestations et ventes", "Produits financiers", "Autres encaissements"], out: ["Salaires et charges", "Loyer et charges locatives", "Fonctionnement", "Prestataires", "Déplacements", "Impôts et taxes", "Remboursement d'emprunt", "Autres décaissements"] };

export const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const thisMonth = () => monthOf(new Date());
export function addMonths(m: Month, n: number): Month {
  const [y, mo] = m.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
export const monthDiff = (a: Month, b: Month) => { const [ya, ma] = a.split("-").map(Number); const [yb, mb] = b.split("-").map(Number); return (yb * 12 + mb) - (ya * 12 + ma); };
export const isMonth = (s: string | null | undefined): s is Month => Boolean(s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s));
export function monthLabel(m: Month, long = false): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("fr-FR", long ? { month: "long", year: "numeric" } : { month: "short", year: "2-digit" });
}

export type CashRuleInput = { id: string; label: string; direction: string; category: string; amount: number; period: string; startMonth: string; endMonth: string | null; active: boolean };
// Un flux dérivé des dossiers : versement attendu, facture, engagement, cotisation.
export type DerivedFlow = { key: string; label: string; direction: "in" | "out"; category: string; amount: number; month: Month; late?: boolean; href?: string; hint?: string };

export type PlanRow = { category: string; direction: "in" | "out"; derived: boolean; cells: number[]; total: number };
export type Plan = {
  months: Month[];
  rows: PlanRow[];
  inTotals: number[]; outTotals: number[]; balances: number[];
  opening: number; openingMonth: Month; threshold: number;
  low: { month: Month; balance: number }; alerts: Month[];
  totalIn: number; totalOut: number;
};

// Les mois où une règle tombe dans la fenêtre.
export function ruleMonths(rule: CashRuleInput, months: Month[]): Month[] {
  if (!rule.active || !isMonth(rule.startMonth)) return [];
  const step = PERIODS.find((p) => p.value === rule.period)?.step ?? 1;
  return months.filter((m) => {
    const d = monthDiff(rule.startMonth, m);
    if (d < 0) return false;
    if (rule.endMonth && isMonth(rule.endMonth) && monthDiff(rule.endMonth, m) > 0) return false;
    return step === 0 ? d === 0 : d % step === 0;
  });
}

// Le plan : fenêtre de `count` mois depuis le mois d'ouverture ; les flux dérivés datés avant la fenêtre tombent dans le premier
// mois (en retard, mais attendus) ; les lignes sont regroupées par catégorie, encaissements puis décaissements.
export function buildPlan(opts: { openingMonth: Month; opening: number; threshold: number; count?: number; rules: CashRuleInput[]; derived: DerivedFlow[] }): Plan {
  const count = opts.count ?? 12;
  const months = Array.from({ length: count }, (_, i) => addMonths(opts.openingMonth, i));
  const idx = new Map(months.map((m, i) => [m, i]));
  const rowsMap = new Map<string, PlanRow>();
  const row = (category: string, direction: "in" | "out", derived: boolean) => {
    const key = `${direction}:${category}`;
    let r = rowsMap.get(key);
    if (!r) { r = { category, direction, derived, cells: months.map(() => 0), total: 0 }; rowsMap.set(key, r); }
    return r;
  };
  for (const f of opts.derived) {
    const i = idx.get(f.month) ?? (monthDiff(f.month, months[0]) > 0 ? 0 : -1);
    if (i < 0) continue;
    const r = row(f.category, f.direction, true); r.cells[i] += f.amount; r.total += f.amount;
  }
  for (const rule of opts.rules) {
    const dir = rule.direction === "in" ? "in" : "out";
    for (const m of ruleMonths(rule, months)) { const r = row(rule.category, dir, false); r.cells[idx.get(m)!] += rule.amount; r.total += rule.amount; }
  }
  const rows = Array.from(rowsMap.values()).sort((a, b) => (a.direction === b.direction ? (Number(b.derived) - Number(a.derived)) || b.total - a.total : a.direction === "in" ? -1 : 1));
  const inTotals = months.map((_, i) => rows.filter((r) => r.direction === "in").reduce((n, r) => n + r.cells[i], 0));
  const outTotals = months.map((_, i) => rows.filter((r) => r.direction === "out").reduce((n, r) => n + r.cells[i], 0));
  const balances: number[] = [];
  let bal = opts.opening;
  for (let i = 0; i < count; i++) { bal += inTotals[i] - outTotals[i]; balances.push(bal); }
  let lowI = 0; balances.forEach((b, i) => { if (b < balances[lowI]) lowI = i; });
  return {
    months, rows, inTotals, outTotals, balances, opening: opts.opening, openingMonth: opts.openingMonth, threshold: opts.threshold,
    low: { month: months[lowI], balance: balances[lowI] }, alerts: months.filter((_, i) => balances[i] < opts.threshold),
    totalIn: inTotals.reduce((a, b) => a + b, 0), totalOut: outTotals.reduce((a, b) => a + b, 0),
  };
}

// Les flux que l'outil connaît déjà.
export async function loadDerivedFlows(from: Month): Promise<DerivedFlow[]> {
  const year = Number(from.slice(0, 4));
  const [payments, expenses, dues] = await Promise.all([
    prisma.payment.findMany({ where: { receivedAt: null }, include: { fundingLine: { select: { id: true, editionId: true, funder: { select: { name: true } }, edition: { select: { project: { select: { name: true } }, year: true } } } }, convention: { select: { id: true, reference: true, funder: { select: { name: true } } } } }, orderBy: { expectedAt: "asc" } }),
    prisma.expense.findMany({ where: { status: "open" }, include: { edition: { select: { id: true, year: true, project: { select: { name: true } } } } } }),
    prisma.membership.findMany({ where: { status: "due", year: { gte: year - 1 } }, include: { organisation: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } } }),
  ]);
  const out: DerivedFlow[] = [];
  for (const p of payments) {
    const m = monthOf(p.expectedAt);
    const who = p.convention ? `${p.convention.funder.name} · ${p.convention.reference}` : p.fundingLine ? `${p.fundingLine.funder.name} · ${p.fundingLine.edition.project.name} ${p.fundingLine.edition.year}` : "";
    out.push({ key: `pay:${p.id}`, label: `${p.label} — ${who}`, direction: "in", category: "Versements des financeurs", amount: p.amount, month: m, late: monthDiff(m, from) > 0, href: p.convention ? `/conventions/${p.convention.id}` : p.fundingLine ? `/edition/${p.fundingLine.editionId}?onglet=budget` : undefined });
  }
  for (const e of expenses) {
    const remaining = Math.max(0, e.committed - e.spent);
    const invoiced = e.invoiceReceivedAt && !e.paidAt;
    const amount = invoiced ? (e.spent > 0 ? e.spent : e.committed) : remaining;
    if (amount <= 0) continue;
    out.push({ key: `exp:${e.id}`, label: `${e.label}${e.supplier ? ` — ${e.supplier}` : ""} · ${e.edition.project.name} ${e.edition.year}`, direction: "out", category: invoiced ? "Factures à payer" : "Engagements à facturer", amount, month: from, href: `/edition/${e.edition.id}?onglet=budget`, hint: invoiced ? "facture reçue, non payée" : "devis approuvé, facture à venir (placé sur le premier mois, par prudence)" });
  }
  for (const d of dues) {
    if (d.amount <= 0) continue;
    out.push({ key: `due:${d.id}`, label: `Cotisation ${d.year} — ${d.organisation?.name ?? [d.contact?.firstName, d.contact?.lastName].filter(Boolean).join(" ")}`, direction: "in", category: "Cotisations à régler", amount: d.amount, month: from, href: `/adherents?annee=${d.year}&statut=due`, hint: "placée sur le premier mois : à encaisser" });
  }
  return out;
}

export async function loadCashRules() {
  return prisma.cashRule.findMany({ orderBy: [{ direction: "asc" }, { category: "asc" }, { label: "asc" }] });
}

// Export CSV du plan (point-virgule, BOM).
export function planToCsv(plan: Plan): string {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const lines = [["Ligne", "Sens", ...plan.months.map((m) => monthLabel(m)), "Total"].map(esc).join(";")];
  lines.push(["Solde de départ", "", num(plan.opening), ...plan.months.slice(1).map(() => ""), ""].join(";"));
  for (const r of plan.rows) lines.push([r.category, r.direction === "in" ? "Encaissement" : "Décaissement", ...r.cells.map(num), num(r.total)].map(esc).join(";"));
  lines.push(["Total encaissements", "", ...plan.inTotals.map(num), num(plan.totalIn)].join(";"));
  lines.push(["Total décaissements", "", ...plan.outTotals.map(num), num(plan.totalOut)].join(";"));
  lines.push(["Solde fin de mois", "", ...plan.balances.map(num), ""].join(";"));
  return "﻿" + lines.join("\n");
}
