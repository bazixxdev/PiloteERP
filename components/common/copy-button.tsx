"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copier le chemin" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="xs"
      variant="outline"
      data-testid="copy-path"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* presse-papiers indisponible : le chemin reste lisible à côté */ }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="text-mint" /> : <Copy />}
      {done ? "Copié" : label}
    </Button>
  );
}
