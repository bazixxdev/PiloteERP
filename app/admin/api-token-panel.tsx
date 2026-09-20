"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { rotateApiToken } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function ApiTokenPanel({ token, canManage }: { token: string | null; canManage: boolean }) {
  const [current, setCurrent] = useState(token);
  const [pending, start] = useTransition();
  if (!canManage) return <p className="text-sm text-muted-foreground">Réservé à l&apos;administration.</p>;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-muted px-2 py-1 font-mono text-xs" data-testid="setting-api-token-value">{current ?? "Aucun jeton"}</code>
        <Button type="button" size="sm" variant="outline" disabled={pending} data-testid="api-token-rotate" onClick={() => start(async () => { const result = await rotateApiToken(); if (!result.ok) { toast.error(result.error); return; } setCurrent(result.data!.token); toast.success("Jeton remplacé : mettez à jour les consommateurs externes."); })}>
          {pending ? <Loader2 className="size-3 animate-spin" /> : <KeyRound className="size-3" />} Régénérer
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">La régénération invalide immédiatement l&apos;ancien jeton.</p>
    </div>
  );
}
