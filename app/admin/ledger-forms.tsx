"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cloud, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearLedger, deleteAnalyticTag, importLedgerFile, setAnalyticTag, syncPennylane } from "@/app/actions/ledger";
import { Select } from "@/components/common/searchable-select";
import { V, un } from "@/lib/vocab";

type Opt = { value: string; label: string };

// Import du grand livre analytique : exercice + fichier xlsx / csv. Le résultat dit combien de lignes, combien agrégées.
export function LedgerImportForm({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState(String(defaultYear));
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  return (
    <form className="flex flex-wrap items-end gap-2" data-testid="ledger-import-form" onSubmit={(e) => {
      e.preventDefault();
      const file = fileRef.current?.files?.[0];
      if (!file) { toast.error("Choisissez un fichier."); return; }
      const fd = new FormData(); fd.set("year", year); fd.set("file", file);
      start(async () => {
        const r = await importLedgerFile(fd);
        if (!r.ok) { toast.error(r.error); return; }
        toast.success(`${r.data!.rows} écritures lues, ${r.data!.lines} lignes agrégées pour ${year}${r.data!.ignoredYears ? ` (${r.data!.ignoredYears} lignes d'autres exercices ignorées)` : ""}${r.data!.skipped ? ` · ${r.data!.skipped} écritures sans code ou sans compte ignorées` : ""}`);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      });
    }}>
      <label className="grid gap-1 text-xs"><span className="text-muted-foreground">Exercice</span><Input type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(e.target.value)} className="h-8 w-24" data-testid="ledger-year" /></label>
      <label className="grid gap-1 text-xs"><span className="text-muted-foreground">Grand livre analytique (xlsx, csv)</span><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="text-sm" data-testid="ledger-file" /></label>
      <Button type="submit" size="sm" disabled={pending} data-testid="ledger-import-submit"><Upload />Importer</Button>
    </form>
  );
}

export function PennylaneSyncButton({ configured, year }: { configured: boolean; year: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!configured) return <p className="text-xs text-muted-foreground">Pennylane : non configuré (<code>PENNYLANE_API_TOKEN</code> absent). L&apos;import de fichier suffit ; le connecteur s&apos;active par la configuration du serveur.</p>;
  return <Button size="sm" variant="outline" disabled={pending} data-testid="pennylane-sync" onClick={() => start(async () => { const r = await syncPennylane(year); if (!r.ok) { toast.error(r.error); return; } toast.success(`Pennylane : ${r.data!.rows} écritures, ${r.data!.lines} lignes pour ${year}`); router.refresh(); })}><Cloud />Synchroniser {year} depuis Pennylane</Button>;
}

export function ClearLedgerButton({ source, year }: { source: string; year: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <Button size="xs" variant="ghost" disabled={pending} title={`Effacer le snapshot ${source} ${year}`} aria-label={`Effacer ${source} ${year}`} onClick={() => { if (!confirm(`Effacer le réalisé ${source} de ${year} ? Un nouvel import le recrée.`)) return; start(async () => { const r = await clearLedger(source, year); if (!r.ok) { toast.error(r.error); return; } toast.success("Snapshot effacé"); router.refresh(); }); }}><Trash2 /></Button>;
}

// Un code que rien ne reconnaît : on dit à quoi il correspond (édition, action, projet, ligne) ou qu'on l'ignore.
export function TagForm({ code, editions, actions, projects, lines }: { code: string; editions: Opt[]; actions: Opt[]; projects: Opt[]; lines: Opt[] }) {
  const [kind, setKind] = useState("edition");
  const [target, setTarget] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const options = kind === "edition" ? editions : kind === "action" ? actions : kind === "project" ? projects : kind === "fundingLine" ? lines : [];
  const sel = "h-7 rounded-md border bg-card px-1.5 text-xs";
  return (
    <form className="flex flex-wrap items-center gap-1" data-testid={`tag-form-${code}`} onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setAnalyticTag(code, kind, kind === "ignore" ? null : target); if (!r.ok) { toast.error(r.error); return; } toast.success(`Code ${code} rapproché`); router.refresh(); }); }}>
      <Select className={sel} value={kind} onChange={(e) => { setKind(e.target.value); setTarget(""); }} aria-label="Type de cible" data-testid={`tag-kind-${code}`}>
        <option value="edition">{`${un(V.edition)} (un ${V.projet.one}, une seule année)`}</option><option value="action">{un(V.action)}</option><option value="project">un projet (chaque année)</option><option value="fundingLine">une ligne de financement</option><option value="ignore">à ignorer (fonctionnement)</option>
      </Select>
      {kind !== "ignore" && <Select className={`${sel} max-w-[260px]`} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Cible" data-testid={`tag-target-${code}`}><option value="">Choisir…</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>}
      <Button type="submit" size="xs" variant="outline" disabled={pending || (kind !== "ignore" && !target)} data-testid={`tag-submit-${code}`}>Rapprocher</Button>
    </form>
  );
}

export function DeleteTagButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <Button size="xs" variant="ghost" disabled={pending} title="Retirer cette correspondance" aria-label={`Retirer la correspondance ${code}`} onClick={() => start(async () => { const r = await deleteAnalyticTag(code); if (!r.ok) { toast.error(r.error); return; } router.refresh(); })}><Trash2 /></Button>;
}
