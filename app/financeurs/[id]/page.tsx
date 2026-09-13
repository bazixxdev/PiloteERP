import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { AutoField } from "@/components/inline/auto-field";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";
import { refColor, refLabel } from "@/lib/refs";
import { allocationOf } from "@/lib/conventions";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FunderContacts } from "@/components/funders/contacts";

// Page d'un financeur : « tout ce qu'on a avec la Région » — contacts, conventions, éditions financées, obligations à venir.
export default async function FinanceurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const year = new Date().getFullYear();
  const [me, refs, f] = await Promise.all([
    getCurrentPerson(), getRefs(),
    prisma.funder.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { createdAt: "asc" } },
        conventions: { include: { lines: true, contact: true }, orderBy: [{ endYear: "desc" }, { reference: "asc" }] },
        lines: { where: { edition: { status: { not: "closed" } } }, include: { edition: { include: { project: { include: { pilot: true } } } }, convention: true, contact: true, deliverables: { orderBy: { dueDate: "asc" } } }, orderBy: [{ edition: { year: "desc" } }] },
      },
    }),
  ]);
  if (!f) notFound();
  const rw = canEditFunding(me.role);
  const main = f.contacts.find((c) => c.primary) ?? null;
  const active = f.conventions.filter((c) => c.startYear <= year && year <= c.endYear);
  const granted = f.lines.filter((l) => l.edition.year === year).reduce((s, l) => s + (l.amountGranted ?? 0), 0);
  const obligations = f.lines.flatMap((l) => l.deliverables.filter((d) => !d.done).map((d) => ({ d, l }))).sort((x, y) => x.d.dueDate.getTime() - y.d.dueDate.getTime());
  const card = (label: string, value: string, hint?: string) => (
    <div className="rounded-md border bg-card px-3 py-4"><small className="text-xs text-muted-foreground">{label}</small><b className="mt-2 block text-[25px] font-semibold leading-tight tracking-[-0.7px] tabular">{value}</b>{hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}</div>
  );

  return (
    <div className="p-4 md:p-6" data-testid={`funder-page-${f.name}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/financeurs" className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ArrowLeft className="size-3" />Tous les financeurs</Link>
          <div className="flex flex-wrap items-center gap-2">
            {rw ? <AutoField model="funder" id={f.id} field="name" type="text" value={f.name} inputClassName="text-[25px] font-bold leading-tight tracking-[-0.7px]" className="min-w-[280px]" label="Nom du financeur" /> : <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px]">{f.name}</h1>}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{f.contacts.length} contact{f.contacts.length > 1 ? "s" : ""} · {active.length} convention{active.length > 1 ? "s" : ""} active{active.length > 1 ? "s" : ""} · {f.lines.length} ligne{f.lines.length > 1 ? "s" : ""} de financement{rw ? "" : " · lecture seule : tenu par la RAF"}</p>
        </div>
        <Button asChild variant="outline"><Link href="/financeurs">Retour à la liste</Link></Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {card("Contact principal", main ? [main.firstName, main.lastName].filter(Boolean).join(" ") : "—", main ? [main.role, main.email].filter(Boolean).join(" · ") : "désignez-le avec l'étoile")}
        {card("Notifié · conventions actives", fmtEuro(active.reduce((s, c) => s + (c.amountNotified ?? 0), 0)), `${active.length} convention${active.length > 1 ? "s" : ""} couvrant ${year}`)}
        {card(`Obtenu sur les éditions ${year}`, fmtEuro(granted), "montants obtenus des lignes de financement")}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-4">
          <Section title="Contacts" description={rw ? "Prénom, nom, fonction, email, téléphone ; l'étoile désigne le contact principal, utilisé par défaut sur les lignes et conventions. Modifiable en place." : "Interlocuteurs de ce financeur ; l'étoile marque le contact principal."} testId="funder-contacts-section">
            <FunderContacts funderId={f.id} contacts={f.contacts} readOnly={!rw} />
          </Section>

          <Section title="Conventions" description="Une convention existe une fois, même sur plusieurs années.">
            {f.conventions.length === 0 ? <p className="text-sm text-muted-foreground">Aucune convention. <Link href="/conventions" className="text-primary hover:underline">Créer une convention</Link>.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="py-1.5 pr-2">Référence</th><th className="py-1.5 pr-2">Période</th><th className="py-1.5 pr-2">Statut</th><th className="py-1.5 pr-2 text-right">Notifié</th><th className="py-1.5 pr-2 text-right">Affecté</th><th className="py-1.5">Contact du dossier</th></tr></thead>
                <tbody className="divide-y">
                  {f.conventions.map((c) => { const a = allocationOf(c); return (
                    <tr key={c.id} className={cn(!(c.startYear <= year && year <= c.endYear) && "text-muted-foreground")}>
                      <td className="py-2 pr-2"><Link href={`/conventions/${c.id}`} className="font-medium text-primary hover:underline">{c.reference}</Link>{c.scheme && <small className="block text-[10px] text-muted-foreground">{c.scheme}</small>}</td>
                      <td className="py-2 pr-2 whitespace-nowrap tabular">{c.startYear === c.endYear ? c.startYear : `${c.startYear} → ${c.endYear}`}</td>
                      <td className="py-2 pr-2"><StatusBadge label={refLabel(refs, "funding_status", c.status)} color={refColor(refs, "funding_status", c.status)} /></td>
                      <td className="py-2 pr-2 text-right tabular">{fmtEuro(c.amountNotified)}</td>
                      <td className={cn("py-2 pr-2 text-right tabular", a.over && "font-semibold text-danger")}>{fmtEuro(a.granted)}</td>
                      <td className="py-2 text-xs text-muted-foreground">{c.contact ? [c.contact.firstName, c.contact.lastName].filter(Boolean).join(" ") : main ? `${[main.firstName, main.lastName].filter(Boolean).join(" ")} (principal)` : "—"}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Éditions financées" description="Lignes de financement des éditions non clôturées.">
            {f.lines.length === 0 ? <p className="text-sm text-muted-foreground">Aucune ligne de financement.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="py-1.5 pr-2">Édition</th><th className="py-1.5 pr-2">Pilote</th><th className="py-1.5 pr-2">Statut</th><th className="py-1.5 pr-2 text-right">Demandé</th><th className="py-1.5 pr-2 text-right">Obtenu</th><th className="py-1.5">Convention</th></tr></thead>
                <tbody className="divide-y">
                  {f.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2 pr-2"><Link href={`/edition/${l.editionId}?onglet=financements`} className="font-medium text-primary hover:underline">{l.edition.project.name} · {l.edition.year}</Link></td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{l.edition.project.pilot.name}</td>
                      <td className="py-2 pr-2"><StatusBadge label={refLabel(refs, "funding_status", l.status)} color={refColor(refs, "funding_status", l.status)} /></td>
                      <td className="py-2 pr-2 text-right tabular">{fmtEuro(l.amountRequested)}</td>
                      <td className="py-2 pr-2 text-right tabular">{fmtEuro(l.amountGranted)}</td>
                      <td className="py-2 text-xs text-muted-foreground">{l.convention ? <Link href={`/conventions/${l.convention.id}`} className="text-primary hover:underline">{l.convention.reference}</Link> : "annuelle"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        <div className="grid content-start gap-4">
          <Section title="Notes" description="Périmètre, habitudes, calendrier des appels à projets…">
            <AutoField model="funder" id={f.id} field="notes" type="textarea" value={f.notes} readOnly={!rw} placeholder={rw ? "À compléter…" : "Aucune note"} rows={4} label="Notes sur le financeur" />
          </Section>
          <Section title="Obligations à venir" description="Livrables non remis dus à ce financeur, les plus proches d'abord." testId="funder-obligations">
            {obligations.length === 0 ? <p className="text-sm text-muted-foreground">Aucun livrable en attente.</p> : (
              <ul className="divide-y text-sm">
                {obligations.slice(0, 12).map(({ d, l }) => { const n = daysFromNow(d.dueDate); return (
                  <li key={d.id} className="py-2"><div className="font-medium">{d.label}</div><div className="text-xs text-muted-foreground"><Link href={`/edition/${l.editionId}?onglet=financements`} className="hover:underline">{l.edition.project.name} · {l.edition.year}</Link> · {fmtDate(d.dueDate)} · <span className={cn(n < 0 ? "font-semibold text-danger" : n <= 30 ? "text-warning-foreground" : "")}>{n < 0 ? `${-n} j de retard` : n === 0 ? "aujourd'hui" : `dans ${n} j`}</span></div></li>
                ); })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
