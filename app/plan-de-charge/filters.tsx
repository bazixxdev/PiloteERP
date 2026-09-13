"use client";

import { usePathname, useRouter } from "next/navigation";
import { dayjs } from "@/lib/format";

type Opt = { value: string; label: string };
const Filter = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="inline-flex items-center gap-1.5 rounded-[5px] border bg-card px-2 py-1 text-[11px]">{label}{children}</label>
);

// Filtres du plan de charge : début, horizon, pôle, vue (personnes / projets), éditions à venir.
export function LoadFilters({ poles, current, allValue }: { poles: Opt[]; current: { debut: string; horizon: string; pole: string; vue: string; avenir: string }; allValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const set = (key: string, value: string) => {
    const next = { ...current, [key]: value };
    const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  const sel = "max-w-[190px] border-0 bg-transparent text-[11px] focus:outline-none";
  const starts = Array.from({ length: 18 }, (_, i) => dayjs().startOf("month").add(i - 6, "month").format("YYYY-MM"));
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="load-filters">
      <Filter label="À partir de"><select className={sel} value={current.debut} onChange={(e) => set("debut", e.target.value)} aria-label="Mois de début">{starts.map((m) => <option key={m} value={m}>{dayjs(m + "-01").format("MMMM YYYY")}</option>)}</select></Filter>
      <Filter label="Horizon"><select className={sel} value={current.horizon} onChange={(e) => set("horizon", e.target.value)} aria-label="Horizon"><option value="6">6 mois</option><option value="12">12 mois</option><option value="18">18 mois</option></select></Filter>
      <Filter label="Pôle"><select className={sel} value={current.pole || (allValue ? "" : "")} onChange={(e) => set("pole", e.target.value || allValue)} aria-label="Filtrer par pôle"><option value="">Tous les pôles</option>{poles.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Filter>
      <Filter label="Éditions"><select className={sel} value={current.avenir} onChange={(e) => set("avenir", e.target.value)} aria-label="Éditions incluses"><option value="">En cours et à venir</option><option value="non">En cours seulement</option><option value="seul">À venir seulement</option></select></Filter>
      <Filter label="Vue"><select className={sel} value={current.vue} onChange={(e) => set("vue", e.target.value)} aria-label="Vue" data-testid="load-view"><option value="personnes">Par personne</option><option value="projets">Par projet</option></select></Filter>
    </div>
  );
}
