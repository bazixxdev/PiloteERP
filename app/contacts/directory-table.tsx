"use client";

import { useCallback, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { BREVO_STATUS } from "@/lib/contacts";
import { cn } from "@/lib/utils";
import { BulkBar, FilterCell, SortTh, useContactsTable, brevoLabel, BREVO_FILTER_OPTIONS, type BulkContext, type Column } from "./table-tools";

// L'annuaire (« Tous les contacts ») : tri, filtres, sélection et actions groupées dans le navigateur (19/09). Les lignes viennent du
// serveur déjà chargées ; l'adresse ne porte plus le filtre (les filtres se règlent ici, la fiche s'ouvre à côté).
export type DirectoryRow = {
  id: string; name: string; firstName: string | null; lastName: string; email: string | null; phone: string | null; role: string | null;
  organisationId: string | null; organisation: string | null; city: string | null; postcode: string | null; tags: string[];
  brevoStatus: string | null; leftAt: boolean; lists: number;
};

export function DirectoryTable({ rows, myLists, organisations, isAdmin, brevoConfigured, initialQ, initialTag }: { rows: DirectoryRow[]; myLists: { id: string; name: string }[]; organisations: { id: string; name: string }[]; isAdmin: boolean; brevoConfigured: boolean; initialQ?: string; initialTag?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run: BulkContext["run"] = (fn, after) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(r); router.refresh(); });
  const columns = useMemo<Column<DirectoryRow>[]>(() => [
    { key: "name", label: "Contact", get: (r) => `${r.lastName} ${r.firstName ?? ""}`.trim(), className: "px-4" },
    { key: "organisation", label: "Structure", get: (r) => r.organisation },
    { key: "email", label: "E-mail", get: (r) => r.email },
    { key: "city", label: "Ville", get: (r) => r.city },
    { key: "tags", label: "Mots-clés", get: (r) => r.tags.join(", ") },
    { key: "brevo", label: "Brevo", get: (r) => brevoLabel(r.brevoStatus), filter: { options: BREVO_FILTER_OPTIONS } },
    { key: "left", label: "Parti·e", get: (r) => r.leftAt, filter: "bool" },
    { key: "lists", label: "Listes", get: (r) => r.lists, filter: false, className: "text-right" },
  ], []);
  const idOf = useCallback((r: DirectoryRow) => r.id, []);
  const quick = useCallback((r: DirectoryRow) => `${r.name} ${r.email ?? ""} ${r.organisation ?? ""} ${r.city ?? ""} ${r.tags.join(" ")}`, []);
  // ?q= et ?tag= dans l'adresse (liens depuis une fiche) préremplissent les filtres.
  const t = useContactsTable(rows, columns, idOf, quick, { q: initialQ, filters: initialTag ? { tags: initialTag } : {} });
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const ctx: BulkContext = { listId: null, myLists, organisations, isAdmin, brevoConfigured, hasBrevo: (ids) => ids.filter((id) => byId.get(id)?.brevoStatus).length, run, pending };
  const selectedIds = [...t.selected].filter((id) => byId.has(id));
  return (
    <div className="rounded-md border bg-card" data-testid="directory">
      <div className="px-4 pb-2 pt-3"><h2 className="text-[19px] font-bold">Tous les contacts</h2><p className="text-[11px] text-muted-foreground" data-testid="directory-count">{t.hasFilters ? `${t.view.length} sur ${rows.length}` : `${rows.length} contact${rows.length > 1 ? "s" : ""}`}</p></div>
      <div className="flex flex-wrap items-center gap-2 border-y px-4 py-2">
        <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={t.q} onChange={(e) => t.setQ(e.target.value)} placeholder="Nom, e-mail, structure, ville, mot-clé…" className="h-8 w-72 pl-8 text-xs" aria-label="Rechercher un contact" data-testid="contacts-search" /></div>
        {t.hasFilters && <Button variant="ghost" size="xs" onClick={t.resetFilters} data-testid="contacts-reset-filters">Effacer les filtres</Button>}
      </div>
      <BulkBar ids={selectedIds} total={t.view.length} allSelected={t.allInViewSelected} onSelectAll={t.toggleAll} onClear={t.clear} ctx={ctx} />
      {rows.length === 0 ? <div className="p-4"><EmptyState title="Aucun contact" hint="Ajoutez-en un, ou importez un fichier dans une liste." icon={<Users className="size-5" />} /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" data-testid="contacts-table">
            <thead className="text-left text-[10px] font-semibold text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-1.5"><input type="checkbox" checked={t.allInViewSelected} onChange={t.toggleAll} aria-label="Sélectionner toutes les lignes affichées" className="size-4 rounded border-border accent-primary" data-testid="select-all" /></th>
                {columns.map((c) => <SortTh key={c.key} col={c} sort={t.sort} setSort={t.setSort} className={c.className} />)}
              </tr>
              <tr className="border-t bg-muted/30">
                <th />
                {columns.map((c) => <FilterCell key={c.key} col={c} value={t.filters[c.key] ?? ""} onChange={(v) => t.setFilter(c.key, v)} rows={rows} />)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {t.view.length === 0 && <tr><td colSpan={columns.length + 1} className="px-4 py-6 text-sm text-muted-foreground">Rien ne correspond à ces filtres.</td></tr>}
              {t.view.map((c) => (
                <tr key={c.id} className={cn(c.leftAt && "opacity-60", t.selected.has(c.id) && "bg-info-soft/60")} data-testid={`contact-row-${c.id}`} aria-selected={t.selected.has(c.id) || undefined}>
                  <td className="px-3 py-2"><input type="checkbox" checked={t.selected.has(c.id)} onChange={() => t.toggle(c.id)} aria-label={`Sélectionner ${c.name}`} className="size-4 rounded border-border accent-primary" data-testid={`select-${c.id}`} /></td>
                  <td className="px-4 py-2"><Link href={`/contacts?contact=${c.id}`} scroll={false} className="font-medium text-primary underline-offset-2 hover:underline" data-testid={`contact-open-${c.id}`}>{c.name}</Link>{c.role && <div className="text-[11px] text-muted-foreground">{c.role}</div>}</td>
                  <td className="px-2 py-2 text-xs">{c.organisationId ? <Link href={`/organisations?organisation=${c.organisationId}`} className="hover:underline">{c.organisation}</Link> : c.organisation ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{c.email && <a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a>}{c.phone && <div>{c.phone}</div>}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{[c.postcode, c.city].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-2 py-2"><div className="flex flex-wrap gap-1">{c.tags.map((tag) => <button key={tag} type="button" onClick={() => t.setFilter("tags", tag)} className="rounded-sm bg-muted px-1.5 text-[10px] text-muted-foreground hover:bg-secondary" title={`Filtrer sur « ${tag} »`}>{tag}</button>)}</div></td>
                  <td className="px-2 py-2 text-xs text-muted-foreground" title={c.brevoStatus ? BREVO_STATUS[c.brevoStatus]?.hint : undefined}>{c.brevoStatus ? brevoLabel(c.brevoStatus) : "—"}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{c.leftAt ? "oui" : ""}</td>
                  <td className="px-2 py-2 text-right text-xs text-muted-foreground">{c.lists || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
