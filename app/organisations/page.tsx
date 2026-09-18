import Link from "next/link";
import { DossiersHeader } from "@/components/common/dossiers-nav";
import { EmptyState } from "@/components/common/empty-state";
import { UrlPanel } from "@/components/common/url-panel";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin, canEditFunding } from "@/lib/rights";
import { kindLabel, kindsOf, ORGANISATION_KINDS, type OrganisationKind } from "@/lib/organisations";
import { cn } from "@/lib/utils";
import { CreateOrganisationForm, KindFilter } from "./controls";
import { OrganisationPanelBody } from "./panel";

// Annuaire des organisations (lot E2) : financeurs, fournisseurs, partenaires, réseaux, collectivités — un seul endroit, des
// genres cumulables. La fiche s'ouvre en panneau (?organisation=) ; « Financeurs » reste l'écran métier des financeurs.
export default async function OrganisationsPage({ searchParams }: { searchParams: Promise<{ genre?: string; q?: string; organisation?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentPerson();
  const rw = canEditFunding(me) || canAdmin(me);
  const kind = ORGANISATION_KINDS.some((k) => k.key === sp.genre) ? (sp.genre as OrganisationKind) : null;
  const q = (sp.q ?? "").trim();
  const all = await prisma.organisation.findMany({
    include: { contacts: { where: { leftAt: null } }, _count: { select: { lines: true, conventions: true, validations: true, editions: true, calls: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const rows = all.filter((o) => (!kind || kindsOf(o).includes(kind)) && (!q || norm(o.name).includes(norm(q))));
  const counts = Object.fromEntries(ORGANISATION_KINDS.map((k) => [k.key, all.filter((o) => kindsOf(o).includes(k.key)).length]));
  const open = sp.organisation ? all.find((o) => o.id === sp.organisation) ?? null : null;
  const closeHref = `/organisations${kind || q ? `?${new URLSearchParams({ ...(kind ? { genre: kind } : {}), ...(q ? { q } : {}) }).toString()}` : ""}`;
  return (
    <div className="p-4 md:p-6">
      <DossiersHeader current="organisations" summary={`${rows.length} organisation${rows.length > 1 ? "s" : ""}${kind || q ? ` sur ${all.length}` : ""}`} tools={<KindFilter current={kind} q={q} counts={counts} />} actions={rw ? <CreateOrganisationForm /> : undefined} />
      {rows.length === 0 ? <EmptyState title="Aucune organisation" hint={q ? "Rien ne correspond à cette recherche." : "Ajoutez-en une, ou changez de genre."} /> : (
        <div className="overflow-auto rounded-md border bg-card">
          <table className="w-full text-[13px]" data-testid="organisations-table">
            <thead className="sticky top-0 z-[2] bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
              <tr><th className="px-3 py-2">Organisation</th><th className="px-3 py-2">Genres</th><th className="px-3 py-2">Contact principal</th><th className="px-3 py-2 text-right">Dossiers</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((o) => {
                const main = o.contacts.find((c) => c.primary) ?? o.contacts[0] ?? null;
                const dossiers = o._count.lines + o._count.conventions + o._count.validations + o._count.editions + o._count.calls;
                return (
                  <tr key={o.id} className={cn(!o.active && "opacity-50")} data-testid={`organisation-row-${o.name}`}>
                    <td className="px-3 py-2"><Link href={`/organisations?${new URLSearchParams({ ...(kind ? { genre: kind } : {}), ...(q ? { q } : {}), organisation: o.id }).toString()}`} scroll={false} className="font-medium text-primary underline-offset-2 hover:underline" data-testid={`organisation-open-${o.id}`}>{o.name}</Link>{!o.active && <span className="ml-1 rounded-sm bg-muted px-1 text-[10px]">inactive</span>}{o.website && <div className="text-[11px] text-muted-foreground">{o.website.replace(/^https?:\/\//, "")}</div>}</td>
                    <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{kindsOf(o).map((k) => <span key={k} className={cn("rounded-sm px-1.5 text-[10px] font-semibold", k === "funder" ? "bg-info-soft text-primary" : k === "supplier" ? "bg-sand text-[#574f3f]" : "bg-muted text-muted-foreground")}>{kindLabel(k)}</span>)}</div></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{main ? <>{[main.firstName, main.lastName].filter(Boolean).join(" ")}{main.role ? ` · ${main.role}` : ""}</> : "—"}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{dossiers || "—"}{kindsOf(o).includes("funder") && <> · <Link href={`/financeurs/${o.id}`} className="text-primary hover:underline" data-testid={`funder-page-${o.name}`}>fiche financeur</Link></>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <UrlPanel title={open.name} description={kindsOf(open).map(kindLabel).join(" · ")} closeHref={closeHref} testId="organisation-panel" wide>
          <OrganisationPanelBody id={open.id} rw={rw} />
        </UrlPanel>
      )}
    </div>
  );
}
