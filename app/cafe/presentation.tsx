"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Masque la barre latérale et l'en-tête pour projeter l'écran ; demande le plein écran natif quand le navigateur le permet ; Échap ramène à l'écran normal.
export function Presentation({ on, exitHref }: { on: boolean; exitHref?: string }) {
  const router = useRouter();
  useEffect(() => {
    document.documentElement.classList.toggle("presentation", on);
    if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (on && e.key === "Escape" && exitHref) router.push(exitHref); };
    document.addEventListener("keydown", onKey);
    return () => { document.documentElement.classList.remove("presentation"); document.removeEventListener("keydown", onKey); };
  }, [on, exitHref, router]);
  return null;
}
