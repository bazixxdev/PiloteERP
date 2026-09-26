"use client";

import { useEffect, useState, useTransition } from "react";
import { withBase } from "@/lib/base-path";
import { CalendarPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/copy-button";
import { ensureMyIcsToken, ensureTeamIcsToken } from "@/app/actions/ics";
import { V, pl } from "@/lib/vocab";

// Carte « Dans votre agenda » : l'adresse du flux à coller dans Outlook (Ajouter un calendrier → S'abonner depuis le web).
export function IcsCard({ kind, canRegenerate = true, personId }: { kind: "me" | "team"; canRegenerate?: boolean; personId?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    setToken(null);
    (kind === "me" ? ensureMyIcsToken() : ensureTeamIcsToken()).then(setToken);
  }, [kind, personId]);
  const url = token && typeof window !== "undefined" ? `${window.location.origin}${withBase(`/api/agenda/${token}.ics`)}` : null;
  return (
    <div className="rounded-2xl border bg-card p-5" data-testid={`ics-${kind}`}>
      <div className="mb-1 flex items-center gap-2 text-base font-semibold"><CalendarPlus className="size-4 text-primary" />{kind === "me" ? "Mes échéances dans mon agenda" : "Les échéances de l'équipe dans un agenda"}</div>
      <p className="mb-3 text-sm text-muted-foreground">
        {kind === "me" ? "Mes jalons, les livrables financeurs de mes projets et mes validations à traiter, " : `Tous les jalons et livrables financeurs des ${pl(V.projet)} en cours, `}
        en calendrier superposé dans Outlook : <em>Ajouter un calendrier → S'abonner depuis le web</em>, puis coller l'adresse. Mise à jour toutes les heures ; l'outil n'écrit rien dans votre agenda.
      </p>
      {url ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-full truncate rounded-lg bg-muted px-2 py-1 font-mono text-xs" title={url} data-testid={`ics-url-${kind}`}>{url}</code>
          <CopyButton text={url} label="Copier l'adresse" />
          <Button asChild size="xs" variant="ghost"><a href={url}>Aperçu .ics</a></Button>
          {canRegenerate && (
            <Button size="xs" variant="ghost" disabled={pending} title="Invalide l'ancienne adresse" onClick={() => start(async () => setToken(await (kind === "me" ? ensureMyIcsToken(true) : ensureTeamIcsToken(true))))}><RefreshCw />Régénérer</Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{token === null && kind === "team" ? "Adresse disponible auprès de l'administration." : "Chargement…"}</p>
      )}
    </div>
  );
}
