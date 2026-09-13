"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GO: Record<string, string> = { p: "/portefeuille", s: "/ma-semaine", t: "/temps", a: "/annuel", v: "/validations", c: "/cafe", o: "/codir", m: "/seminaire", l: "/cloture", r: "/rappels", d: "/admin" };
const LIST: [string, string][] = [
  ["⌘K", "Trouver une édition"], ["g puis p", "Portefeuille"], ["g puis s", "Ma semaine"], ["g puis t", "Mes temps"], ["g puis a", "Vue annuelle"],
  ["g puis v", "Validations"], ["g puis c", "Écran café"], ["g puis o", "Écran CODIR"], ["g puis m", "Séminaire"], ["g puis l", "Clôture"], ["g puis d", "Admin"], ["Tab / flèches / Entrée", "Circuler dans les grilles"], ["?", "Cette aide"],
];

// Raccourcis clavier façon Linear : « g » puis une lettre.
export function Shortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") { setOpen((o) => !o); return; }
      if (e.key === "g") { armed = Date.now(); return; }
      if (armed && Date.now() - armed < 1500 && GO[e.key]) { router.push(GO[e.key]); armed = 0; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Raccourcis clavier</DialogTitle><DialogDescription>Hors champ de saisie.</DialogDescription></DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {LIST.map(([k, v]) => (<div key={k} className="contents"><dt><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd></dt><dd className="text-muted-foreground">{v}</dd></div>))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
