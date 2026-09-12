"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };

export function PortfolioFilters({ poles, statuses, current, thisQuarter }: { poles: Opt[]; statuses: Opt[]; current: { pole: string; statut: string; alerte: string; trimestre: string }; thisQuarter: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const set = (key: string, value: string) => {
    const next = { ...current, [key]: value };
    const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  const sel = "h-8 rounded-full border bg-card px-3 text-sm";
  const chip = (active: boolean) => cn("h-8 rounded-full border px-3 text-sm transition-colors", active ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted");
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="portfolio-filters">
      <select className={sel} value={current.pole} onChange={(e) => set("pole", e.target.value)} aria-label="Pôle">
        <option value="">Tous les pôles</option>
        {poles.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <select className={sel} value={current.statut} onChange={(e) => set("statut", e.target.value)} aria-label="Statut">
        <option value="">Tous les statuts</option>
        {statuses.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <span className="mx-1 h-5 w-px bg-border" />
      <button type="button" className={chip(current.alerte === "")} onClick={() => set("alerte", "")}>Tout</button>
      <button type="button" className={chip(current.alerte === "oui")} onClick={() => set("alerte", "oui")}>En alerte</button>
      <button type="button" className={chip(current.alerte === "danger")} onClick={() => set("alerte", "danger")}>Alerte forte</button>
      <span className="mx-1 h-5 w-px bg-border" />
      <button type="button" className={chip(current.trimestre === thisQuarter)} onClick={() => set("trimestre", current.trimestre === thisQuarter ? "" : thisQuarter)}>Ce trimestre ({thisQuarter.replace("-", " ")})</button>
    </div>
  );
}
