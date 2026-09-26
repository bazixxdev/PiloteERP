"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type R = { ok: true } | { ok: false; error: string };

// Même geste que les formulaires de l'année (add-forms.tsx, allocations.tsx) : la commande, son erreur en toast, puis la page
// relue. `onError` reçoit le message quand le formulaire l'affiche lui-même (période refusée).
export function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: () => void, onError?: (msg: string) => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) { if (onError) onError(res.error); else toast.error(res.error); return; }
      after?.();
      router.refresh();
    });
  return { pending, run };
}
