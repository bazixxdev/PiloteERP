"use client";

import { useEffect } from "react";

// Masque la barre latérale et l'en-tête pour projeter l'écran.
export function Presentation({ on }: { on: boolean }) {
  useEffect(() => {
    document.documentElement.classList.toggle("presentation", on);
    return () => document.documentElement.classList.remove("presentation");
  }, [on]);
  return null;
}
