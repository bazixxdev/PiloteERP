"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markDeliverableDone } from "@/app/actions/edition";

export function DeliverableDone({ id, done, readOnly }: { id: string; done: boolean; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <input
      type="checkbox"
      className="size-4 accent-primary"
      checked={done}
      disabled={readOnly || pending}
      title={done ? "Remis" : "Marquer comme remis"}
      onChange={(e) => start(async () => { const r = await markDeliverableDone(id, e.target.checked); if (!r.ok) toast.error(r.error); router.refresh(); })}
    />
  );
}
