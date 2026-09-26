"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveLevels } from "@/app/actions/fiche-validation";

type LevelRow = { id?: string; label: string; permission: string; active: boolean; decisions: number; key: string };
export type FicheLevelView = { id: string; label: string; permission: string; active: boolean; decisions: number };

// Circuit de validation des fiches (spec vocabulaire § 3) : la liste ordonnée des niveaux, leur libellé, le droit exigé (qui
// le tient se règle dans Rôles et droits), actif ou non. Un niveau qui a des décisions ne se supprime pas : il se désactive.
export function FicheLevelsForm({ levels, permissions, readOnly }: { levels: FicheLevelView[]; permissions: { key: string; label: string; holders: string }[]; readOnly: boolean }) {
  const initial = levels.map((l) => ({ ...l, key: l.id }));
  const [rows, setRows] = useState<LevelRow[]>(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const shape = (rs: LevelRow[]) => JSON.stringify(rs.map((r) => [r.id, r.label, r.permission, r.active]));
  const dirty = shape(rows) !== shape(initial);
  const set = (i: number, patch: Partial<LevelRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => setRows((rs) => { const out = [...rs]; [out[i], out[i + d]] = [out[i + d], out[i]]; return out; });
  const save = () => start(async () => {
    const r = await saveLevels(rows.map((x) => ({ id: x.id, label: x.label, permission: x.permission, active: x.active })));
    if (!r.ok) { toast.error(r.error); return; }
    toast.success("Circuit de validation enregistré");
    router.refresh();
  });

  return (
    <div className="grid gap-2" data-testid="fiche-levels-admin">
      <ol className="divide-y">
        {rows.map((r, i) => (
          <li key={r.key} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-1.5 py-1.5 sm:grid-cols-[1.5rem_1fr_13rem_auto_auto]" data-testid={`fiche-level-row-${i + 1}`}>
            <span className="text-xs font-semibold tabular text-muted-foreground">{i + 1}.</span>
            <Input value={r.label} onChange={(e) => set(i, { label: e.target.value })} readOnly={readOnly} className="h-8 text-sm" aria-label={`Libellé du niveau ${i + 1}`} data-testid={`fiche-level-label-${i + 1}`} />
            <select value={r.permission} disabled={readOnly} onChange={(e) => set(i, { permission: e.target.value })} className="h-8 rounded-md border bg-background px-1.5 text-xs" aria-label={`Droit exigé au niveau ${i + 1}`} data-testid={`fiche-level-permission-${i + 1}`}>
              {permissions.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={r.active} disabled={readOnly} onChange={(e) => set(i, { active: e.target.checked })} data-testid={`fiche-level-active-${i + 1}`} />actif</label>
            {!readOnly && (
              <span className="flex items-center gap-0.5">
                <Button type="button" size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter"><ArrowUp /></Button>
                <Button type="button" size="icon-sm" variant="ghost" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Descendre"><ArrowDown /></Button>
                {/* Un niveau qui a des décisions ne se supprime pas (ses décisions restent lisibles) : on le désactive. */}
                <Button type="button" size="icon-sm" variant="ghost" disabled={r.decisions > 0} title={r.decisions > 0 ? `${r.decisions} décision${r.decisions > 1 ? "s" : ""} : décochez « actif » plutôt` : "Retirer ce niveau"} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Retirer"><Trash2 /></Button>
              </span>
            )}
          </li>
        ))}
      </ol>
      <ul className="grid gap-0.5 text-[11px] text-muted-foreground">
        {permissions.map((p) => <li key={p.key}><b className="font-medium text-foreground">{p.label}</b> · {p.holders || "aucun rôle ne le tient"}</li>)}
      </ul>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={rows.length >= 10} onClick={() => setRows((rs) => [...rs, { label: "", permission: permissions[Math.min(rs.length, permissions.length - 1)]?.key ?? "", active: true, decisions: 0, key: `new-${Date.now()}` }])} data-testid="fiche-level-add"><Plus />Ajouter un niveau</Button>
          <Button type="button" size="sm" disabled={pending || !dirty || rows.some((r) => !r.label.trim())} onClick={save} data-testid="fiche-levels-save">Enregistrer le circuit</Button>
        </div>
      )}
    </div>
  );
}
