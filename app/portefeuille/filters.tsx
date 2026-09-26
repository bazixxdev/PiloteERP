"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/common/searchable-select";
import { V, cap, pl, tous } from "@/lib/vocab";

type Opt = { value: string; label: string };

const Filter = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="inline-flex items-center gap-1.5 rounded-[5px] border bg-card px-2 py-1 text-[11px]">{label}{children}</label>
);

// Barre de filtres V2 : des sélecteurs discrets à gauche, l'année à droite.
export function PortfolioFilters({ poles, statuses, current, thisQuarter, year, showPole = true }: { poles: Opt[]; statuses: Opt[]; current: { pole: string; statut: string; alerte: string; trimestre: string; perimetre?: string }; thisQuarter: string; year: number; showPole?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const set = (key: string, value: string) => {
    const next = { ...current, [key]: value };
    const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  const sel = "max-w-[175px] h-5 gap-1 border-0 bg-transparent px-0 text-[11px] focus:outline-none focus-visible:ring-0";
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3" data-testid="portfolio-filters">
      <div className="flex flex-wrap items-center gap-2">
        {showPole && (
          <Filter label={cap(V.pole)}>
            <Select className={sel} value={current.pole} onChange={(e) => set("pole", e.target.value)} aria-label={`Filtrer le portefeuille par ${V.pole.one}`}>
              <option value="">{`Tous les ${pl(V.pole)}`}</option>
              {poles.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Filter>
        )}
        <Filter label="Statut">
          <Select className={sel} value={current.statut} onChange={(e) => set("statut", e.target.value)} aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            {statuses.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </Filter>
        <Filter label="Afficher">
          <Select className={sel} value={current.alerte} onChange={(e) => set("alerte", e.target.value)} aria-label="Filtrer le portefeuille par alerte">
            <option value="">{cap(tous(V.projet))}</option>
            <option value="oui">Avec une alerte</option>
            <option value="danger">Avec une alerte forte</option>
            <option value="calme">Sans alerte</option>
          </Select>
        </Filter>
        <Filter label="Période">
          <Select className={sel} value={current.trimestre} onChange={(e) => set("trimestre", e.target.value)} aria-label="Filtrer par trimestre">
            <option value="">Toute l'année</option>
            <option value={thisQuarter}>Ce trimestre ({thisQuarter.replace("-", " ")})</option>
          </Select>
        </Filter>
      </div>
      <span className="text-[11px] text-muted-foreground">Vue tableau · Année {year}</span>
    </div>
  );
}
