"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { recordDecision } from "@/app/actions/edition";
import { SearchableSelect } from "@/components/common/searchable-select";

type Opt = { value: string; label: string };

// « Consigner » : la décision de l'instance est datée sur l'édition, avec une suite (qui, pour quand) facultative.
export function DecisionForm({ editionId, label, people, instances, defaultInstance = "codir", alerts = [], size = "xs" }: { editionId: string; label?: string; people: { id: string; name: string }[]; instances: Opt[]; defaultInstance?: string; alerts?: Opt[]; size?: "xs" | "sm" }) {
  const [open, setOpen] = useState(false);
  const [alertKind, setAlertKind] = useState("");
  const [instance, setInstance] = useState(defaultInstance);
  const [body, setBody] = useState(label ? `${label} : ` : "");
  const [followUp, setFollowUp] = useState("");
  const [due, setDue] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const sel = "h-8 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} variant="outline" data-testid="decision-open"><Gavel />Consigner une décision</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="grid gap-2">
          <div className="text-sm font-semibold">Consigner une décision</div>
          <select className={sel} value={instance} onChange={(e) => setInstance(e.target.value)} aria-label="Instance">{instances.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}</select>
          <textarea className="min-h-20 rounded-lg border bg-card p-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Décision prise, motif si utile…" data-testid="decision-body" />
          {alerts.length > 0 && (
            <select className={sel} value={alertKind} onChange={(e) => setAlertKind(e.target.value)} aria-label="Alerte réglée par cette décision" data-testid="decision-alert">
              <option value="">Ne règle aucune alerte</option>
              {alerts.map((a) => <option key={a.value} value={a.value}>Règle : {a.label}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <SearchableSelect options={people.map((p) => ({ value: p.id, label: p.name }))} value={followUp} onChange={setFollowUp} emptyOption="Suite : personne" aria-label="Suite confiée à" className="w-full" />
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8" aria-label="Pour le" />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={pending || !body.trim()} data-testid="decision-submit" onClick={() => start(async () => { const r = await recordDecision({ editionId, instance, body, followUpId: followUp || null, dueDate: due || null, alertKind: alertKind || null }); if (!r.ok) { toast.error(r.error); return; } toast.success("Décision consignée sur l'édition"); setOpen(false); setBody(label ? `${label} : ` : ""); router.refresh(); })}>Consigner</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
