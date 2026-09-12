"use client";

import { useRouter } from "next/navigation";

export function PersonSelect({ people, current, week }: { people: { id: string; name: string }[]; current: string; week: string }) {
  const router = useRouter();
  return (
    <select className="h-8 rounded-full border bg-card px-3 text-sm" value={current} onChange={(e) => router.push(`/temps?semaine=${week}&personne=${e.target.value}`)} aria-label="Personne">
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}
