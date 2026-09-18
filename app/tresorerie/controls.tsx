"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/common/searchable-select";
import { createCashRule, deleteCashRule, setTreasuryOpening, toggleCashRule, updateCashRule, type CashRuleForm } from "@/app/actions/treasury";
import { CASH_CATEGORIES, DIRECTIONS, PERIODS, type CashRuleInput } from "@/lib/treasury";
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

const EMPTY: CashRuleForm = { label: "", direction: "out", category: "", amount: "", period: "monthly", startMonth: "", endMonth: "", notes: "" };

// Une règle de flux : récurrente (mois, trimestre, semestre, année) ou ponctuelle.
function RuleForm({ initial, onSubmit, pending, submitLabel, editing }: { initial: CashRuleForm; onSubmit: (f: CashRuleForm, from: string | null) => void; pending: boolean; submitLabel: string; editing?: boolean }) {
  const [f, setF] = useState<CashRuleForm>(initial);
  const [fromMode, setFromMode] = useState(false);
  const [from, setFrom] = useState("");
  const cats = f.direction === "in" ? CASH_CATEGORIES.in : CASH_CATEGORIES.out;
  return (
    <form className="grid gap-3 text-xs" onSubmit={(e) => { e.preventDefault(); onSubmit(f, fromMode && from ? from : null); }}>
      {!editing && <p className="text-muted-foreground">Un leasing dès février, une embauche dès mars, une subvention en juin : le montant, la fréquence, le premier mois — et le dernier si ça s&apos;arrête.</p>}
      <div className="flex gap-1 rounded-md bg-muted p-0.5">{DIRECTIONS.map((d) => <button key={d.value} type="button" onClick={() => setF({ ...f, direction: d.value, category: "" })} className={cn("flex-1 rounded px-2 py-1", f.direction === d.value && "bg-card font-semibold shadow-sm")} data-testid={`rule-direction-${d.value}`}>{d.label}</button>)}</div>
      <label className="grid gap-1"><span className="font-semibold">Libellé</span><Input autoFocus value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Salaires et charges, Loyer, Subvention de fonctionnement Région…" className="h-8" data-testid="rule-label" /></label>
      <div className="grid grid-cols-[1fr_8rem] gap-1.5">
        <label className="grid gap-1"><span className="font-semibold">Catégorie</span><Input list="cash-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder={cats[0]} className="h-8" data-testid="rule-category" /><datalist id="cash-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="grid gap-1"><span className="font-semibold">Montant (€)</span><Input inputMode="decimal" value={String(f.amount)} onChange={(e) => setF({ ...f, amount: e.target.value })} className="h-8 text-right" data-testid="rule-amount" /></label>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <label className="grid gap-1"><span className="font-semibold">Périodicité</span><Select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} className="h-8 text-xs" aria-label="Périodicité" data-testid="rule-period">{PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select></label>
        <label className="grid gap-1"><span className="font-semibold">{f.period === "once" ? "Mois" : "Premier mois"}</span><Input type="month" value={f.startMonth} onChange={(e) => setF({ ...f, startMonth: e.target.value })} className="h-8" data-testid="rule-start" /></label>
        {f.period !== "once" && <label className="grid gap-1"><span className="font-semibold">Dernier mois <span className="font-normal text-muted-foreground">(facultatif)</span></span><Input type="month" value={f.endMonth ?? ""} onChange={(e) => setF({ ...f, endMonth: e.target.value })} className="h-8" data-testid="rule-end" /></label>}
      </div>
      <label className="grid gap-1"><span className="font-semibold">Note</span><Input value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="facultatif : d'où vient le montant" className="h-8" /></label>
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

export function NewRuleDialog({ defaultMonth }: { defaultMonth: string }) {
  const [open, setOpen] = useState(false);
  const [pending, run] = useRun();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" data-testid="new-rule"><Plus />Nouvelle charge ou recette</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Une charge ou une recette à venir</DialogTitle></DialogHeader>
        {open && <RuleForm initial={{ ...EMPTY, startMonth: defaultMonth }} pending={pending} submitLabel="Ajouter au plan" onSubmit={(f) => run(() => createCashRule(f), () => { setOpen(false); toast.success("Règle ajoutée"); })} />}
      </DialogContent>
    </Dialog>
  );
}

export function RuleRowActions({ rule }: { rule: CashRuleInput & { notes: string | null } }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(rule.active); // coche immédiate, confirmée par le rafraîchissement
  const [pending, run] = useRun();
  return (
    <span className="inline-flex items-center gap-1">
      <input type="checkbox" checked={active} disabled={pending} onChange={(e) => { setActive(e.target.checked); run(() => toggleCashRule(rule.id, e.target.checked)); }} title={rule.active ? "Dans le plan" : "Hors du plan"} aria-label={`${rule.label} dans le plan`} className="size-3.5 accent-primary" data-testid={`rule-active-${rule.id}`} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><button type="button" className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-primary" aria-label={`Modifier ${rule.label}`} data-testid={`rule-edit-${rule.id}`}><Pencil className="size-3.5" /></button></DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier la règle</DialogTitle></DialogHeader>
          {open && <RuleForm editing initial={{ label: rule.label, direction: rule.direction, category: rule.category, amount: rule.amount, period: rule.period, startMonth: rule.startMonth, endMonth: rule.endMonth ?? "", notes: rule.notes ?? "" }} pending={pending} submitLabel="Enregistrer" onSubmit={(f, from) => run(() => updateCashRule(rule.id, f, from), () => { setOpen(false); toast.success(from ? `Nouveau montant à partir de ${from}` : "Règle modifiée"); })} />}
        </DialogContent>
      </Dialog>
      <button type="button" disabled={pending} onClick={() => { if (confirm(`Supprimer la règle « ${rule.label} » ?`)) run(() => deleteCashRule(rule.id)); }} className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-danger" aria-label={`Supprimer ${rule.label}`} data-testid={`rule-delete-${rule.id}`}><Trash2 className="size-3.5" /></button>
    </span>
  );
}
