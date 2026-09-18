import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { UrlPanel } from "@/components/common/url-panel";
import { AutoField } from "@/components/inline/auto-field";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";
import { canManageEquipment } from "@/lib/rights";
import { fmtDate, fmtEuro } from "@/lib/format";
import { loadEditionOpts } from "@/lib/tasks";
import { borrowerName, equipmentCategories, EQUIPMENT_STATES, isLate, loadEquipment, loadEquipmentOne, loadOpenLoans, stateOf } from "@/lib/equipment";
import { cn } from "@/lib/utils";
import { DeleteLoanButton, EquipmentToolbar, FilesBlock, LoanDialog, NewEquipmentDialog, RetireButton, ReturnButton } from "./controls";
import { attachmentInclude } from "@/lib/attachments";

// Matériel et prêts (module « materiel », 18/09) : l'inventaire (disponible = quantité − sorti), le registre des prêts en
// cours avec les retours en retard, la fiche d'un matériel en panneau (?materiel=) avec son historique.
export default async function MaterielPage({ searchParams }: { searchParams: Promise<{ q?: string; categorie?: string; dispo?: string; materiel?: string }> }) {
  const sp = await searchParams;
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  if (!instanceHas(settings, "materiel")) notFound();
  const rw = canManageEquipment(me);
  const [items, loans, categories, people, organisations, editions] = await Promise.all([
    loadEquipment({ q: sp.q, category: sp.categorie, onlyAvailable: sp.dispo === "1", includeRetired: rw }),
    loadOpenLoans(), equipmentCategories(),
    prisma.person.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.organisation.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    loadEditionOpts(me, settings),
  ]);
  const open = sp.materiel ? await loadEquipmentOne(sp.materiel) : null;
  const openFiles = open ? await prisma.attachment.findMany({ where: { equipmentId: open.id }, include: attachmentInclude, orderBy: { createdAt: "desc" } }) : [];
  const late = loans.filter((l) => isLate(l));
  const closeHref = "/materiel";
  const openOut = open ? open.loans.filter((l) => !l.returnedAt).reduce((n, l) => n + l.quantity, 0) : 0;
  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Package className="size-5 text-primary" aria-hidden />Inventaire</span>}
        subtitle={<>{items.filter((i) => i.state !== "retired").length} matériel{items.length > 1 ? "s" : ""} · <Link href="/materiel/prets" className="text-primary hover:underline">{loans.length} prêt{loans.length > 1 ? "s" : ""} en cours</Link>{late.length ? <span className="text-danger"> · {late.length} retour{late.length > 1 ? "s" : ""} en retard</span> : ""}</>}
        actions={rw ? <NewEquipmentDialog categories={categories} /> : undefined}
      />
      {(
        <div className="rounded-md border bg-card">
          <EquipmentToolbar q={sp.q ?? ""} category={sp.categorie ?? ""} categories={categories} available={sp.dispo === "1"} />
          {items.length === 0 ? <div className="p-4"><EmptyState title="Aucun matériel" hint={sp.q || sp.categorie || sp.dispo ? "Rien ne correspond." : rw ? "Ajoutez le matériel prêtable : vidéoprojecteur, kakemonos, enceinte…" : "L'inventaire se tient par la direction, la RAF ou l'assistant·e."} icon={<Package className="size-5" />} /></div> : (
            <table className="w-full text-[13px]" data-testid="equipment-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="px-4 py-1.5">Matériel</th><th className="px-2 py-1.5">Catégorie</th><th className="px-2 py-1.5">Rangement</th><th className="px-2 py-1.5">État</th><th className="px-2 py-1.5 text-right">Disponible</th><th className="px-2 py-1.5">Sorti chez</th><th className="px-2 py-1.5"></th></tr></thead>
              <tbody className="divide-y">
                {items.map((e) => (
                  <tr key={e.id} className={cn("align-top", e.state === "retired" && "opacity-50")} data-testid={`equipment-${e.id}`} data-name={e.name} data-available={e.available}>
                    <td className="px-4 py-1.5"><Link href={`/materiel?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.categorie ? { categorie: sp.categorie } : {}), materiel: e.id }).toString()}`} scroll={false} className="font-medium text-primary hover:underline" data-testid={`equipment-open-${e.id}`}>{e.name}</Link>{e.reference && <span className="ml-1 text-[10px] text-muted-foreground">{e.reference}</span>}</td>
                    <td className="px-2 py-1.5 text-xs">{e.category ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1.5 text-xs">{e.location ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1.5"><StatusBadge label={stateOf(e.state).label} color={stateOf(e.state).color} /></td>
                    <td className={cn("px-2 py-1.5 text-right tabular", e.available === 0 && "text-danger")}>{e.available} / {e.quantity}</td>
                    <td className="px-2 py-1.5 text-xs">{e.loans.length === 0 ? <span className="text-muted-foreground">—</span> : e.loans.map((l) => <div key={l.id} className={cn(isLate(l) && "font-semibold text-danger")}>{borrowerName(l)}{l.quantity > 1 ? ` × ${l.quantity}` : ""}{l.dueAt ? ` · retour ${fmtDate(l.dueAt)}` : ""}{isLate(l) ? " · en retard" : ""}</div>)}</td>
                    <td className="px-2 py-1.5 text-right">{e.state !== "retired" && <LoanDialog equipment={{ id: e.id, name: e.name, available: e.available }} people={people} organisations={organisations} editions={editions} compact />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {open && (
        <UrlPanel title={open.name} description={[open.category, open.reference, open.location].filter(Boolean).join(" · ") || "Matériel"} closeHref={closeHref} testId="equipment-panel">
          <div className="grid gap-5" data-testid="equipment-panel-body">
            <section className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={stateOf(open.state).label} color={stateOf(open.state).color} />
                <span className="text-xs">{Math.max(0, open.quantity - openOut)} disponible{open.quantity - openOut > 1 ? "s" : ""} sur {open.quantity}</span>
                {open.state !== "retired" && <LoanDialog equipment={{ id: open.id, name: open.name, available: Math.max(0, open.quantity - openOut) }} people={people} organisations={organisations} editions={editions} />}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([["name", "Nom", "text"], ["category", "Catégorie", "text"], ["reference", "Référence", "text"], ["location", "Rangement", "text"], ["quantity", "Quantité", "number"], ["purchasedAt", "Acheté le", "date"], ["value", "Valeur d'achat (€)", "number"]] as const).map(([field, label, type]) => (
                  <label key={field} className="grid gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><AutoField model="equipment" id={open.id} field={field} type={type} value={(open as unknown as Record<string, string | number | Date | null>)[field]} readOnly={!rw} label={label} testId={`equipment-${field}`} /></label>
                ))}
                <label className="grid gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">État</span><AutoField model="equipment" id={open.id} field="state" type="select" value={open.state} options={EQUIPMENT_STATES.map((s) => ({ value: s.value, label: s.label }))} allowEmpty={false} readOnly={!rw} label="État" testId="equipment-state" /></label>
              </div>
              <label className="grid gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</span><AutoField model="equipment" id={open.id} field="notes" type="textarea" value={open.notes} readOnly={!rw} label="Notes" placeholder={rw ? "accessoires fournis, consignes, à qui demander…" : ""} /></label>
              {open.value != null && <p className="text-[11px] text-muted-foreground">Valeur d&apos;achat {fmtEuro(open.value)}{open.purchasedAt ? ` · acheté le ${fmtDate(open.purchasedAt)}` : ""}</p>}
            </section>
            <section className="grid gap-1 text-xs" data-testid="equipment-loans">
              <h3 className="text-xs font-semibold">Prêts <span className="text-[10px] font-normal text-muted-foreground">· les 30 derniers</span></h3>
              {open.loans.length === 0 && <p className="text-muted-foreground">Jamais prêté.</p>}
              <ul className="divide-y">
                {open.loans.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-1" data-testid={`equipment-loan-${l.id}`} data-returned={l.returnedAt ? "1" : "0"}>
                    <span><Link href={`/materiel/pret/${l.id}`} className="font-mono text-[10px] text-muted-foreground hover:text-primary">P-{String(l.number).padStart(4, "0")}</Link> <b className="font-medium">{borrowerName(l)}</b>{l.quantity > 1 ? ` × ${l.quantity}` : ""}{l.edition ? <span className="text-muted-foreground"> · {l.edition.project.name} {l.edition.year}</span> : ""}<span className="block text-[11px] text-muted-foreground">sorti le {fmtDate(l.outAt)}{l.returnedAt ? ` · rendu le ${fmtDate(l.returnedAt)}${l.returnNote ? ` (${l.returnNote})` : ""}` : l.dueAt ? ` · retour attendu le ${fmtDate(l.dueAt)}${isLate(l) ? " · en retard" : ""}` : " · en cours"}{l.notes ? ` · ${l.notes}` : ""}</span></span>
                    <span className="flex items-center gap-2">{!l.returnedAt && <ReturnButton loanId={l.id} label={open.name} />}<DeleteLoanButton loanId={l.id} /></span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="grid gap-1 text-xs" data-testid="equipment-files">
              <h3 className="text-xs font-semibold">Pièces <span className="text-[10px] font-normal text-muted-foreground">· facture d&apos;achat, devis, notice</span></h3>
              <FilesBlock files={openFiles} target={{ equipmentId: open.id }} canEdit={rw} />
            </section>
            {rw && <RetireButton id={open.id} retired={open.state === "retired"} />}
          </div>
        </UrlPanel>
      )}
    </div>
  );
}
