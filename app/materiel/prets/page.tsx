import Link from "next/link";
import { notFound } from "next/navigation";
import { HandHelping } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";
import { fmtDate } from "@/lib/format";
import { loadEditionOpts } from "@/lib/tasks";
import { borrowerName, isLate, loadEquipment, loadOpenLoans } from "@/lib/equipment";
import { cn } from "@/lib/utils";
import { LoanDialog, ReturnButton } from "../controls";

// Prêts (retour de Gaël, 18/09) : l'entrée principale du module — les prêts en cours (retards en tête), les prêts terminés,
// et « Nouveau prêt » qui choisit le matériel dans le dialogue. L'inventaire est à côté.
export default async function PretsPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const sp = await searchParams;
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  if (!instanceHas(settings, "materiel")) notFound();
  const done = sp.vue === "termines";
  const [open, closed, items, people, organisations, editions] = await Promise.all([
    loadOpenLoans(),
    done ? prisma.loan.findMany({ where: { returnedAt: { not: null } }, include: { equipment: { select: { id: true, name: true } }, person: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true, organisation: { select: { name: true } }, organisationName: true } }, organisation: { select: { id: true, name: true } }, edition: { select: { id: true, year: true, project: { select: { name: true } } } } }, orderBy: { returnedAt: "desc" }, take: 200 }) : Promise.resolve([]),
    loadEquipment(), prisma.person.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.organisation.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    loadEditionOpts(me, settings),
  ]);
  const late = open.filter((l) => isLate(l));
  const num = (n: number) => `P-${String(n).padStart(4, "0")}`;
  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><HandHelping className="size-5 text-primary" aria-hidden />{done ? "Prêts terminés" : "Prêts en cours"}</span>}
        subtitle={done ? <>{closed.length} prêt{closed.length > 1 ? "s" : ""} rendu{closed.length > 1 ? "s" : ""}</> : <>{open.length} prêt{open.length > 1 ? "s" : ""} en cours{late.length ? <span className="text-danger"> · {late.length} retour{late.length > 1 ? "s" : ""} en retard</span> : ""} · <Link href="/materiel" className="text-primary hover:underline">inventaire du matériel</Link></>}
        actions={<LoanDialog equipments={items.filter((e) => e.state !== "retired").map((e) => ({ id: e.id, name: e.name, available: e.available }))} people={people} organisations={organisations} editions={editions} />}
      />
      <div className="rounded-md border bg-card">
        {done ? (
          closed.length === 0 ? <div className="p-4"><EmptyState title="Aucun prêt terminé" hint="Les retours enregistrés apparaîtront ici, avec leur commentaire." icon={<HandHelping className="size-5" />} /></div> : (
            <table className="w-full text-[13px]" data-testid="closed-loans-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="px-4 py-1.5">Matériel</th><th className="px-2 py-1.5">À qui</th><th className="px-2 py-1.5">Pour</th><th className="px-2 py-1.5">Sorti le</th><th className="px-2 py-1.5">Rendu le</th><th className="px-2 py-1.5">Commentaire de retour</th></tr></thead>
              <tbody className="divide-y">
                {closed.map((l) => (
                  <tr key={l.id} className="align-top" data-testid={`closed-loan-${l.id}`}>
                    <td className="px-4 py-1.5"><Link href={`/materiel/pret/${l.id}`} className="font-medium text-primary hover:underline">{l.equipment.name}</Link>{l.quantity > 1 && <span className="text-muted-foreground"> × {l.quantity}</span>}<span className="ml-1 font-mono text-[10px] text-muted-foreground">{num(l.number)}</span></td>
                    <td className="px-2 py-1.5 text-xs">{borrowerName(l)}</td>
                    <td className="px-2 py-1.5 text-xs">{l.edition ? `${l.edition.project.name} · ${l.edition.year}` : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">{fmtDate(l.outAt)}</td>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">{l.returnedAt ? fmtDate(l.returnedAt) : "—"}{l.dueAt && l.returnedAt && l.returnedAt > l.dueAt && <span className="text-danger"> · en retard</span>}</td>
                    <td className="px-2 py-1.5 text-xs">{l.returnNote ?? <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : open.length === 0 ? <div className="p-4"><EmptyState title="Aucun prêt en cours" hint="Tout est rentré. « Nouveau prêt » pour en enregistrer un." icon={<HandHelping className="size-5" />} /></div> : (
          <table className="w-full text-[13px]" data-testid="loans-table">
            <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="px-4 py-1.5">Matériel</th><th className="px-2 py-1.5">À qui</th><th className="px-2 py-1.5">Pour</th><th className="px-2 py-1.5">Sorti le</th><th className="px-2 py-1.5">Retour attendu</th><th className="px-2 py-1.5"></th></tr></thead>
            <tbody className="divide-y">
              {open.map((l) => (
                <tr key={l.id} className={cn("align-top", isLate(l) && "bg-danger-soft/40")} data-testid={`loan-${l.id}`} data-late={isLate(l) ? "1" : "0"}>
                  <td className="px-4 py-1.5"><Link href={`/materiel/pret/${l.id}`} className="font-medium text-primary hover:underline" data-testid={`loan-fiche-link-${l.id}`}>{l.equipment.name}</Link>{l.quantity > 1 && <span className="text-muted-foreground"> × {l.quantity}</span>}<span className="ml-1 font-mono text-[10px] text-muted-foreground">{num(l.number)}</span>{l.notes && <div className="text-[11px] text-muted-foreground">{l.notes}</div>}</td>
                  <td className="px-2 py-1.5 text-xs">{borrowerName(l)}</td>
                  <td className="px-2 py-1.5 text-xs">{l.edition ? <Link href={`/edition/${l.edition.id}`} className="hover:underline">{l.edition.project.name} · {l.edition.year}</Link> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-1.5 text-xs whitespace-nowrap">{fmtDate(l.outAt)}</td>
                  <td className={cn("px-2 py-1.5 text-xs whitespace-nowrap", isLate(l) && "font-semibold text-danger")}>{l.dueAt ? fmtDate(l.dueAt) : <span className="text-muted-foreground">—</span>}{isLate(l) && " · en retard"}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap"><ReturnButton loanId={l.id} label={l.equipment.name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
