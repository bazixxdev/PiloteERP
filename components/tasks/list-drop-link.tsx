"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTask } from "@/app/actions/tasks";
import { cn } from "@/lib/utils";

// Entrée de la colonne de gauche qui accepte une tâche glissée (retour du 15/09 : « comment on déplace une tâche ? drag and drop ? »).
export function ListDropLink({ href, listId, listName, active, className, children, testId, name }: { href: string; listId: string | null; listName: string; active: boolean; className?: string; children: React.ReactNode; testId?: string; name?: string }) {
  const [over, setOver] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <Link
      href={href} className={cn(className, over && "ring-2 ring-primary ring-offset-1 bg-info-soft")} aria-current={active ? "page" : undefined} data-testid={testId} data-name={name}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("text/task")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        const id = e.dataTransfer.getData("text/task");
        if (!id) return;
        start(async () => { const r = await updateTask(id, { listId }); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } toast.success(`Rangée dans « ${listName} »`); router.refresh(); });
      }}
    >{children}</Link>
  );
}
