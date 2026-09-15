"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setInstanceModule } from "@/app/actions/admin";
import { INSTANCE_MODULES } from "@/lib/modules";
import { cn } from "@/lib/utils";

// Modules de l'installation (lot 0) : le même patron que les modules par personne (Mon compte), à l'échelle de la structure.
export function InstanceModulesForm({ enabled, readOnly }: { enabled: string[]; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<string[]>(enabled);
  const router = useRouter();
  return (
    <ul className="grid gap-2" data-testid="instance-modules-form">
      {INSTANCE_MODULES.map((m) => {
        const on = state.includes(m.key);
        return (
          <li key={m.key} className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5", on ? "bg-card" : "bg-muted/40")}>
            <label className="flex flex-1 cursor-pointer items-start gap-3">
              <input type="checkbox" checked={on} disabled={pending || readOnly} onChange={(e) => { const next = e.target.checked; setState((s) => (next ? [...s, m.key] : s.filter((k) => k !== m.key))); start(async () => { const r = await setInstanceModule(m.key, next); if (!r.ok) { toast.error(r.error); setState(enabled); } else { toast.success(next ? `Module « ${m.label} » activé` : `Module « ${m.label} » désactivé — les données restent`); router.refresh(); } }); }} className="mt-0.5 size-4 rounded border-border accent-primary" data-testid={`instance-module-${m.key}`} />
              <span><b className="text-sm">{m.label}</b><br /><span className="text-xs text-muted-foreground">{m.hint}</span></span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
