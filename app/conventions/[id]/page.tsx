import { SectionIcon } from "@/components/shell/section-icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { AutoField } from "@/components/inline/auto-field";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { allocationOf } from "@/lib/conventions";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttachEditionForm, DetachButton } from "./allocations";
import { ContactLine } from "@/components/funders/contacts";
import { PaymentsList } from "@/components/funding/payments-list";
import { paymentSummary } from "@/lib/payments";

// Page d'une convention : en-tête, quatre montants, informations (modifiables par la RAF), affectations aux éditions, obligations à venir.
export default async function ConventionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, refs, c] = await Promise.all([
    getCurrentPerson(), getRefs(),
    prisma.convention.findUnique({ where: { id }, include: { funder: { include: { contacts: true } }, contact: true, payments: { orderBy: { expectedAt: "asc" } }, lines: { include: { edition: { include: { project: { include: { pilot: true } } } }, deliverables: { orderBy: { dueDate: "asc" } }, payments: true }, orderBy: { edition: { year: "asc" } } } } }),
  ]);
  if (!c) notFound();
  const rw = canEditFunding(me.role);
  // Éditions couvertes par la période et pas encore rattachées : proposées au rattachement depuis la convention.
  const attachable = rw ? (await prisma.edition.findMany({ where: { year: { gte: c.startYear, lte: c.endYear }, status: { not: "closed" }, id: { notIn: c.lines.map((l) => l.editionId) } }, include: { project: true }, orderBy: [{ project: { name: "asc" } }, { year: "asc" }] })).map((e) => ({ id: e.id, label: `${e.project.name} · ${e.year}` })) : [];
  const a = allocationOf(c);
  const statusOpts = REF_DEFAULTS.funding_status.map((s) => ({ value: s.code, label: refLabel(refs, "funding_status", s.code) }));
  const pct = a.ceiling ? Math.round((a.granted / a.ceiling) * 100) : null;
  // Versements : les tranches de la convention, plus ceux posés directement sur une ligne rattachée (propres à une édition).
  const linePayments = c.lines.flatMap((l) => l.payments.map((p) => ({ ...p, source: { label: `${l.edition.project.name} · ${l.edition.year}`, href: `/edition/${l.editionId}?onglet=budget#recettes` } })));
  const allPayments = [...c.payments, ...linePayments];
  const pay = paymentSummary(c.amountNotified, allPayments);
  const obligations = c.lines.flatMap((l) => l.deliverables.filter((d) => !d.done).map((d) => ({ d, l }))).sort((x, y) => x.d.dueDate.getTime() - y.d.dueDate.getTime());
  const fid = (f: string) => `convention-${c.id}-${f}`;
  const card = (label: string, value: string, hint?: string, cls?: string, testId?: string) => (
    <div className={cn("rounded-md border bg-card px-3 py-4", cls)}>
      <small className="text-xs text-muted-foreground">{label}</small>
      <b className="mt-2 block text-[25px] font-semibold leading-tight tracking-[-0.7px] tabular" data-testid={testId}>{value}</b>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
  const Field = ({ label, field, type, options, suffix, placeholder, refresh, testId }: { label: string; field: string; type: "text" | "number" | "date" | "select" | "textarea"; options?: { value: string; label: string }[]; suffix?: string; placeholder?: string; refresh?: boolean; testId?: string }) => (
    <div className="grid gap-1">
      <label htmlFor={fid(field)} className="text-[10px] text-muted-foreground">{label}</label>
      <AutoField model="convention" id={c.id} field={field} type={type} value={(c as unknown as Record<string, string | number | Date | null>)[field]} readOnly={!rw} options={options} suffix={suffix} placeholder={placeholder ?? "—"} inputId={fid(field)} refreshOnSave={refresh} testId={testId} allowEmpty={type !== "select" || field === "contactId"} />
    </div>
  );

  return (
    <div className="p-4 md:p-6" data-testid={`convention-${c.reference}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/conventions" className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ArrowLeft className="size-3" />Toutes les conventions</Link>
          <div className="flex flex-wrap items-center gap-2">
            <SectionIcon />
            <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px]">{c.funder.name} · {c.reference}</h1>
            <StatusBadge label={refLabel(refs, "funding_status", c.status)} color={refColor(refs, "funding_status", c.status)} />
            {a.over && <StatusBadge label={`Affectations au-delà du notifié · ${fmtEuro(-a.remaining!)}`} color="danger" dot={false} />}
          </div>
          <p className="mt-1.5 text-xs" data-testid="convention-contact"><ContactLine c={c.contact ?? c.funder.contacts.find((x) => x.primary) ?? null} label={c.contact ? "Contact du dossier" : "Contact"} /> · <Link href={`/financeurs/${c.funderId}`} className="text-primary hover:underline">fiche {c.funder.name}</Link></p>
          <p className="mt-1.5 text-xs text-muted-foreground">{c.scheme ? `${c.scheme} · ` : ""}{c.startYear === c.endYear ? `Année ${c.startYear}` : `${c.startYear} → ${c.endYear}`} · {c.lines.length} édition{c.lines.length > 1 ? "s" : ""} rattachée{c.lines.length > 1 ? "s" : ""}{rw ? "" : " · lecture seule : tenue par la RAF"}</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-5">
        {card("Demandé", c.amountRequested === null ? "—" : fmtEuro(c.amountRequested), "au dépôt du dossier")}
        {card("Notifié", c.amountNotified === null ? "—" : fmtEuro(c.amountNotified), "plafond des affectations", undefined, `notified-value-${c.reference}`)}
        {card("Affecté aux éditions", fmtEuro(a.granted), pct !== null ? `${pct} % du notifié · montants obtenus des lignes` : "somme des montants obtenus", a.over ? "border-danger bg-danger-soft/50" : undefined, `allocated-${c.reference}`)}
        {card("Reste à affecter", a.remaining === null ? "—" : fmtEuro(a.remaining), a.remaining === null ? "renseignez le notifié" : a.remaining < 0 ? "dépassement : réduisez une affectation ou corrigez le notifié" : "disponible pour une édition à venir", a.remaining !== null && a.remaining < 0 ? "border-danger bg-danger-soft/50" : undefined)}
        {card("Versé", fmtEuro(pay.received), pay.remaining === null ? "renseignez le notifié" : pay.late.length > 0 ? `${pay.late.length} versement${pay.late.length > 1 ? "s" : ""} en retard` : pay.remaining > 0 ? `reste à percevoir ${fmtEuro(pay.remaining)}` : "tout est perçu", pay.late.length > 0 ? "border-danger bg-danger-soft/50" : undefined, `received-${c.reference}`)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-4">
          <Section title="Affectations aux éditions" description="Une ligne de financement par édition rattachée ; le montant obtenu se saisit sur l'édition (onglet Financements). Le rattachement se fait ici ou depuis l'édition." testId="convention-lines" actions={rw ? <AttachEditionForm conventionId={c.id} editions={attachable} /> : undefined}>
            {c.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune édition rattachée{rw ? " — choisissez-en une ci-dessus, ou depuis l'onglet Financements d'une édition couverte par la période." : "."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="convention-lines-table">
                  <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                    <tr><th className="py-1.5 pr-2">Édition</th><th className="py-1.5 pr-2">Pilote</th><th className="py-1.5 pr-2">Statut</th><th className="py-1.5 pr-2 text-right">Demandé</th><th className="py-1.5 pr-2 text-right">Obtenu</th><th className="py-1.5 pr-2">Livrables</th>{rw && <th className="py-1.5" />}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {c.lines.map((l) => {
                      const open = l.deliverables.filter((d) => !d.done).length;
                      return (
                        <tr key={l.id}>
                          <td className="py-2 pr-2"><Link href={`/edition/${l.editionId}?onglet=budget#recettes`} className="font-medium text-primary hover:underline">{l.edition.project.name} · {l.edition.year}</Link></td>
                          <td className="py-2 pr-2 text-xs text-muted-foreground">{l.edition.project.pilot.name}</td>
                          <td className="py-2 pr-2"><StatusBadge label={refLabel(refs, "funding_status", l.status)} color={refColor(refs, "funding_status", l.status)} /></td>
                          <td className="py-2 pr-2 text-right tabular">{fmtEuro(l.amountRequested)}</td>
                          <td className="py-2 pr-2 text-right font-medium tabular">{fmtEuro(l.amountGranted)}</td>
                          <td className="py-2 pr-2 text-xs text-muted-foreground">{l.deliverables.length === 0 ? "—" : `${l.deliverables.length - open} remis · ${open} à remettre`}</td>
                          {rw && <td className="py-2 text-right"><DetachButton lineId={l.id} editionLabel={`${l.edition.project.name} · ${l.edition.year}`} /></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold"><td className="py-2 pr-2" colSpan={3}>Total</td><td className="py-2 pr-2 text-right tabular">{fmtEuro(a.requested)}</td><td className={cn("py-2 pr-2 text-right tabular", a.over && "text-danger")}>{fmtEuro(a.granted)}</td><td colSpan={rw ? 2 : 1} /></tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          <Section title="Versements" description="Les tranches de l'accord (avance, acomptes, solde), attendues puis reçues ; « reçu » est posé par la RAF ou la direction. Un versement propre à une édition se saisit sur sa ligne et apparaît ici avec son projet." testId="convention-payments">
            <PaymentsList payments={allPayments} reference={c.amountNotified} rw={rw} target={{ conventionId: c.id }} showSource testId="convention-payments-list" />
          </Section>

          <Section title="Informations" description={rw ? "Sauvegarde automatique à chaque champ." : "Renseignées par la RAF."}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Référence" field="reference" type="text" refresh />
              <Field label="Dispositif" field="scheme" type="text" placeholder="Convention, appel à projets…" />
              <Field label="Statut" field="status" type="select" options={statusOpts} />
              <Field label="Début (année)" field="startYear" type="number" refresh />
              <Field label="Fin (année)" field="endYear" type="number" refresh />
              <Field label="Montant demandé" field="amountRequested" type="number" suffix="€" />
              <Field label="Montant notifié" field="amountNotified" type="number" suffix="€" refresh testId={`notified-${c.reference}`} />
              <Field label="Date de dépôt" field="submittedAt" type="date" />
              <Field label="Date de notification" field="notifiedAt" type="date" />
              <Field label="Date de signature" field="signedAt" type="date" />
              <Field label="Contact du dossier" field="contactId" type="select" options={c.funder.contacts.map((x) => ({ value: x.id, label: `${[x.firstName, x.lastName].filter(Boolean).join(" ")}${x.role ? ` · ${x.role}` : ""}` }))} placeholder="— contact principal —" refresh />
            </div>
            <div className="mt-3"><Field label="Notes" field="notes" type="textarea" placeholder="Conditions, avenants, clés de répartition (référence à l'Excel RAF)…" /></div>
          </Section>
        </div>

        <Section title="Obligations à venir" description="Livrables non remis des éditions rattachées, les plus proches d'abord." testId="convention-obligations">
          {obligations.length === 0 ? <p className="text-sm text-muted-foreground">Aucun livrable en attente.</p> : (
            <ul className="divide-y text-sm">
              {obligations.map(({ d, l }) => {
                const n = daysFromNow(d.dueDate);
                return (
                  <li key={d.id} className="py-2">
                    <div className="font-medium">{d.label}</div>
                    <div className="text-xs text-muted-foreground"><Link href={`/edition/${l.editionId}?onglet=budget#recettes`} className="hover:underline">{l.edition.project.name} · {l.edition.year}</Link> · {fmtDate(d.dueDate)} · <span className={cn(n < 0 ? "font-semibold text-danger" : n <= 30 ? "text-warning-foreground" : "")}>{n < 0 ? `${-n} j de retard` : n === 0 ? "aujourd'hui" : `dans ${n} j`}</span></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
