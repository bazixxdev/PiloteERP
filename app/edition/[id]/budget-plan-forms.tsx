"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addBudgetLine, clearActualOverride, deleteBudgetLine, setActualOverride, setExpenseCategory, submitBudgetPlan, updateBudgetLine, validateBudgetPlan } from "@/app/actions/budget-plan";

type R = { ok: true } | { ok: false; error: string };
type Opt = { id: string; label: string };

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error); return; }
      after?.();
      router.refresh();
    });
  return { pending, run };
}

const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

export function BudgetLineForm({ editionId, categories }: { editionId: string; categories: Opt[] }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const { pending, run } = useRun();
  const ok = categoryId && amount.trim() !== "" && Number.isFinite(num(amount));
  return (
    <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (!ok) return; run(() => addBudgetLine(editionId, { categoryId, label, amount: num(amount) }), () => { setLabel(""); setAmount(""); }); }}>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-7 rounded-md border bg-background px-2 text-xs" data-testid="budget-line-category" aria-label="Catégorie">
        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Détail (facultatif)" className="h-7 w-48 text-xs" data-testid="budget-line-label" />
      <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant €" className="h-7 w-28 text-xs" data-testid="budget-line-amount" />
      <Button type="submit" size="xs" variant="outline" disabled={pending || !ok} data-testid="budget-line-submit"><Plus />Ajouter au prévu</Button>
    </form>
  );
}

export function BudgetLineRow({ line, categories, canEdit }: { line: { id: string; categoryId: string; label: string | null; amount: number }; categories: Opt[]; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(line.amount));
  const [categoryId, setCategoryId] = useState(line.categoryId);
  const { pending, run } = useRun();
  const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(line.amount);
  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="tabular">{eur}</span>
        {canEdit && <>
          <Button type="button" size="icon-xs" variant="ghost" onClick={() => setEditing(true)} aria-label="Modifier la ligne" data-testid={`budget-line-edit-${line.id}`}><Pencil /></Button>
          <Button type="button" size="icon-xs" variant="ghost" disabled={pending} onClick={() => { if (confirm("Retirer cette ligne du prévu ?")) run(() => deleteBudgetLine(line.id)); }} aria-label="Retirer la ligne" data-testid={`budget-line-delete-${line.id}`}><Trash2 /></Button>
        </>}
      </span>
    );
  }
  return (
    <form className="inline-flex flex-wrap items-center gap-1" onSubmit={(e) => { e.preventDefault(); run(() => updateBudgetLine(line.id, { categoryId, amount: num(amount) }), () => setEditing(false)); }}>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-7 rounded-md border bg-background px-1.5 text-xs" aria-label="Catégorie">
        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <Input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-7 w-28 text-xs" data-testid={`budget-line-amount-${line.id}`} />
      <Button type="submit" size="icon-xs" variant="outline" disabled={pending} aria-label="Enregistrer" data-testid={`budget-line-save-${line.id}`}><Check /></Button>
      <Button type="button" size="icon-xs" variant="ghost" onClick={() => setEditing(false)} aria-label="Annuler"><X /></Button>
    </form>
  );
}

export function BudgetStatusButtons({ editionId, status, canPlan, canValidate }: { editionId: string; status: string; canPlan: boolean; canValidate: boolean }) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap gap-1.5">
      {canPlan && status === "draft" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => submitBudgetPlan(editionId))} data-testid="budget-plan-submit"><Send />Soumettre pour validation</Button>}
      {canValidate && status !== "validated" && <Button size="sm" disabled={pending} onClick={() => run(() => validateBudgetPlan(editionId))} data-testid="budget-plan-validate"><Check />Valider le budget</Button>}
    </div>
  );
}

export function OverrideForm({ editionId, categoryId, current }: { editionId: string; categoryId: string; current: { amount: number; reason: string } | null }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(current ? String(current.amount) : "");
  const [reason, setReason] = useState(current?.reason ?? "");
  const { pending, run } = useRun();
  if (!open) {
    return (
      <span className="inline-flex gap-1">
        <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(true)} data-testid={`budget-override-open-${categoryId}`}>{current ? "Modifier la saisie" : "Saisir à la main"}</Button>
        {current && <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => run(() => clearActualOverride(editionId, categoryId))} data-testid={`budget-override-clear-${categoryId}`}>Revenir au calcul</Button>}
      </span>
    );
  }
  const ok = amount.trim() !== "" && Number.isFinite(num(amount)) && reason.trim() !== "";
  return (
    <form className="mt-1 flex flex-wrap items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (!ok) return; run(() => setActualOverride(editionId, categoryId, num(amount), reason), () => setOpen(false)); }}>
      <Input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Réalisé €" className="h-7 w-28 text-xs" data-testid={`budget-override-amount-${categoryId}`} />
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (obligatoire)" className="h-7 w-56 text-xs" data-testid={`budget-override-reason-${categoryId}`} />
      <Button type="submit" size="xs" variant="outline" disabled={pending || !ok} data-testid={`budget-override-save-${categoryId}`}><Check />Enregistrer</Button>
      <Button type="button" size="icon-xs" variant="ghost" onClick={() => setOpen(false)} aria-label="Annuler"><X /></Button>
    </form>
  );
}

// Catégorie du budget prévisionnel d'une dépense : l'engagement restant tombe dans la bonne ligne du tableau.
export function ExpenseCategorySelect({ expenseId, value, categories, readOnly }: { expenseId: string; value: string | null; categories: Opt[]; readOnly: boolean }) {
  const { pending, run } = useRun();
  if (readOnly) return <div className="px-2 py-1">{categories.find((c) => c.id === value)?.label ?? "—"}</div>;
  return (
    <select value={value ?? ""} disabled={pending} onChange={(e) => run(() => setExpenseCategory(expenseId, e.target.value || null))} className="h-8 w-full rounded-md border bg-background px-2 text-sm" data-testid={`expense-category-${expenseId}`} aria-label="Catégorie du budget prévisionnel">
      <option value="">—</option>
      {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select>
  );
}
