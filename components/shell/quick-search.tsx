"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function QuickSearch({ editions }: { editions: { id: string; label: string }[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); ref.current?.focus(); setOpen(true); }
      if (e.key === "Escape") { setOpen(false); ref.current?.blur(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const results = q.length >= 2 ? editions.filter((e) => norm(e.label).includes(norm(q))).slice(0, 8) : [];

  return (
    <div className="relative hidden w-full max-w-72 md:block">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { router.push(`/edition/${results[0].id}`); setQ(""); setOpen(false); } }}
        placeholder="Trouver une édition…  ⌘K"
        className="h-8 rounded-md bg-card pl-8 text-xs"
        aria-label="Recherche"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={() => { router.push(`/edition/${r.id}`); setQ(""); setOpen(false); }}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
