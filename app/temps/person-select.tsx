"use client";

import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/common/searchable-select";

export function PersonSelect({ people, current, week }: { people: { id: string; name: string }[]; current: string; week: string }) {
  const router = useRouter();
  return (
    <SearchableSelect options={people.map((p) => ({ value: p.id, label: p.name }))} value={current} onChange={(v) => router.push(`/temps?semaine=${week}&personne=${v}`)} aria-label="Personne" className="rounded-full px-3" />
  );
}
