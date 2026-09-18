"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUTS_EVENT } from "./help-menu";
import { V, un } from "@/lib/vocab";

type Go = { key: string; href: string; label: string; roles?: string[] };
const CODIR = ["director", "raf", "pole_lead"];
const ADMIN = ["director", "raf"];
const GOS: Go[] = [
  { key: "p", href: "/portefeuille", label: "Portefeuille" }, { key: "s", href: "/ma-semaine", label: "Ma semaine" }, { key: "t", href: "/temps", label: "Temps" },
  { key: "a", href: "/annuel", label: "Vue annuelle" }, { key: "v", href: "/validations", label: "Validations" }, { key: "c", href: "/cafe", label: "Écran café" },
  { key: "o", href: "/codir", label: `Écran ${V.codir.one}`, roles: CODIR }, { key: "m", href: "/seminaire", label: "Séminaire", roles: CODIR },
  { key: "l", href: "/cloture", label: "Clôture", roles: ADMIN }, { key: "d", href: "/admin", label: "Admin", roles: ADMIN },
];

// Raccourcis clavier façon Linear : « g » puis une lettre. Seuls les écrans du profil sont proposés (même règle que la barre latérale).
export function Shortcuts({ role }: { role: string }) {
  const gos = GOS.filter((g) => !g.roles || g.roles.includes(role));
  const GO: Record<string, string> = Object.fromEntries(gos.map((g) => [g.key, g.href]));
  const LIST: [string, string][] = [["⌘K", `Trouver ${un(V.edition)}`], ...gos.map((g): [string, string] => [`g puis ${g.key}`, g.label]), ["Tab / flèches / Entrée", "Circuler dans les grilles"], ["?", "Cette aide"]];
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
    const onHelp = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(SHORTCUTS_EVENT, onHelp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(SHORTCUTS_EVENT, onHelp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, role]);
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
