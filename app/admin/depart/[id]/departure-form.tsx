"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/common/searchable-select";
import { prepareDeparture } from "@/app/actions/people";
import { cn } from "@/lib/utils";

type Other = { value: string; label: string; hint: string; poleId: string | null; role: string };
type Blocks = { piloted: string[]; guaranteed: string[]; ledPoles: string[]; sponsored: string[]; actions: string[]; requests: string[]; teams: string[]; tasks: number };

// Un bloc = ce que la personne porte d'une nature donnée, et le repreneur choisi (le même pôle est proposé en premier).
function Block({ title, items, value, onChange, others, testId, hint }: { title: string; items: string[]; value: string | null; onChange: (v: string | null) => void; others: Other[]; testId: string; hint?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-2 rounded-md border bg-card px-3 py-2.5" data-testid={`departure-${testId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><b className="text-sm">{title}</b> <span className="text-xs text-muted-foreground">· {items.length}</span>{hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}</div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Reprend
          <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="h-8 min-w-[14rem] text-xs" aria-label={`Repreneur — ${title}`} data-testid={`departure-${testId}-to`} placeholder="— personne (rien ne bouge) —">
            <option value="">— personne (rien ne bouge) —</option>
            {others.map((o) => <option key={o.value} value={o.value}>{o.label} · {o.hint}</option>)}
          </Select>
        </label>
      </div>
      <ul className="grid gap-0.5 text-xs text-muted-foreground">{items.slice(0, 8).map((x, i) => <li key={i}>· {x}</li>)}{items.length > 8 && <li>… et {items.length - 8} de plus</li>}</ul>
    </div>
  );
}

export function DepartureForm({ person, others, blocks }: { person: { id: string; name: string; firstName: string; poleId: string | null; active: boolean; leftAt: string | null }; others: Other[]; blocks: Blocks }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Les collègues du même pôle d'abord : c'est presque toujours là que ça se reprend.
  const sorted = [...others].sort((a, b) => Number(b.poleId === person.poleId) - Number(a.poleId === person.poleId) || a.label.localeCompare(b.label, "fr"));
  const [pilotTo, setPilotTo] = useState<string | null>(null);
  const [guarantorTo, setGuarantorTo] = useState<string | null>(null);
  const [poleLeadTo, setPoleLeadTo] = useState<string | null>(null);
  const [sponsorTo, setSponsorTo] = useState<string | null>(null);
  const [actionsTo, setActionsTo] = useState<string | null>(null);
  const [requestsTo, setRequestsTo] = useState<string | null>(null);
  const [leaveTeams, setLeaveTeams] = useState(blocks.teams.length > 0);
  const [leftAt, setLeftAt] = useState(person.leftAt ?? new Date().toLocaleDateString("sv")); // date locale (pas UTC)
  const [deactivate, setDeactivate] = useState(true);
  const nothing = !blocks.piloted.length && !blocks.guaranteed.length && !blocks.ledPoles.length && !blocks.sponsored.length && !blocks.actions.length && !blocks.requests.length;
  const submit = () => start(async () => {
    const r = await prepareDeparture({ personId: person.id, leftAt: leftAt || null, pilotTo, guarantorTo, poleLeadTo, sponsorTo, actionsTo, requestsTo, leaveTeams, deactivate });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`${r.data?.moved ?? 0} élément${(r.data?.moved ?? 0) > 1 ? "s" : ""} réattribué${(r.data?.moved ?? 0) > 1 ? "s" : ""}${deactivate ? " · accès coupé" : ""}`);
    router.push(`/admin?section=personnes&personne=${person.id}`);
    router.refresh();
  });
  return (
    <div className="grid gap-3" data-testid="departure-form">
      {nothing && <p className="text-sm text-muted-foreground">{person.firstName} ne porte rien d&apos;ouvert : il ne reste qu&apos;à dater et désactiver.</p>}
      <Block title="Projets pilotés" items={blocks.piloted} value={pilotTo} onChange={setPilotTo} others={sorted} testId="piloted" hint="Le repreneur devient pilote de toutes les éditions, passées comprises (une édition close garde son historique)." />
      <Block title="Garant de projet" items={blocks.guaranteed} value={guarantorTo} onChange={setGuarantorTo} others={sorted.filter((o) => o.role === "pole_lead" || o.role === "director")} testId="guaranteed" />
      <Block title="Responsable de pôle" items={blocks.ledPoles} value={poleLeadTo} onChange={setPoleLeadTo} others={sorted} testId="poles" />
      <Block title="Sponsor d'éditions" items={blocks.sponsored} value={sponsorTo} onChange={setSponsorTo} others={sorted} testId="sponsored" />
      <Block title="Actions à faire" items={blocks.actions} value={actionsTo} onChange={setActionsTo} others={sorted} testId="actions" />
      <Block title="Demandes ouvertes qui lui sont confiées" items={blocks.requests} value={requestsTo} onChange={setRequestsTo} others={sorted} testId="requests" />
      {blocks.teams.length > 0 && (
        <label className="flex items-start gap-2 rounded-md border bg-card px-3 py-2.5 text-sm">
          <input type="checkbox" checked={leaveTeams} onChange={(e) => setLeaveTeams(e.target.checked)} className="mt-0.5 size-4 accent-primary" data-testid="departure-teams" />
          <span>Retirer des équipes des éditions en cours <span className="text-xs text-muted-foreground">· {blocks.teams.length} : {blocks.teams.slice(0, 5).join(", ")}{blocks.teams.length > 5 ? "…" : ""}</span></span>
        </label>
      )}
      {blocks.tasks > 0 && <p className="text-xs text-muted-foreground">{blocks.tasks} tâche{blocks.tasks > 1 ? "s" : ""} personnelle{blocks.tasks > 1 ? "s" : ""} à faire : elles restent à son nom (une tâche est personnelle).</p>}
      <div className={cn("grid gap-2 rounded-md border px-3 py-2.5", deactivate ? "border-danger/40 bg-danger-soft/40" : "bg-card")}>
        <label className="flex items-center gap-2 text-sm">Date de départ <Input type="date" value={leftAt} onChange={(e) => setLeftAt(e.target.value)} className="h-8 w-40" data-testid="departure-date" /></label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={deactivate} onChange={(e) => setDeactivate(e.target.checked)} className="mt-0.5 size-4 accent-primary" data-testid="departure-deactivate" disabled={!person.active} />
          <span>Désactiver dans la foulée <span className="text-xs text-muted-foreground">· plus d&apos;accès, sessions fermées ; la personne reste dans l&apos;historique et se réactive depuis le tableau</span></span>
        </label>
      </div>
      <div><Button onClick={submit} disabled={pending} data-testid="departure-submit">{deactivate ? "Réattribuer et désactiver" : "Réattribuer"}</Button></div>
    </div>
  );
}
