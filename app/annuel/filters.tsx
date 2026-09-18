"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/common/searchable-select";
import { V, cap, de, tout } from "@/lib/vocab";

export function AnnuelFilters({ year, poles, pole, allValue = "" }: { year: number; poles: { value: string; label: string }[]; pole: string; allValue?: string }) {
  const router = useRouter();
  const url = (y: number, p: string) => `/annuel?annee=${y}${p ? `&pole=${p}` : ""}`;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="icon" aria-label="Année précédente"><Link href={url(year - 1, pole)}><ChevronLeft /></Link></Button>
      <span className="min-w-12 text-center text-sm font-semibold">{year}</span>
      <Button asChild variant="outline" size="icon" aria-label="Année suivante"><Link href={url(year + 1, pole)}><ChevronRight /></Link></Button>
      <span className="mx-1 h-5 w-px bg-border" />
      <Select className="h-8 rounded-full border bg-card px-3 text-sm" value={pole} onChange={(e) => router.push(url(year, e.target.value))} aria-label={cap(V.pole)} data-testid="annuel-pole">
        <option value={allValue}>{cap(tout(V.org))}</option>
        {poles.map((p) => <option key={p.value} value={p.value}>{`Réunion ${de(V.pole)} · `}{p.label}</option>)}
      </Select>
    </div>
  );
}
