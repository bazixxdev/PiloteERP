"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createEdition, createPerson, createPole, createProject, createRef, createRefValue, importCsv, togglePersonTimeCode } from "@/app/actions/admin";

type R = { ok: true; data?: unknown } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: (r: R) => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error); return; }
      after?.(res);
      router.refresh();
    });
  return { pending, run };
}

export function AddSimpleForm({ kind, placeholder, compact, family, projectId }: { kind: "person" | "pole" | "funder" | "mission" | "timeCode" | "refValue" | "edition"; placeholder: string; compact?: boolean; family?: string; projectId?: string }) {
  const [v, setV] = useState(kind === "edition" ? String(new Date().getFullYear() + 1) : "");
  const { pending, run } = useRun();
  const router = useRouter();
  const submit = () => {
    if (!v.trim()) return;
    const fn = () => {
      switch (kind) {
        case "person": return createPerson(v);
        case "pole": return createPole(v);
        case "refValue": return createRefValue(family!, v);
        case "edition": return createEdition(projectId!, Number(v));
        default: return createRef(kind, v);
      }
    };
    run(fn, (r) => {
      if (kind === "edition" && r.ok && r.data) router.push(`/edition/${(r.data as { editionId: string }).editionId}`);
      else setV("");
    });
  };
  return (
    <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className={compact ? "h-7 w-28 text-xs" : "h-8 w-48"} type={kind === "edition" ? "number" : "text"} data-testid={`add-${kind}-input`} />
      <Button type="submit" size={compact ? "xs" : "sm"} variant="outline" disabled={pending || !v.trim()} data-testid={`add-${kind}-submit`}><Plus />{compact ? "" : "Ajouter"}</Button>
    </form>
  );
}

type Opt = { value: string; label: string };

export function CreateProjectForm({ poles, people, missions }: { poles: Opt[]; people: Opt[]; missions: Opt[] }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [poleId, setPoleId] = useState(poles[0]?.value ?? "");
  const [pilotId, setPilotId] = useState(people[0]?.value ?? "");
  const [missionId, setMissionId] = useState(missions[0]?.value ?? "");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { pending, run } = useRun();
  const router = useRouter();
  const sel = "h-8 rounded-lg border bg-card px-2 text-sm";
  return (
    <form className="flex flex-wrap items-center gap-1.5" data-testid="create-project" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; run(() => createProject({ name, analyticCode: code, poleId, pilotId, missionId, year: Number(year) }), (r) => { if (r.ok && r.data) router.push(`/edition/${(r.data as { editionId: string }).editionId}`); }); }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du projet" className="h-8 w-44" data-testid="cp-name" />
      <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" className="h-8 w-20" data-testid="cp-code" />
      <select className={sel} value={poleId} onChange={(e) => setPoleId(e.target.value)} aria-label="Pôle">{poles.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      <select className={sel} value={pilotId} onChange={(e) => setPilotId(e.target.value)} aria-label="Pilote" data-testid="cp-pilot">{people.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      <select className={sel} value={missionId} onChange={(e) => setMissionId(e.target.value)} aria-label="Mission">{missions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-8 w-20" aria-label="Année" />
      <Button type="submit" size="sm" disabled={pending || !name.trim()} data-testid="cp-submit"><Plus />Créer le projet et son édition</Button>
    </form>
  );
}

export function TimeCodeToggle({ personId, timeCodeId, on, readOnly }: { personId: string; timeCodeId: string; on: boolean; readOnly: boolean }) {
  const { pending, run } = useRun();
  return <input type="checkbox" className="accent-primary" checked={on} disabled={readOnly || pending} onChange={(e) => run(() => togglePersonTimeCode(personId, timeCodeId, e.target.checked))} />;
}

export function ImportForm() {
  const [table, setTable] = useState<"personnes" | "financeurs" | "projets">("financeurs");
  const [text, setText] = useState("");
  const { pending, run } = useRun();
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <select className="h-8 rounded-lg border bg-card px-2 text-sm" value={table} onChange={(e) => setTable(e.target.value as typeof table)}>
          <option value="financeurs">financeurs</option><option value="personnes">personnes</option><option value="projets">projets</option>
        </select>
        <input type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(setText); }} />
      </div>
      <textarea className="min-h-24 rounded-lg border bg-card p-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"nom\nNouveau financeur"} />
      <Button size="sm" disabled={pending || !text.trim()} onClick={() => run(() => importCsv(table, text), (r) => { const d = (r as { data?: { created: number; skipped: string[] } }).data; toast.success(`${d?.created ?? 0} créé(s), ${d?.skipped.length ?? 0} ignoré(s)`); setText(""); })}><Upload />Importer</Button>
    </div>
  );
}
