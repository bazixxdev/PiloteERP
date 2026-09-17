"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proposeProject } from "@/app/actions/edition";
import { Select } from "@/components/common/searchable-select";

// Proposer un projet (retour du 14/09) : n'importe quel chargé de mission, une idée en quelques lignes, et la fiche démarre son cycle.
export function ProposeProjectForm({ missions, poles, defaultPoleId, years }: { missions: { id: string; name: string }[]; poles: { id: string; name: string }[]; defaultPoleId: string | null; years: number[] }) {
  const [name, setName] = useState("");
  const [missionId, setMissionId] = useState(missions[0]?.id ?? "");
  const [poleId, setPoleId] = useState(defaultPoleId ?? poles[0]?.id ?? "");
  const [year, setYear] = useState(years[0]);
  const [summary, setSummary] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="grid max-w-2xl gap-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await proposeProject({ name, missionId, year, summary, poleId }); if (!r.ok) toast.error(r.error); else { toast.success("Projet proposé : la fiche attend la relecture de votre responsable"); router.push(`/edition/${r.data!.editionId}?onglet=fiche`); router.refresh(); } }); }} data-testid="propose-project-form">
      <label className="grid gap-1 text-xs"><span className="font-semibold">Nom du projet</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Catalogue de formation, Repair café de la TESS…" required data-testid="propose-name" /></label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1 text-xs"><span className="font-semibold">Mission du plan opérationnel</span><Select value={missionId} onChange={(e) => setMissionId(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm" data-testid="propose-mission">{missions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></label>
        <label className="grid gap-1 text-xs"><span className="font-semibold">Pôle porteur</span><Select value={poleId} onChange={(e) => setPoleId(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm">{poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></label>
        <label className="grid gap-1 text-xs"><span className="font-semibold">Année</span><Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-md border bg-card px-2 text-sm">{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select></label>
      </div>
      <label className="grid gap-1 text-xs"><span className="font-semibold">Ce que vous proposez <span className="font-normal text-muted-foreground">— l'idée, le public, ce que ça change ; ça devient la première rubrique de la fiche</span></span>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={6} required className="rounded-md border bg-card p-2 text-sm" placeholder="Un partenaire nous sollicite pour… Je propose de… Les têtes de réseau y gagneraient…" data-testid="propose-summary" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">Vous serez pilote de ce projet « en devenir ». Votre responsable de pôle et la direction sont prévenus ; ils relisent la fiche, puis elle passe au CODIR et, s'il le faut, au CA.</p>
        <Button type="submit" disabled={pending || !name.trim() || !summary.trim()} data-testid="propose-project-submit"><Send />Proposer ce projet</Button>
      </div>
    </form>
  );
}
