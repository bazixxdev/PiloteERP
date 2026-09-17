"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createEdition, createPerson, createPole, createProject, createRef, createRefValue, importCsv, togglePersonTimeCode, createRhythm, addRhythmPeriod, toggleProjectPole } from "@/app/actions/admin";
import { SearchableSelect } from "@/components/common/searchable-select";

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

// Ajout d'un objet simple (une personne, un pôle, une mission, une année d'édition…) : un bouton, puis un petit panneau
// avec le champ — jamais un champ à nu dans l'en-tête (règle de Gaël, 17/09 : « l'ajout doit être via un bouton »).
export function AddSimpleForm({ kind, placeholder, compact, family, projectId, label = "Ajouter" }: { kind: "person" | "pole" | "funder" | "mission" | "timeCode" | "refValue" | "edition" | "rhythm" | "supplier"; placeholder: string; compact?: boolean; family?: string; projectId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
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
        case "rhythm": return createRhythm(v);
        default: return createRef(kind, v);
      }
    };
    run(fn, (r) => {
      setOpen(false);
      if (kind === "edition" && r.ok && r.data) router.push(`/edition/${(r.data as { editionId: string }).editionId}`);
      else setV("");
    });
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size={compact ? "xs" : "sm"} variant="outline" title={placeholder} aria-label={compact ? placeholder : undefined} data-testid={`add-${kind}-open`}><Plus />{compact ? "" : label}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2.5">
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="grid gap-1 text-xs"><span className="font-semibold">{placeholder}</span><Input autoFocus value={v} onChange={(e) => setV(e.target.value)} className="h-8" type={kind === "edition" ? "number" : "text"} data-testid={`add-${kind}-input`} /></label>
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" size="xs" disabled={pending || !v.trim()} data-testid={`add-${kind}-submit`}><Plus />Ajouter</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

type Opt = { value: string; label: string };

// Création d'un projet et de sa première édition : un bouton en haut à droite de la page Projets ouvre la modale
// (retour de Gaël, 17/09 : « l'ajout doit être via un bouton en haut à droite, pas en direct », par une modale ou un volet).
export function CreateProjectDialog({ poles, people, missions }: { poles: Opt[]; people: Opt[]; missions: Opt[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [poleId, setPoleId] = useState(poles[0]?.value ?? "");
  const [pilotId, setPilotId] = useState(people[0]?.value ?? "");
  const [missionId, setMissionId] = useState(missions[0]?.value ?? "");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { pending, run } = useRun();
  const router = useRouter();
  const field = "grid gap-1 text-xs";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" data-testid="cp-open"><Plus />Nouveau projet</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-3" data-testid="create-project" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; run(() => createProject({ name, analyticCode: code, poleId, pilotId, missionId, year: Number(year) }), (r) => { if (r.ok && r.data) { setOpen(false); router.push(`/edition/${(r.data as { editionId: string }).editionId}`); } }); }}>
          <DialogHeader>
            <DialogTitle>Nouveau projet</DialogTitle>
            <DialogDescription>Un objet permanent, avec sa première édition. Le pôle principal est celui du pilote ; les pôles associés se cochent ensuite dans la liste.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <label className={field}><span className="font-semibold">Nom du projet</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Forum régional de l'ESS" autoFocus required data-testid="cp-name" /></label>
            <label className={field}><span className="font-semibold">Code analytique</span><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SEN-03" data-testid="cp-code" /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={field}><span className="font-semibold">Pilote</span><SearchableSelect options={people} value={pilotId} onChange={setPilotId} aria-label="Pilote" data-testid="cp-pilot" className="w-full" /></label>
            <label className={field}><span className="font-semibold">Pôle principal</span><select className="h-8 w-full rounded-lg border bg-card px-2 text-sm" value={poleId} onChange={(e) => setPoleId(e.target.value)} aria-label="Pôle">{poles.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <label className={field}><span className="font-semibold">Mission du plan opérationnel</span><select className="h-8 w-full rounded-lg border bg-card px-2 text-sm" value={missionId} onChange={(e) => setMissionId(e.target.value)} aria-label="Mission">{missions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label className={field}><span className="font-semibold">Première édition</span><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-8" aria-label="Année" /></label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" size="sm" disabled={pending || !name.trim()} data-testid="cp-submit"><Plus />Créer le projet et son édition</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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


// Nouvelle période de rythme pour une personne (changement d'option, passage à temps partiel…).
export function RhythmPeriodForm({ personId, rhythms }: { personId: string; rhythms: Opt[] }) {
  const [rhythmId, setRhythmId] = useState(rhythms[0]?.value ?? "");
  const [from, setFrom] = useState("");
  const { pending, run } = useRun();
  return (
    <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (!from) return; run(() => addRhythmPeriod(personId, rhythmId, from), () => setFrom("")); }}>
      <select className="h-7 max-w-[160px] rounded-lg border bg-card px-1 text-xs" value={rhythmId} onChange={(e) => setRhythmId(e.target.value)} aria-label="Rythme">
        {rhythms.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <span className="text-[10px] text-muted-foreground">à partir du</span>
      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 w-32 text-xs" aria-label="Nouveau rythme à partir du" title="Date à laquelle ce rythme commence ; le précédent s'arrête la veille" />
      <Button type="submit" size="xs" variant="outline" disabled={pending || !from} title="Ajouter ce rythme à partir de cette date"><Plus /></Button>
    </form>
  );
}


// Pôles secondaires d'un projet : puces à cocher (le pôle principal est grisé).
export function ProjectPolesPicker({ projectId, mainPoleId, poles, selected, readOnly }: { projectId: string; mainPoleId: string; poles: Opt[]; selected: string[]; readOnly: boolean }) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap gap-1">
      {poles.map((p) => {
        const main = p.value === mainPoleId;
        const on = selected.includes(p.value);
        return (
          <button key={p.value} type="button" disabled={readOnly || main || pending} title={main ? "Pôle principal (celui du pilote)" : on ? "Retirer ce pôle" : "Associer ce pôle"} data-testid={`project-pole-${p.value}`}
            className={"rounded-full border px-2 py-0.5 text-[11px] " + (main ? "border-primary bg-primary text-white" : on ? "border-primary bg-secondary text-primary" : "bg-card text-muted-foreground hover:bg-muted")}
            onClick={() => run(() => toggleProjectPole(projectId, p.value, !on))}>
            {p.label.split(" ")[0]}{main ? " · principal" : ""}
          </button>
        );
      })}
    </div>
  );
}
