import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ContactLine } from "@/components/funders/contacts";
import { AddFunderForm } from "./add-form";

// Financeurs : la liste (contact principal, conventions actives, notifié, éditions financées, prochaine obligation) ; une page par financeur.
export default async function FinanceursPage() {
  const year = new Date().getFullYear();
  const [me, funders] = await Promise.all([
    getCurrentPerson(),
    prisma.funder.findMany({
      include: {
        contacts: true,
        conventions: { include: { lines: true } },
        lines: { where: { edition: { status: { in: ["in_progress", "validated"] } } }, include: { edition: { include: { project: true } }, deliverables: { where: { done: false }, orderBy: { dueDate: "asc" } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const rw = canEditFunding(me.role);
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Financeurs" subtitle={`${funders.length} financeurs · leurs interlocuteurs, leurs conventions et les éditions qu'ils financent. Les contacts sont tenus par la RAF : le minimum utile, pas de synchronisation avec Outlook.`} actions={rw ? <AddFunderForm /> : undefined} />
      {funders.length === 0 ? <EmptyState title="Aucun financeur" hint="Ajoutez-en un ; ils servent ensuite aux lignes de financement et aux conventions." /> : (
        <div className="overflow-auto rounded-md border bg-card" tabIndex={0} aria-label={`Tableau des ${funders.length} financeurs`}>
          <table className="w-full text-[13px]" style={{ minWidth: 820 }} data-testid="funders-table">
            <thead className="sticky top-0 z-[2] bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
              <tr><th className="px-3 py-2.5">Financeur</th><th className="px-3 py-2.5">Contact principal</th><th className="px-3 py-2.5">Conventions</th><th className="px-3 py-2.5 text-right">Notifié · actif</th><th className="px-3 py-2.5">Éditions financées</th><th className="px-3 py-2.5">Prochaine obligation</th></tr>
            </thead>
            <tbody>
              {funders.map((f) => {
                const main = f.contacts.find((c) => c.primary) ?? f.contacts[0] ?? null;
                const active = f.conventions.filter((c) => c.startYear <= year && year <= c.endYear);
                const notified = active.reduce((s, c) => s + (c.amountNotified ?? 0), 0);
                const editions = [...new Map(f.lines.map((l) => [l.editionId, l.edition])).values()];
                const next = f.lines.flatMap((l) => l.deliverables.map((d) => ({ d, l }))).sort((a, b) => a.d.dueDate.getTime() - b.d.dueDate.getTime())[0];
                const n = next ? daysFromNow(next.d.dueDate) : null;
                return (
                  <tr key={f.id} className="border-t border-[#e3e9eb] align-top hover:bg-[#f8f9f3]" data-testid={`funder-${f.name}`}>
                    <td className="min-w-[160px] px-3 py-3"><Link href={`/financeurs/${f.id}`} className="font-semibold text-primary hover:underline">{f.name}</Link>{f.contacts.length > 1 && <small className="mt-1 block text-[10px] text-muted-foreground">{f.contacts.length} contacts</small>}</td>
                    <td className="min-w-[220px] px-3 py-3"><ContactLine c={main} /></td>
                    <td className="px-3 py-3 whitespace-nowrap">{f.conventions.length === 0 ? <span className="text-muted-foreground">—</span> : <>{active.length} active{active.length > 1 ? "s" : ""}<small className="block text-[10px] text-muted-foreground">{f.conventions.length} au total</small></>}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular">{notified ? fmtEuro(notified) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="min-w-[200px] px-3 py-3">{editions.length === 0 ? <span className="text-muted-foreground">—</span> : <div className="flex flex-wrap gap-1">{editions.slice(0, 3).map((e) => <Link key={e.id} href={`/edition/${e.id}?onglet=financements`} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-primary hover:underline">{e.project.name} · {e.year}</Link>)}{editions.length > 3 && <Link href={`/financeurs/${f.id}`} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:underline">+{editions.length - 3} autres</Link>}</div>}</td>
                    <td className="min-w-[150px] px-3 py-3">{next ? <><span className="block max-w-[160px] truncate" title={next.d.label}>{next.d.label}</span><small className={cn("mt-1 block text-[10px]", n !== null && n < 0 ? "font-semibold text-danger" : "text-muted-foreground")}>{fmtDate(next.d.dueDate)} · {next.l.edition.project.name}{n !== null && n < 0 ? ` · ${-n} j de retard` : ""}</small></> : <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
