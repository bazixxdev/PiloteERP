"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect, Select } from "@/components/common/searchable-select";
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

const EMPTY: CashRuleForm = { label: "", direction: "out", category: "", amount: "", period: "monthly", startMonth: "", endMonth: "", notes: "", kind: "flow", personId: null };

// Une règle de flux : récurrente (mois, trimestre, semestre, année) ou ponctuelle.
export type UsualMap = Record<string, number>; // « direction|catégorie » → montant mensuel habituel (réel des 3 derniers mois)

function RuleForm({ initial, onSubmit, pending, submitLabel, editing, usual = {}, people = [] }: { initial: CashRuleForm; onSubmit: (f: CashRuleForm, from: string | null) => void; pending: boolean; submitLabel: string; editing?: boolean; usual?: UsualMap; people?: { id: string; name: string }[] }) {
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
      {!hr && <div className="flex gap-1 rounded-md bg-muted p-0.5">{DIRECTIONS.map((d) => <button key={d.value} type="button" onClick={() => setF({ ...f, direction: d.value, category: "" })} className={cn("flex-1 rounded px-2 py-1", f.direction === d.value && "bg-card font-semibold shadow-sm")} data-testid={`rule-direction-${d.value}`}>{d.label}</button>)}</div>}
      {hr && people.length > 0 && <div className="grid gap-1"><span className="font-semibold">Personne de l&apos;équipe <span className="font-normal text-muted-foreground">(facultatif : un poste à pourvoir n&apos;en a pas)</span></span><SearchableSelect options={people.map((p) => ({ value: p.id, label: p.name }))} value={f.personId ?? ""} onChange={(v) => setF({ ...f, personId: v || null, label: f.label || people.find((p) => p.id === v)?.name || "" })} emptyOption="— un poste, sans personne —" aria-label="Personne" className="h-8 w-full text-xs" data-testid="rule-person" /></div>}
      <label className="grid gap-1"><span className="font-semibold">{hr ? "Nom ou poste" : "Libellé"}</span><Input autoFocus value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={hr ? "Chargé·e de mission transition (CDI), Alternance communication…" : "Leasing véhicule, Subvention de fonctionnement Région, Formations facturées…"} className="h-8" data-testid="rule-label" /></label>
      <div className={cn("grid gap-1.5", hr ? "grid-cols-1" : "grid-cols-[1fr_8rem]")}>
        {!hr && <label className="grid gap-1"><span className="font-semibold">Catégorie</span><Input list="cash-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder={cats[0]} className="h-8" data-testid="rule-category" /><datalist id="cash-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></label>}
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

export function NewRuleDialog({ defaultMonth, preset = "out", usual, people, testId = "new-rule" }: { defaultMonth: string; preset?: "in" | "out" | "hr"; usual?: UsualMap; people?: { id: string; name: string }[]; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, run] = useRun();
  const title = preset === "in" ? "Une recette attendue" : preset === "hr" ? "Une ressource humaine" : "Une charge à venir";
  const label = preset === "in" ? "Nouvelle recette" : preset === "hr" ? "Nouvelle ressource" : "Nouvelle charge";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" data-testid={testId}><Plus />{label}</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {open && <RuleForm initial={{ ...EMPTY, startMonth: defaultMonth, direction: preset === "in" ? "in" : "out", kind: preset === "hr" ? "hr" : "flow", period: "monthly" }} pending={pending} submitLabel="Ajouter au plan" usual={usual} people={people} onSubmit={(f) => run(() => createCashRule(f), () => { setOpen(false); toast.success(preset === "hr" ? "Ressource ajoutée" : preset === "in" ? "Recette ajoutée" : "Charge ajoutée"); })} />}
      </DialogContent>
    </Dialog>
  );
}

export function RuleRowActions({ rule, usual, people }: { rule: CashRuleInput & { notes: string | null; kind?: string; personId?: string | null }; usual?: UsualMap; people?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(rule.active); // coche immédiate, confirmée par le rafraîchissement
  const [pending, run] = useRun();
  return (
    <span className="inline-flex items-center gap-1">
      <input type="checkbox" checked={active} disabled={pending} onChange={(e) => { setActive(e.target.checked); run(() => toggleCashRule(rule.id, e.target.checked)); }} title={rule.active ? "Dans le plan" : "Hors du plan"} aria-label={`${rule.label} dans le plan`} className="size-3.5 accent-primary" data-testid={`rule-active-${rule.id}`} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><button type="button" className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-primary" aria-label={`Modifier ${rule.label}`} data-testid={`rule-edit-${rule.id}`}><Pencil className="size-3.5" /></button></DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier la ligne</DialogTitle></DialogHeader>
          {open && <RuleForm editing initial={{ label: rule.label, direction: rule.direction, category: rule.category, amount: rule.amount, period: rule.period, startMonth: rule.startMonth, endMonth: rule.endMonth ?? "", notes: rule.notes ?? "", kind: rule.kind ?? "flow", personId: rule.personId ?? null }} pending={pending} submitLabel="Enregistrer" usual={usual} people={people} onSubmit={(f, from) => run(() => updateCashRule(rule.id, f, from), () => { setOpen(false); toast.success(from ? `Nouveau montant à partir de ${from}` : "Ligne modifiée"); })} />}
        </DialogContent>
      </Dialog>
      <button type="button" disabled={pending} onClick={() => { if (confirm(`Supprimer « ${rule.label} » du plan ?`)) run(() => deleteCashRule(rule.id)); }} className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-danger" aria-label={`Supprimer ${rule.label}`} data-testid={`rule-delete-${rule.id}`}><Trash2 className="size-3.5" /></button>
    </span>
  );
}
