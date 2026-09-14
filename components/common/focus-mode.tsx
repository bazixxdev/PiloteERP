"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Minimize2 } from "lucide-react";

// Mode focus (retour du 14/09) : l'écran se vide de la navigation pour un moment d'attention — saisir ses temps, rédiger une note ou une fiche.
// Pas de plein écran natif (contrairement à la projection) ; Échap ramène à l'écran normal.
export function FocusMode({ on, exitHref }: { on: boolean; exitHref: string }) {
  const router = useRouter();
  useEffect(() => {
    document.documentElement.classList.toggle("focus-mode", on);
    const onKey = (e: KeyboardEvent) => { if (on && e.key === "Escape") router.push(exitHref); };
    document.addEventListener("keydown", onKey);
    return () => { document.documentElement.classList.remove("focus-mode"); document.removeEventListener("keydown", onKey); };
  }, [on, exitHref, router]);
  if (!on) return null;
  return (
    <Link href={exitHref} className="fixed top-3 right-4 z-50 inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm hover:bg-muted" data-testid="focus-exit">
      <Minimize2 className="size-3.5" />Quitter le mode focus <kbd className="rounded border px-1 text-[10px]">Échap</kbd>
    </Link>
  );
}
