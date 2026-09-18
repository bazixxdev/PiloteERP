"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchBrevoLists, followBrevoList, syncBrevo, unfollowBrevoList } from "@/app/actions/brevo";
import { syncReportText, type BrevoList } from "@/lib/brevo";

// Connecteur Brevo dans l'admin : synchroniser (tous les contacts du compte → annuaire), et choisir les listes Brevo à suivre
// (un miroir ici, visible de tous, en lecture). La clé reste dans l'environnement du serveur, jamais dans l'outil.
export function BrevoPanel({ configured, syncedAt, report, inBrevo }: { configured: boolean; syncedAt: string | null; report: string | null; inBrevo: number }) {
  const [lists, setLists] = useState<(BrevoList & { listId: string | null })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const load = () => start(async () => { const r = await fetchBrevoLists(); if (!r.ok) { setError(r.error); return; } setError(null); setLists(r.data!); });
  useEffect(() => { if (configured) load(); }, [configured]);
  if (!configured) return <p className="text-xs text-muted-foreground" data-testid="brevo-not-configured">Brevo : non configuré (<code>BREVO_API_KEY</code> absente). Le connecteur s&apos;active par la configuration du serveur ; en attendant, l&apos;import de fichier dans une liste fait le même travail.</p>;
  return (
    <div className="grid gap-3" data-testid="brevo-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" data-testid="brevo-last-sync">{syncedAt ? <>Dernière synchronisation le {syncedAt}{report ? ` · ${report}` : ""}</> : "Jamais synchronisé."} · {inBrevo} contact{inBrevo > 1 ? "s" : ""} de l&apos;annuaire {inBrevo > 1 ? "sont" : "est"} dans Brevo.</p>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await syncBrevo(); if (!r.ok) { toast.error(r.error); return; } toast.success(`Brevo : ${syncReportText(r.data!)}`); router.refresh(); load(); })} data-testid="brevo-sync"><RefreshCw />Synchroniser maintenant</Button>
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Listes Brevo <span className="font-normal">· suivre une liste = la voir ici, tenue à jour par Brevo</span></div>
        {error && <p className="text-xs text-danger" data-testid="brevo-error">{error}</p>}
        {!error && !lists && <p className="text-xs text-muted-foreground">Lecture des listes…</p>}
        {lists && lists.length === 0 && <p className="text-xs text-muted-foreground">Aucune liste dans ce compte Brevo.</p>}
        {lists && lists.length > 0 && (
          <ul className="divide-y text-sm" data-testid="brevo-lists">
            {lists.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-1" data-testid={`brevo-list-${l.id}`} data-followed={l.listId ? "1" : "0"}>
                <span className="min-w-0 truncate">{l.name} <span className="text-xs text-muted-foreground">· {l.folderName ?? "sans dossier"} · {l.totalSubscribers} abonné{l.totalSubscribers > 1 ? "s" : ""}</span></span>
                {l.listId ? (
                  <span className="flex items-center gap-2 text-xs"><Link href={`/contacts?liste=${l.listId}`} className="text-primary hover:underline">Ouvrir</Link><Button size="xs" variant="ghost" disabled={pending} onClick={() => { if (confirm(`Ne plus suivre « ${l.name} » ? Les contacts restent dans l'annuaire.`)) start(async () => { const r = await unfollowBrevoList(l.listId!); if (!r.ok) { toast.error(r.error); return; } router.refresh(); load(); }); }} data-testid={`brevo-unfollow-${l.id}`}>Ne plus suivre</Button></span>
                ) : (
                  <Button size="xs" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await followBrevoList(l.id); if (!r.ok) { toast.error(r.error); return; } toast.success(`« ${l.name} » suivie · ${syncReportText(r.data!.report)}`); router.refresh(); load(); })} data-testid={`brevo-follow-${l.id}`}>Suivre</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
