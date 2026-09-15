"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTask } from "@/app/actions/tasks";

// Cocher une de mes tâches depuis l'Aperçu de l'édition : même geste que dans Tâches.
export function TaskTick({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return <input type="checkbox" checked={done} disabled={pending} aria-label="Tâche faite" className="size-4 rounded border-border accent-primary" onChange={(e) => { const v = e.target.checked; setDone(v); start(async () => { const r = await updateTask(id, { done: v }); if (!r.ok) { toast.error(r.error); setDone(!v); } else router.refresh(); }); }} />;
}
