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
import { AMOUNT_KINDS, amounts, durationOf, isWon } from "@/lib/dossiers";
import { attachmentInclude } from "@/lib/attachments";
import { HelpersPicker, DossierWorkspace, LifecycleButtons, Stepper } from "./lifecycle";
import { V, cap, le, un, aucun, pl } from "@/lib/vocab";

// Page d'une convention : en-tête, quatre montants, informations (modifiables par la RAF), affectations aux éditions, obligations à venir.
export default async function ConventionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, refs, c] = await Promise.all([
    getCurrentPerson(), getRefs(),
    prisma.convention.findUnique({ where: { id }, include: { funder: { include: { contacts: true } }, contact: true, owner: { select: { id: true, name: true } }, helperPeople: { include: { person: { select: { id: true, name: true } } } }, targetProject: { select: { id: true, name: true } }, attachments: { include: attachmentInclude, orderBy: { createdAt: "desc" } }, tasks: { include: { person: { select: { name: true } } }, orderBy: [{ done: "asc" }, { createdAt: "asc" }] }, notesLinked: { include: { author: { select: { name: true } } }, orderBy: { date: "desc" } }, payments: { orderBy: { expectedAt: "asc" } }, lines: { include: { edition: { include: { project: { include: { pilot: true } } } }, deliverables: { orderBy: { dueDate: "asc" } }, payments: true }, orderBy: { edition: { year: "asc" } } } } }),
  ]);
  if (!c) notFound();
  const rw = canEditFunding(me);
  // Éditions couvertes par la période et pas encore rattachées : proposées au rattachement depuis la convention.
  const attachable = rw ? (await prisma.edition.findMany({ where: { year: { gte: c.startYear, lte: c.endYear }, status: { not: "closed" }, id: { notIn: c.lines.map((l) => l.editionId) } }, include: { project: true }, orderBy: [{ project: { name: "asc" } }, { year: "asc" }] })).map((e) => ({ id: e.id, label: `${e.project.name} · ${e.year}` })) : [];
  const a = allocationOf(c);
  const statusOpts = REF_DEFAULTS.dossier_status.map((s) => ({ value: s.code, label: refLabel(refs, "dossier_status", s.code) }));
  const formOpts = REF_DEFAULTS.funding_form.map((s) => ({ value: s.code, label: refLabel(refs, "funding_form", s.code) }));
  const won = isWon(c.status);
  const asked = amounts(c.amountRequested, c.amountKind, durationOf(c));
  const [projects, people] = await Promise.all([
    prisma.project.findMany({ where: { archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.person.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const funderContact = c.contact ?? c.funder.contacts.find((x) => x.primary) ?? c.funder.contacts[0] ?? null;
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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={won ? "/conventions?vue=obtenus" : "/conventions"} className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ArrowLeft className="size-3" />{won ? "Financements obtenus" : "Dossiers de financement"}</Link>
          <div className="flex flex-wrap items-center gap-2">
            <SectionIcon />
            <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px]">{c.label ?? c.reference}</h1>
            <StatusBadge label={refLabel(refs, "dossier_status", c.status)} color={refColor(refs, "dossier_status", c.status)} />
            {a.over && <StatusBadge label={`Affectations au-delà du notifié · ${fmtEuro(-a.remaining!)}`} color="danger" dot={false} />}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground"><span className="font-mono">{c.reference}</span>{c.scheme ? ` · ${c.scheme}` : ""} · {c.startYear === c.endYear ? `année ${c.startYear}` : `${c.startYear} → ${c.endYear} (${durationOf(c)} ans)`}{c.targetProject && <> · pour <Link href={`/projets/${c.targetProject.id}`} className="text-primary hover:underline">{c.targetProject.name}</Link></>}{won && c.form ? ` · ${refLabel(refs, "funding_form", c.form)}` : ""}{rw ? "" : ` · lecture seule : tenu par ${le(V.raf)}`}</p>
          <div className="mt-2"><Stepper status={c.status} /></div>
        </div>
        {rw && <LifecycleButtons id={c.id} status={c.status} forms={formOpts} />}
      </div>

      {/* Le financeur et son contact, en avant (retour de Gaël : on ne les voyait pas). */}
      <div className="mb-4 rounded-md border bg-card px-4 py-3" data-testid="dossier-funder">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Financeur</span><div className="text-[15px] font-bold"><Link href={`/financeurs/${c.funderId}`} className="text-primary hover:underline">{c.funder.name}</Link></div></div>
          <div className="text-xs" data-testid="convention-contact"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.contact ? "Contact du dossier" : "Contact"}</span><div><ContactLine c={funderContact} /></div></div>
          {(c.decisionNote || c.decidedAt) && <div className="text-xs"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.status === "lost" ? "Refusé" : c.status === "dismissed" ? "Écarté" : "Décision"}{c.decidedAt ? ` le ${fmtDate(c.decidedAt)}` : ""}</span><div data-testid="dossier-decision">{c.decisionNote ?? "—"}</div></div>}
        </div>
      </div>

      {won && <div className="mb-4 grid gap-3 sm:grid-cols-5">
        {card("Demandé", c.amountRequested === null ? "—" : fmtEuro(c.amountRequested), "au dépôt du dossier")}
        {card("Notifié", c.amountNotified === null ? "—" : fmtEuro(c.amountNotified), "plafond des affectations", undefined, `notified-value-${c.reference}`)}
        {card(`Affecté aux ${pl(V.edition)}`, fmtEuro(a.granted), pct !== null ? `${pct} % du notifié · montants obtenus des lignes` : "somme des montants obtenus", a.over ? "border-danger bg-danger-soft/50" : undefined, `allocated-${c.reference}`)}
        {card("Reste à affecter", a.remaining === null ? "—" : fmtEuro(a.remaining), a.remaining === null ? "renseignez le notifié" : a.remaining < 0 ? "dépassement : réduisez une affectation ou corrigez le notifié" : `disponible pour ${un(V.edition)} à venir`, a.remaining !== null && a.remaining < 0 ? "border-danger bg-danger-soft/50" : undefined)}
        {card("Versé", fmtEuro(pay.received), pay.remaining === null ? "renseignez le notifié" : pay.late.length > 0 ? `${pay.late.length} versement${pay.late.length > 1 ? "s" : ""} en retard` : pay.remaining > 0 ? `reste à percevoir ${fmtEuro(pay.remaining)}` : "tout est perçu", pay.late.length > 0 ? "border-danger bg-danger-soft/50" : undefined, `received-${c.reference}`)}
      </div>
}

      <div className={cn("grid gap-4", won ? "lg:grid-cols-[1fr_360px]" : "lg:grid-cols-[1fr_1fr]")}>
        <div className="grid content-start gap-4">
          <Section title={won ? "La demande, pour mémoire" : "La demande"} description="Ce qu'on vise : de quoi il s'agit, combien, sur combien de temps, pour quel projet, avant quand." testId="dossier-request">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3"><Field label="Description" field="description" type="textarea" placeholder="Ce qui est financé, les conditions, ce qu'on demande…" /></div>
              <Field label="Montant demandé" field="amountRequested" type="number" suffix="€" refresh />
              <Field label="Ce montant est" field="amountKind" type="select" options={AMOUNT_KINDS} refresh />
              <div className="grid gap-1"><span className="text-[10px] text-muted-foreground">Par an · global</span><div className="text-sm tabular" data-testid="dossier-per-year">{asked.total == null ? "—" : `${fmtEuro(asked.perYear!)} par an · ${fmtEuro(asked.total)} sur ${durationOf(c)} an${durationOf(c) > 1 ? "s" : ""}`}</div></div>
              <Field label="Première année" field="startYear" type="number" refresh />
              <Field label="Dernière année" field="endYear" type="number" refresh />
              <Field label="Échéance de dépôt" field="deadline" type="date" />
              <Field label="Pour quel projet" field="targetProjectId" type="select" options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="— à préciser —" refresh />
              <Field label="Programme du financeur (dispositif, axe)" field="scheme" type="text" placeholder="axe, programme…" />
              <Field label="Référence" field="reference" type="text" refresh />
            </div>
          </Section>
          {!won && (
            <Section title="La réponse" description="Qui rédige, qui aide, où sont les sources ; les tâches et notes pour s'organiser ; les pièces (cahier des charges, réponse déposée)." testId="dossier-response">
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <Field label="Qui répond" field="ownerId" type="select" options={people.map((p) => ({ value: p.id, label: p.name }))} placeholder="— à désigner —" refresh />
                <div className="grid gap-2">
                  <HelpersPicker id={c.id} people={people.map((p) => ({ id: p.id, name: p.name }))} selected={c.helperPeople.map((h) => h.person)} rw={rw} />
                  <Field label="Aide extérieure, précisions" field="helpers" type="text" placeholder="un prestataire, un partenaire, qui fait quoi…" />
                </div>
                <div className="sm:col-span-2"><Field label="Documents sources, cahier des charges, liens" field="sources" type="textarea" placeholder="un élément par ligne : lien de l'appel, dossier sur le serveur, contact technique…" /></div>
              </div>
              <DossierWorkspace id={c.id} tasks={c.tasks} notes={c.notesLinked} files={c.attachments} rw={rw} />
            </Section>
          )}
          {won && <Section title={`Affectations aux ${pl(V.edition)}`} description={`Une ligne de financement par ${V.edition.one} rattachée ; le montant obtenu se saisit sur ${le(V.edition)} (onglet Financements). Le rattachement se fait ici ou depuis ${le(V.edition)}.`} testId="convention-lines" actions={rw ? <AttachEditionForm conventionId={c.id} editions={attachable} /> : undefined}>
            {c.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{`${cap(aucun(V.edition))} rattachée`}{rw ? ` — choisissez-en une ci-dessus, ou depuis l'onglet Financements d'${un(V.edition)} couverte par la période.` : "."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="convention-lines-table">
                  <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                    <tr><th className="py-1.5 pr-2">{cap(V.edition)}</th><th className="py-1.5 pr-2">{cap(V.pilote)}</th><th className="py-1.5 pr-2">Statut</th><th className="py-1.5 pr-2 text-right">Demandé</th><th className="py-1.5 pr-2 text-right">Obtenu</th><th className="py-1.5 pr-2">Livrables</th>{rw && <th className="py-1.5" />}</tr>
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
          </Section>}

          {won && <Section title="Versements" description={`Les tranches de l'accord (avance, acomptes, solde), attendues puis reçues ; « reçu » est posé par ${le(V.raf)} ou ${le(V.direction)}. Un versement propre à ${un(V.edition)} se saisit sur sa ligne et apparaît ici avec son projet.`} testId="convention-payments">
            <PaymentsList payments={allPayments} reference={c.amountNotified} rw={rw} target={{ conventionId: c.id }} showSource testId="convention-payments-list" />
          </Section>}

          <Section title={won ? "Le financement obtenu" : "Suivi"} description={rw ? "Sauvegarde automatique à chaque champ." : `Renseigné par ${le(V.raf)}.`} testId="dossier-info">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Statut" field="status" type="select" options={statusOpts} />
              {won && <Field label="Forme" field="form" type="select" options={formOpts} placeholder="— à préciser —" testId={`form-${c.reference}`} />}
              {won && <Field label="Montant notifié" field="amountNotified" type="number" suffix="€" refresh testId={`notified-${c.reference}`} />}
              <Field label="Date de dépôt" field="submittedAt" type="date" />
              <Field label="Date de notification" field="notifiedAt" type="date" />
              <Field label="Date de signature" field="signedAt" type="date" />
              <Field label="Contact du dossier" field="contactId" type="select" options={c.funder.contacts.map((x) => ({ value: x.id, label: `${[x.firstName, x.lastName].filter(Boolean).join(" ")}${x.role ? ` · ${x.role}` : ""}` }))} placeholder="— contact principal —" refresh />
              {(c.status === "lost" || c.status === "dismissed") && <div className="sm:col-span-2"><Field label="Pourquoi" field="decisionNote" type="textarea" /></div>}
            </div>
            <div className="mt-3"><Field label="Notes" field="notes" type="textarea" placeholder={`Conditions, avenants, clés de répartition (référence à l'Excel ${V.raf.one})…`} /></div>
            {won && <div className="mt-3 border-t pt-3"><DossierWorkspace id={c.id} tasks={c.tasks} notes={c.notesLinked} files={c.attachments} rw={rw} /></div>}
          </Section>
        </div>

        {won && <Section title="Obligations à venir" description={`Livrables non remis des ${pl(V.edition)} rattachées, les plus proches d'abord.`} testId="convention-obligations">
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
        </Section>}
      </div>
    </div>
  );
}
