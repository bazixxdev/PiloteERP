"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect, Select } from "@/components/common/searchable-select";
import { createCashRule, deleteCashRule, setTreasuryOpening, toggleCashRule, updateCashRule, type CashRuleForm } from "@/app/actions/treasury";
import { CASH_CATEGORIES, PERIODS, type CashRuleInput } from "@/lib/treasury";
import { cn } from "@/lib/utils";

type Run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: () => void) => void;
function useRun(): [boolean, Run] {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run: Run = (fn, after) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  return [pending, run];
}

// Solde de départ : le relevé bancaire à un mois donné, et le seuil sous lequel on s'inquiète.
export function OpeningDialog({ balance, month, threshold }: { balance: number; month: string; threshold: number }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ balance: String(balance), month, threshold: String(threshold) });
  const [pending, run] = useRun();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" data-testid="treasury-opening"><Wallet />Solde de départ</Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Solde de départ et seuil</DialogTitle></DialogHeader>
        <form className="grid gap-3 text-xs" onSubmit={(e) => { e.preventDefault(); run(() => setTreasuryOpening(form), () => { setOpen(false); toast.success("Solde de départ enregistré"); }); }}>
          <p className="text-muted-foreground">Le solde du relevé bancaire au premier jour du mois choisi ; le plan part de là sur douze mois.</p>
          <label className="grid gap-1"><span className="font-semibold">Mois</span><Input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="h-8" data-testid="opening-month" /></label>
          <label className="grid gap-1"><span className="font-semibold">Solde (€)</span><Input inputMode="decimal" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} className="h-8 text-right" data-testid="opening-balance" /></label>
          <label className="grid gap-1"><span className="font-semibold">Seuil d&apos;alerte (€)</span><Input inputMode="decimal" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} className="h-8 text-right" data-testid="opening-threshold" /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" size="sm" disabled={pending} data-testid="opening-submit">Enregistrer</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY: CashRuleForm = { label: "", direction: "out", category: "", amount: "", period: "monthly", startMonth: "", endMonth: "", notes: "", kind: "flow", personId: null };

// Une règle de flux : récurrente (mois, trimestre, semestre, année) ou ponctuelle.
export type UsualMap = Record<string, number>; // « direction|catégorie » → montant mensuel habituel (réel des 3 derniers mois)

export type CategoryLists = { in: string[]; out: string[] };

// La catégorie : la même liste déroulante que partout, avec les catégories du plan et celles déjà en usage ; « Autre… » ouvre
// un champ libre (retour de Gaël : la liste à suggestions du navigateur détonnait).
function CategoryPicker({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const known = options.includes(value);
  const [custom, setCustom] = useState(Boolean(value) && !known);
  return (
    <div className="grid gap-1"><span className="font-semibold">Catégorie</span>
      <Select value={custom ? "__autre" : value} onChange={(e) => { if (e.target.value === "__autre") { setCustom(true); onChange(""); } else { setCustom(false); onChange(e.target.value); } }} className="h-8 text-xs" aria-label="Catégorie" data-testid="rule-category">
        <option value="">— choisir —</option>
        {options.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value="__autre">Autre…</option>
      </Select>
      {custom && <Input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="Nom de la nouvelle catégorie" className="h-8" data-testid="rule-category-custom" />}
    </div>
  );
}

function RuleForm({ initial, onSubmit, pending, submitLabel, editing, usual = {}, people = [], categories }: { initial: CashRuleForm; onSubmit: (f: CashRuleForm, from: string | null) => void; pending: boolean; submitLabel: string; editing?: boolean; usual?: UsualMap; people?: { id: string; name: string }[]; categories?: CategoryLists }) {
  const [f, setF] = useState<CashRuleForm>(initial);
  const [fromMode, setFromMode] = useState(false);
  const [from, setFrom] = useState("");
  const hr = f.kind === "hr";
  const cats = f.direction === "in" ? CASH_CATEGORIES.in : CASH_CATEGORIES.out;
  const usualHere = f.category ? usual[`${f.direction}|${f.category}`] : undefined;
  return (
    <form className="grid gap-3 text-xs" onSubmit={(e) => { e.preventDefault(); onSubmit(f, fromMode && from ? from : null); }}>
      {!editing && !hr && <p className="text-muted-foreground">Un leasing dès février, une subvention en juin, du chiffre d&apos;affaires attendu : le montant, la fréquence, le premier mois — et le dernier si ça s&apos;arrête.</p>}
      {!editing && hr && <p className="text-muted-foreground">Une personne de l&apos;équipe ou un poste à pourvoir : son coût mensuel chargé, depuis quand, jusqu&apos;à quand (fin de contrat). La ligne va dans « Salaires et charges ».</p>}
      {/* Le sens est donné par le dialogue (Nouvelle charge / Nouvelle recette) : pas de bascule à choisir. */}
      {hr && people.length > 0 && <div className="grid gap-1"><span className="font-semibold">Personne de l&apos;équipe <span className="font-normal text-muted-foreground">(facultatif : un poste à pourvoir n&apos;en a pas)</span></span><SearchableSelect options={people.map((p) => ({ value: p.id, label: p.name }))} value={f.personId ?? ""} onChange={(v) => setF({ ...f, personId: v || null, label: f.label || people.find((p) => p.id === v)?.name || "" })} emptyOption="— un poste, sans personne —" aria-label="Personne" className="h-8 w-full text-xs" data-testid="rule-person" /></div>}
      <label className="grid gap-1"><span className="font-semibold">{hr ? "Nom ou poste" : "Libellé"}</span><Input autoFocus value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={hr ? "Chargé·e de mission transition (CDI), Alternance communication…" : "Leasing véhicule, Subvention de fonctionnement Région, Formations facturées…"} className="h-8" data-testid="rule-label" /></label>
      <div className={cn("grid gap-1.5", hr ? "grid-cols-1" : "grid-cols-[1fr_8rem]")}>
        {!hr && <CategoryPicker value={f.category} options={Array.from(new Set([...cats, ...(categories?.[f.direction === "in" ? "in" : "out"] ?? [])]))} onChange={(v) => setF({ ...f, category: v })} />}
        <label className="grid gap-1"><span className="font-semibold">{hr ? "Coût mensuel chargé (€)" : "Montant (€)"}</span><Input inputMode="decimal" value={String(f.amount)} onChange={(e) => setF({ ...f, amount: e.target.value })} className="h-8 text-right" data-testid="rule-amount" />{usualHere ? <span className="text-[11px] text-muted-foreground" data-testid="rule-usual">D&apos;habitude sur cette catégorie : {usualHere.toLocaleString("fr-FR")} € par mois (réel des 3 derniers mois) — <button type="button" className="text-primary hover:underline" onClick={() => setF({ ...f, amount: String(usualHere) })}>reprendre</button></span> : null}</label>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {!hr && <label className="grid gap-1"><span className="font-semibold">Périodicité</span><Select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} className="h-8 text-xs" aria-label="Périodicité" data-testid="rule-period">{PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select></label>}
        <label className="grid gap-1"><span className="font-semibold">{f.period === "once" ? "Mois" : hr ? "Depuis" : "Premier mois"}</span><Input type="month" value={f.startMonth} onChange={(e) => setF({ ...f, startMonth: e.target.value })} className="h-8" data-testid="rule-start" /></label>
        {f.period !== "once" && <label className="grid gap-1"><span className="font-semibold">{hr ? "Jusqu'à (fin de contrat)" : "Dernier mois"} <span className="font-normal text-muted-foreground">(facultatif)</span></span><Input type="month" value={f.endMonth ?? ""} onChange={(e) => setF({ ...f, endMonth: e.target.value })} className="h-8" data-testid="rule-end" /></label>}
      </div>
      <label className="grid gap-1"><span className="font-semibold">Commentaire <span className="font-normal text-muted-foreground">· de quoi il s&apos;agit concrètement</span></span><Input value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={hr ? "temps plein, CDI, financé à 50 % sur la convention Région…" : "d'où vient le montant, à quoi ça correspond"} className="h-8" data-testid="rule-notes" /></label>
      {editing && f.period !== "once" && (
        <div className="grid gap-1 rounded-md border border-dashed p-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={fromMode} onChange={(e) => setFromMode(e.target.checked)} className="size-3.5 accent-primary" data-testid="rule-from-mode" /><span className="font-semibold">Ce changement ne vaut qu&apos;à partir d&apos;un mois</span></label>
          <p className="text-muted-foreground">L&apos;ancien montant reste jusqu&apos;au mois d&apos;avant (un salaire qui change, un loyer qui augmente).</p>
          {fromMode && <Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" aria-label="À partir de" data-testid="rule-from" />}
        </div>
      )}
      <div className="flex justify-end"><Button type="submit" size="sm" disabled={pending || !f.label.trim() || !f.startMonth || !String(f.amount).trim() || (fromMode && !from)} data-testid="rule-submit">{submitLabel}</Button></div>
    </form>
  );
}

export function NewRuleDialog({ defaultMonth, preset = "out", usual, people, categories, testId = "new-rule" }: { defaultMonth: string; preset?: "in" | "out" | "hr"; usual?: UsualMap; people?: { id: string; name: string }[]; categories?: CategoryLists; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, run] = useRun();
  const title = preset === "in" ? "Une recette attendue" : preset === "hr" ? "Une ressource humaine" : "Une charge à venir";
  const label = preset === "in" ? "Nouvelle recette" : preset === "hr" ? "Nouvelle ressource" : "Nouvelle charge";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" data-testid={testId}><Plus />{label}</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {open && <RuleForm initial={{ ...EMPTY, startMonth: defaultMonth, direction: preset === "in" ? "in" : "out", kind: preset === "hr" ? "hr" : "flow", period: "monthly" }} pending={pending} submitLabel="Ajouter au plan" usual={usual} people={people} categories={categories} onSubmit={(f) => run(() => createCashRule(f), () => { setOpen(false); toast.success(preset === "hr" ? "Ressource ajoutée" : preset === "in" ? "Recette ajoutée" : "Charge ajoutée"); })} />}
      </DialogContent>
    </Dialog>
  );
}

export function RuleRowActions({ rule, usual, people, categories }: { rule: CashRuleInput & { notes: string | null; kind?: string; personId?: string | null }; usual?: UsualMap; people?: { id: string; name: string }[]; categories?: CategoryLists }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(rule.active); // coche immédiate, confirmée par le rafraîchissement
  const [pending, run] = useRun();
  return (
    <span className="inline-flex items-center gap-1">
      <input type="checkbox" checked={active} disabled={pending} onChange={(e) => { setActive(e.target.checked); run(() => toggleCashRule(rule.id, e.target.checked)); }} title={rule.active ? "Dans le plan" : "Hors du plan"} aria-label={`${rule.label} dans le plan`} className="size-3.5 accent-primary" data-testid={`rule-active-${rule.id}`} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><button type="button" className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-primary" aria-label={`Modifier ${rule.label}`} data-testid={`rule-edit-${rule.id}`}><Pencil className="size-3.5" /></button></DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier {rule.kind === "hr" ? "la ressource" : rule.direction === "in" ? "la recette" : "la charge"}</DialogTitle></DialogHeader>
          {open && <RuleForm editing initial={{ label: rule.label, direction: rule.direction, category: rule.category, amount: rule.amount, period: rule.period, startMonth: rule.startMonth, endMonth: rule.endMonth ?? "", notes: rule.notes ?? "", kind: rule.kind ?? "flow", personId: rule.personId ?? null }} pending={pending} submitLabel="Enregistrer" usual={usual} people={people} categories={categories} onSubmit={(f, from) => run(() => updateCashRule(rule.id, f, from), () => { setOpen(false); toast.success(from ? `Nouveau montant à partir de ${from}` : "Ligne modifiée"); })} />}
        </DialogContent>
      </Dialog>
      <button type="button" disabled={pending} onClick={() => { if (confirm(`Supprimer « ${rule.label} » du plan ?`)) run(() => deleteCashRule(rule.id)); }} className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-danger" aria-label={`Supprimer ${rule.label}`} data-testid={`rule-delete-${rule.id}`}><Trash2 className="size-3.5" /></button>
    </span>
  );
}


// Un vrai tableau pour les charges et les recettes (retour de Gaël : deux colonnes, illisible) : filtre, regroupement,
// sous-totaux ; les lignes saisies se modifient, les lignes calculées renvoient à leur dossier.
export type FlowRow = { id: string; source: string; label: string; category: string; period: string | null; startMonth: string | null; endMonth: string | null; amount: number; monthly: number; notes: string | null; active: boolean; href?: string; month?: string; late?: boolean; rule?: CashRuleInput & { notes: string | null; kind?: string; personId?: string | null } };
const SOURCE_LABEL: Record<string, string> = { saisie: "Saisie", versement: "Versement attendu", cotisation: "Cotisation", facture: "Facture à payer", engagement: "Engagement à facturer" };

export function FlowsTable({ rows, rw, usual, people, categories, monthLabels, testId }: { rows: FlowRow[]; rw: boolean; usual?: UsualMap; people?: { id: string; name: string }[]; categories?: CategoryLists; monthLabels: Record<string, string>; testId: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [src, setSrc] = useState("");
  const [group, setGroup] = useState<"" | "category" | "source" | "month">("category");
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const cats = Array.from(new Set(rows.map((r) => r.category))).sort((a, b) => a.localeCompare(b, "fr"));
  const sources = Array.from(new Set(rows.map((r) => r.source)));
  const list = rows.filter((r) => (!q || norm(`${r.label} ${r.category} ${r.notes ?? ""}`).includes(norm(q))) && (!cat || r.category === cat) && (!src || r.source === src));
  const keyOf = (r: FlowRow) => group === "category" ? r.category : group === "source" ? (SOURCE_LABEL[r.source] ?? r.source) : group === "month" ? (r.month ? monthLabels[r.month] ?? r.month : r.startMonth ? `dès ${monthLabels[r.startMonth] ?? r.startMonth}` : "—") : "";
  const groups = group ? Array.from(list.reduce((m, r) => { const k = keyOf(r); m.set(k, [...(m.get(k) ?? []), r]); return m; }, new Map<string, FlowRow[]>())).sort((a, b) => a[0].localeCompare(b[0], "fr")) : [["", list] as [string, FlowRow[]]];
  const fmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const total = list.reduce((n, r) => n + (r.active ? r.monthly : 0), 0);
  return (
    <div data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" className="h-8 w-44 text-xs" aria-label="Filtrer" data-testid={`${testId}-filter`} />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="h-8 text-xs" aria-label="Catégorie" data-testid={`${testId}-category`}><option value="">Toutes les catégories</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        <Select value={src} onChange={(e) => setSrc(e.target.value)} className="h-8 text-xs" aria-label="Source" data-testid={`${testId}-source`}><option value="">Toutes les sources</option>{sources.map((c) => <option key={c} value={c}>{SOURCE_LABEL[c] ?? c}</option>)}</Select>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">Regrouper par
          <Select value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className="h-8 text-xs" aria-label="Regrouper par" data-testid={`${testId}-group`}><option value="category">catégorie</option><option value="source">source</option><option value="month">mois</option><option value="">rien</option></Select>
        </span>
      </div>
      <table className="w-full text-[13px]" data-testid={`${testId}-table`}>
        <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="min-w-[16rem] px-4 py-1.5">Ligne</th><th className="px-2 py-1.5">Catégorie</th><th className="px-2 py-1.5">Source</th><th className="px-2 py-1.5">Quand</th><th className="px-2 py-1.5 text-right">Montant</th><th className="px-2 py-1.5 text-right">Par mois</th><th className="px-2 py-1.5">Commentaire</th>{rw && <th className="px-2 py-1.5"></th>}</tr></thead>
        <tbody className="divide-y">
          {list.length === 0 && <tr><td colSpan={8} className="px-4 py-4 text-sm text-muted-foreground">Rien ne correspond.</td></tr>}
          {groups.map(([k, items]) => (
            <Fragment key={k || "all"}>
              {group && <tr className="bg-muted/30" data-testid={`${testId}-group-row`}><td colSpan={4} className="px-4 py-1 text-[11px] font-semibold">{k}</td><td className="px-2 py-1 text-right text-[11px] font-semibold tabular">{fmt(items.reduce((n, r) => n + r.amount, 0))}</td><td className="px-2 py-1 text-right text-[11px] font-semibold tabular">{fmt(items.reduce((n, r) => n + (r.active ? r.monthly : 0), 0))}</td><td colSpan={rw ? 2 : 1}></td></tr>}
              {items.map((r) => (
                <tr key={r.id} className={cn("align-top", !r.active && "opacity-50")} data-testid={`flow-${r.id}`} data-label={r.label}>
                  <td className="px-4 py-1.5">{r.href ? <Link href={r.href} className="font-medium text-primary hover:underline">{r.label}</Link> : <b className="font-medium">{r.label}</b>}{r.late && <span className="ml-1 text-[10px] text-danger">en retard</span>}</td>
                  <td className="px-2 py-1.5 text-xs">{r.category}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{SOURCE_LABEL[r.source] ?? r.source}</td>
                  <td className="px-2 py-1.5 text-xs whitespace-nowrap">{r.month ? monthLabels[r.month] ?? r.month : <>{PERIODS.find((p) => p.value === r.period)?.label.toLowerCase()}{r.startMonth ? ` · dès ${monthLabels[r.startMonth] ?? r.startMonth}` : ""}{r.endMonth ? ` → ${monthLabels[r.endMonth] ?? r.endMonth}` : ""}</>}</td>
                  <td className="px-2 py-1.5 text-right tabular">{fmt(r.amount)}</td>
                  <td className="px-2 py-1.5 text-right tabular text-muted-foreground">{r.monthly ? fmt(r.monthly) : "—"}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground" data-testid={`flow-notes-${r.id}`}>{r.notes ?? ""}</td>
                  {rw && <td className="px-2 py-1.5 text-right whitespace-nowrap">{r.rule && <RuleRowActions rule={r.rule} usual={usual} people={people} categories={categories} />}</td>}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 font-semibold"><td className="px-4 py-1.5" colSpan={4}>Total {list.length} ligne{list.length > 1 ? "s" : ""}</td><td className="px-2 py-1.5 text-right tabular">{fmt(list.reduce((n, r) => n + r.amount, 0))}</td><td className="px-2 py-1.5 text-right tabular">{fmt(total)}</td><td colSpan={rw ? 2 : 1}></td></tr></tfoot>
      </table>
    </div>
  );
}
