"use client";

import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { FileSpreadsheet, Globe } from "lucide-react";
import { CopyButton } from "@/components/common/copy-button";
import { V, cap, le, pl } from "@/lib/vocab";

// Adresses prêtes à coller : Excel (Données → À partir du web) et agenda public du site.
export function ApiCard({ apiToken }: { apiToken: string | null }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const row = (label: string, path: string, testId?: string) => {
    const url = origin ? `${origin}${withBase(path)}` : "";
    return (
      <li className="grid grid-cols-[10rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5">
        <span className="text-sm">{label}</span>
        <code className="min-w-0 truncate rounded-lg bg-muted px-2 py-1 font-mono text-xs" title={url} data-testid={testId}>{url || "…"}</code>
        {url && <CopyButton text={url} label="Copier" />}
      </li>
    );
  };
  return (
    <div className="grid gap-4">
      <div>
        <div className="mb-1 flex items-center gap-2 font-medium"><FileSpreadsheet className="size-4 text-primary" />Excel de {le(V.raf)} branché sur l'outil</div>
        <p className="mb-2 text-sm text-muted-foreground">Dans Excel : <em>Données → Obtenir des données → À partir du web</em>, coller l'adresse. Le tableau se rafraîchit d'un clic, sans copier-coller. Le jeton est réglable ci-dessus ; le changer coupe les anciens classeurs.</p>
        {apiToken ? (
          <ul className="divide-y">
            {row("Temps (toutes saisies)", `/admin/export?table=temps&jeton=${apiToken}`, "api-url-temps")}
            {row("Temps du mois par projet", `/cloture/export?mois=AAAA-MM&par=projet&jeton=${apiToken}`)}
            {row("Qui finance quoi (année)", `/matrice/export?annee=AAAA&jeton=${apiToken}`, "api-url-matrice")}
            {row("Financements", `/admin/export?table=financements&jeton=${apiToken}`)}
            {row(`${cap(pl(V.edition))} (budget)`, `/admin/export?table=editions&jeton=${apiToken}`)}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Aucun jeton : saisissez-en un dans le champ ci-dessus.</p>}
      </div>
      <div>
        <div className="mb-1 flex items-center gap-2 font-medium"><Globe className="size-4 text-primary" />Agenda public pour le site internet</div>
        <p className="mb-2 text-sm text-muted-foreground">Les {pl(V.action)} cochées « Public » dans les {pl(V.edition)} en cours, en flux iCal sans jeton : n'importe quel module agenda WordPress l'affiche.</p>
        <ul>{row("Événements publics (.ics)", "/api/agenda/public.ics", "api-url-public")}</ul>
      </div>
    </div>
  );
}
