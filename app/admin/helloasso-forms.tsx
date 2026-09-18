"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchHelloAssoForms, followHelloAssoForm, syncHelloAsso, unfollowHelloAssoForm } from "@/app/actions/helloasso";
import { helloAssoReportText, type HelloAssoForm } from "@/lib/helloasso";

const TYPE_LABEL: Record<string, string> = { Membership: "Adhésions", Event: "Événement", Donation: "Dons", CrowdFunding: "Financement participatif", Shop: "Boutique", PaymentForm: "Paiement", Checkout: "Paiement" };

// Connecteur HelloAsso dans l'admin : synchroniser (adhésions → module Adhérents, inscrits des événements suivis → listes) et
// choisir les formulaires d'événement à suivre. Les identifiants restent dans l'environnement du serveur.
export function HelloAssoPanel({ configured, syncedAt, report }: { configured: boolean; syncedAt: string | null; report: string | null }) {
  const [forms, setForms] = useState<(HelloAssoForm & { listId: string | null })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const load = () => start(async () => { const r = await fetchHelloAssoForms(); if (!r.ok) { setError(r.error); return; } setError(null); setForms(r.data!); });
  useEffect(() => { if (configured) load(); }, [configured]);
  if (!configured) return <p className="text-xs text-muted-foreground" data-testid="helloasso-not-configured">HelloAsso : non configuré (<code>HELLOASSO_CLIENT_ID</code>, <code>HELLOASSO_CLIENT_SECRET</code>, <code>HELLOASSO_ORG_SLUG</code> absents). Le connecteur s&apos;active par la configuration du serveur ; en attendant, les adhésions se saisissent à la main.</p>;
  return (
    <div className="grid gap-3" data-testid="helloasso-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" data-testid="helloasso-last-sync">{syncedAt ? <>Dernière synchronisation le {syncedAt}{report ? ` · ${report}` : ""}</> : "Jamais synchronisé."}</p>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await syncHelloAsso(); if (!r.ok) { toast.error(r.error); return; } toast.success(`HelloAsso : ${helloAssoReportText(r.data!)}`); router.refresh(); load(); })} data-testid="helloasso-sync-admin"><RefreshCw />Synchroniser maintenant</Button>
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Formulaires <span className="font-normal">· les adhésions sont importées d&apos;office ; suivre un événement = ses inscrits en liste de contacts, tenue par HelloAsso</span></div>
        {error && <p className="text-xs text-danger" data-testid="helloasso-error">{error}</p>}
        {!error && !forms && <p className="text-xs text-muted-foreground">Lecture des formulaires…</p>}
        {forms && forms.length === 0 && <p className="text-xs text-muted-foreground">Aucun formulaire dans ce compte HelloAsso.</p>}
        {forms && forms.length > 0 && (
          <ul className="divide-y text-sm" data-testid="helloasso-forms">
            {forms.map((x) => (
              <li key={x.formSlug} className="flex items-center justify-between gap-2 py-1" data-testid={`helloasso-form-${x.formSlug}`} data-followed={x.listId ? "1" : "0"}>
                <span className="min-w-0 truncate">{x.title} <span className="text-xs text-muted-foreground">· {TYPE_LABEL[x.formType] ?? x.formType}{x.state && x.state !== "Public" ? ` · ${x.state}` : ""}</span></span>
                {x.formType === "Membership" ? <span className="text-xs text-muted-foreground"><Link href="/adherents" className="text-primary hover:underline">Adhérents</Link></span>
                  : x.formType === "Event" ? (x.listId
                    ? <span className="flex items-center gap-2 text-xs"><Link href={`/contacts?liste=${x.listId}`} className="text-primary hover:underline">Ouvrir</Link><Button size="xs" variant="ghost" disabled={pending} onClick={() => { if (confirm(`Ne plus suivre « ${x.title} » ? Les contacts restent dans l'annuaire.`)) start(async () => { const r = await unfollowHelloAssoForm(x.listId!); if (!r.ok) { toast.error(r.error); return; } router.refresh(); load(); }); }} data-testid={`helloasso-unfollow-${x.formSlug}`}>Ne plus suivre</Button></span>
                    : <Button size="xs" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await followHelloAssoForm(x.formSlug); if (!r.ok) { toast.error(r.error); return; } toast.success(`« ${x.title} » suivi · ${helloAssoReportText(r.data!.report)}`); router.refresh(); load(); })} data-testid={`helloasso-follow-${x.formSlug}`}>Suivre les inscrits</Button>)
                  : <span className="text-xs text-muted-foreground">—</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
