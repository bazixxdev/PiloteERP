"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/common/reveal";
import { addAchievement, deleteAchievement } from "@/app/actions/proposals";
import { dayjs } from "@/lib/format";
import { ACHIEVEMENT_KINDS, kindLabel } from "@/lib/achievements";
import { Select } from "@/components/common/searchable-select";
import { V, cap } from "@/lib/vocab";

export type AchievementView = { id: string; kind: string; label: string; value: number | null; unit: string | null; date: string; author: string; authorId: string; action: string | null };

// Réalisations consignées au fil de l'année (retour du 14/09) : « on a eu tant d'inscrits », « on a produit tel livrable ».
export function Achievements({ editionId, items, actions, canWrite, meId, canDeleteAll }: { editionId: string; items: AchievementView[]; actions: { id: string; name: string }[]; canWrite: boolean; meId: string; canDeleteAll: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [kind, setKind] = useState("participants");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [actionId, setActionId] = useState("");
  const k = ACHIEVEMENT_KINDS.find((x) => x.value === kind)!;
  const totals = ACHIEVEMENT_KINDS.map((x) => ({ ...x, total: items.filter((i) => i.kind === x.value && i.value != null).reduce((s, i) => s + (i.value ?? 0), 0), count: items.filter((i) => i.kind === x.value).length })).filter((x) => x.count > 0);
  return (
    <div data-testid="achievements">
      {totals.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2 text-[11px]" data-testid="achievement-totals">
          {totals.map((t) => <li key={t.value} className="rounded-md bg-mint-soft px-2 py-1 text-mint"><b className="tabular">{t.total ? new Intl.NumberFormat("fr-FR").format(t.total) : t.count}</b> {t.total ? t.unit || t.label.toLowerCase() : t.label.toLowerCase()}{!t.total && t.count > 1 ? ` (${t.count})` : ""}</li>)}
        </ul>
      )}
      <ul className="divide-y text-sm">
        {items.length === 0 && <li className="py-2 text-muted-foreground">Rien de consigné pour l'instant. Notez au fil de l'eau : inscrits, publics, livrables — ce sera le bilan.</li>}
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-2 py-1.5" data-testid={`achievement-${a.id}`}>
            <span className="w-16 shrink-0 text-[11px] tabular text-muted-foreground">{dayjs(a.date).format("D MMM")}</span>
            <div className="min-w-0 flex-1">
              <div><b className="tabular">{a.value != null ? `${new Intl.NumberFormat("fr-FR").format(a.value)}${a.unit ? ` ${a.unit}` : ""} · ` : ""}</b>{a.label}</div>
              <div className="text-[10px] text-muted-foreground">{kindLabel(a.kind)}{a.action ? ` · ${a.action}` : ""} · {a.author}</div>
            </div>
            {(canDeleteAll || a.authorId === meId) && <button type="button" aria-label="Retirer" disabled={pending} onClick={() => start(async () => { const r = await deleteAchievement(a.id); if (!r.ok) toast.error(r.error); else router.refresh(); })} className="rounded p-1 text-muted-foreground/60 hover:text-danger"><Trash2 className="size-3.5" /></button>}
          </li>
        ))}
      </ul>
      {canWrite && (
        <Reveal label="Consigner une réalisation" size="xs" testId="achievement-open" className="mt-3">
        <form className="grid flex-1 gap-2 rounded-md border bg-muted/30 p-2.5 text-xs sm:grid-cols-[150px_1fr]" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addAchievement(editionId, { kind, label, value: value ? Number(value.replace(",", ".")) : null, unit: k.unit || null, date, actionId: actionId || null }); if (!r.ok) toast.error(r.error); else { toast.success("Réalisation consignée"); setLabel(""); setValue(""); router.refresh(); } }); }} data-testid="achievement-form">
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 rounded-md border bg-card px-2" aria-label="Nature" data-testid="achievement-kind">{ACHIEVEMENT_KINDS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</Select>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. : inscrits au forum de Tours" required className="h-8" data-testid="achievement-label" aria-label="Réalisation" />
          <div className="flex items-center gap-1"><Input type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Chiffre" className="h-8 w-24 tabular" data-testid="achievement-value" aria-label="Chiffre" />{k.unit && <span className="text-muted-foreground">{k.unit}</span>}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36" aria-label="Date" />
            <Select value={actionId} onChange={(e) => setActionId(e.target.value)} className="h-8 max-w-[220px] rounded-md border bg-card px-2" aria-label={`${cap(V.action)} liée`}><option value="">{`— ${V.action.one} liée (facultatif) —`}</option>{actions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
            <Button type="submit" size="sm" disabled={pending || !label.trim()} data-testid="achievement-submit"><Plus />Consigner</Button>
          </div>
        </form>
        </Reveal>
      )}
    </div>
  );
}
