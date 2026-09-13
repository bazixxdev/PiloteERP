"use client";

import { usePathname, useRouter } from "next/navigation";

type Opt = { value: string; label: string };

const Filter = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="inline-flex items-center gap-1.5 rounded-[5px] border bg-card px-2 py-1 text-[11px]">{label}{children}</label>
);

// Filtres de la liste des conventions : financeur, statut, type (annuelle / pluriannuelle ou partagée).
export function ConventionFilters({ funders, statuses, current }: { funders: Opt[]; statuses: Opt[]; current: { financeur: string; statut: string; type: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const set = (key: string, value: string) => {
    const next = { ...current, [key]: value };
    const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  const sel = "max-w-[175px] border-0 bg-transparent text-[11px] focus:outline-none";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="convention-filters">
      <Filter label="Financeur">
        <select className={sel} value={current.financeur} onChange={(e) => set("financeur", e.target.value)} aria-label="Filtrer par financeur">
          <option value="">Tous les financeurs</option>
          {funders.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </Filter>
      <Filter label="Statut">
        <select className={sel} value={current.statut} onChange={(e) => set("statut", e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Filter>
      <Filter label="Type">
        <select className={sel} value={current.type} onChange={(e) => set("type", e.target.value)} aria-label="Filtrer par type">
          <option value="">Toutes</option>
          <option value="pluri">Pluriannuelles ou partagées</option>
          <option value="annuelle">Annuelles</option>
        </select>
      </Filter>
    </div>
  );
}
