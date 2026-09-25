"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBudgetCategory } from "@/app/actions/budget-plan";

type Cat = { id?: string; label: string; accountPrefixes: string; source: string; order: number; active: boolean };
const SOURCES = [{ value: "time", label: "Temps valorisé" }, { value: "ledger", label: "Grand livre" }, { value: "none", label: "Saisie manuelle" }];

// Grille commune du budget prévisionnel (25/09) : libellé, préfixes de comptes, source du réalisé, ordre, actif.
// Une catégorie utilisée ne se supprime pas : elle se désactive.
function CategoryRow({ cat, readOnly }: { cat: Cat; readOnly: boolean }) {
  const [c, setC] = useState(cat);
  const [pending, start] = useTransition();
  const router = useRouter();
  const dirty = JSON.stringify(c) !== JSON.stringify(cat);
  const save = () => start(async () => {
    const r = await saveBudgetCategory({ ...c, order: Number(c.order) || 0 });
    if (!r.ok) { toast.error(r.error); return; }
    if (!cat.id) setC({ label: "", accountPrefixes: "", source: "ledger", order: cat.order, active: true });
    router.refresh();
  });
  return (
    <form className="grid grid-cols-[1fr_1fr_auto] items-center gap-1.5 py-1.5 sm:grid-cols-[1.2fr_1.2fr_9rem_3.5rem_auto_auto]" onSubmit={(e) => { e.preventDefault(); save(); }} data-testid={cat.id ? `budget-category-${cat.id}` : "budget-category-new"}>
      <Input value={c.label} onChange={(e) => setC({ ...c, label: e.target.value })} placeholder={cat.id ? "" : "Nouvelle catégorie"} readOnly={readOnly} className="h-8 text-sm" aria-label="Libellé" />
      <Input value={c.accountPrefixes} onChange={(e) => setC({ ...c, accountPrefixes: e.target.value })} placeholder="Préfixes de comptes : 604,611" readOnly={readOnly} className="h-8 text-xs tabular" aria-label="Préfixes de comptes" />
      <select value={c.source} disabled={readOnly} onChange={(e) => setC({ ...c, source: e.target.value })} className="h-8 rounded-md border bg-background px-1.5 text-xs" aria-label="Source du réalisé">
        {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <Input inputMode="numeric" value={String(c.order)} onChange={(e) => setC({ ...c, order: Number(e.target.value) || 0 })} readOnly={readOnly} className="h-8 text-xs tabular" aria-label="Ordre" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={c.active} disabled={readOnly} onChange={(e) => setC({ ...c, active: e.target.checked })} />active</label>
      {!readOnly && <Button type="submit" size="icon-sm" variant="outline" disabled={pending || !dirty || !c.label.trim()} aria-label={cat.id ? "Enregistrer" : "Ajouter"}>{cat.id ? <Check /> : <Plus />}</Button>}
    </form>
  );
}

export function BudgetCategoriesForm({ categories, readOnly }: { categories: Cat[]; readOnly: boolean }) {
  return (
    <div className="divide-y">
      {categories.map((c) => <CategoryRow key={c.id} cat={c} readOnly={readOnly} />)}
      {!readOnly && <CategoryRow cat={{ label: "", accountPrefixes: "", source: "ledger", order: (categories.at(-1)?.order ?? 0) + 1, active: true }} readOnly={false} />}
    </div>
  );
}
