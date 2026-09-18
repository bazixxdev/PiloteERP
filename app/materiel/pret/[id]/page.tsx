import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { AutoField } from "@/components/inline/auto-field";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";
import { canManageEquipment } from "@/lib/rights";
import { fmtDate, fmtEuro } from "@/lib/format";
import { contactName } from "@/lib/contacts";
import { borrowerName, isLate } from "@/lib/equipment";
import { attachmentInclude } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import { DeleteLoanButton, FilesBlock, PrintButton, ReturnButton, SendLoanButton } from "../../controls";

// Fiche de prêt (retour de Gaël, 18/09) : l'entité prêt en tant que telle — quoi, à qui, pour quoi, quand sorti, quand
// attendu, rendu avec commentaire, chèque de caution, pièces (fiche signée). Elle s'imprime (PDF) et s'envoie par mail
// à l'emprunteur : la preuve du prêt.
export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  if (!instanceHas(settings, "materiel")) notFound();
  const l = await prisma.loan.findUnique({ where: { id }, include: {
    equipment: true,
    person: { select: { id: true, name: true, email: true, phone: true } },
    contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, organisation: { select: { id: true, name: true } }, organisationName: true } },
    organisation: { select: { id: true, name: true } },
    edition: { select: { id: true, year: true, project: { select: { name: true } } } },
    createdBy: { select: { name: true } },
    attachments: { include: attachmentInclude, orderBy: { createdAt: "desc" } },
  } });
  if (!l) notFound();
  const rw = canManageEquipment(me) || l.createdById === me.id || l.personId === me.id;
  const late = isLate(l);
  const who = borrowerName(l);
  const email = l.person?.email ?? l.contact?.email ?? null;
  const phone = l.person?.phone ?? l.contact?.phone ?? null;
  const org = l.organisation?.name ?? l.contact?.organisation?.name ?? l.contact?.organisationName ?? null;
  const number = `P-${String(l.number).padStart(4, "0")}`;
  const status = l.returnedAt ? { label: `Rendu le ${fmtDate(l.returnedAt)}`, color: "mint" } : late ? { label: "En retard", color: "danger" } : { label: "En cours", color: "primary" };
  const subject = `Fiche de prêt ${number} — ${l.equipment.name} — CRESS`;
  const body = [
    `Bonjour${l.contact ? ` ${contactName(l.contact)}` : l.person ? ` ${l.person.name}` : ""},`, "",
    `Voici la fiche du prêt de matériel ${number}.`, "",
    `Matériel : ${l.equipment.name}${l.quantity > 1 ? ` × ${l.quantity}` : ""}${l.equipment.reference ? ` (réf. ${l.equipment.reference})` : ""}`,
    `Emprunteur : ${who}${org && !who.includes(org) ? ` — ${org}` : ""}`,
    l.edition ? `Pour : ${l.edition.project.name} ${l.edition.year}` : null,
    `Sorti le : ${fmtDate(l.outAt)}`,
    `Retour attendu le : ${l.dueAt ? fmtDate(l.dueAt) : "à convenir"}`,
    l.depositAmount ? `Chèque de caution : ${fmtEuro(l.depositAmount)}${l.depositRef ? ` (${l.depositRef})` : ""}, rendu au retour du matériel en bon état` : null,
    l.notes ? `Note : ${l.notes}` : null, "",
    "Merci de rendre le matériel à la date convenue, dans l'état où il a été remis.", "", "Cordialement,", me.name, "CRESS",
  ].filter((x) => x !== null).join("\n");
  // Chaque champ modifiable a son double en texte pour l'impression (pas de champs de saisie sur la fiche papier).
  const asText = (type: string, value: unknown) => value == null || value === "" ? "—" : type === "date" ? fmtDate(value as Date) : type === "number" ? fmtEuro(Number(value)) : String(value);
  const F = ({ field, label, type = "text", value, testId }: { field: string; label: string; type?: "text" | "textarea" | "number" | "date"; value: unknown; testId?: string }) => (
    <label className="grid gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><span className="no-print"><AutoField model="loan" id={l.id} field={field} type={type} value={value as string | number | Date | null} readOnly={!rw} label={label} testId={testId} /></span><span className="hidden text-sm print:block">{asText(type, value)}</span></label>
  );
  return (
    <div className="p-4 md:p-6">
      <div className="no-print mb-2"><Link href="/materiel?vue=prets" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Prêts en cours</Link></div>
      <div data-print-root data-testid="loan-fiche" data-status={l.returnedAt ? "returned" : late ? "late" : "open"}>
        <PageHeader
          title={<span className="inline-flex items-center gap-2"><Package className="size-5 text-primary" aria-hidden />Fiche de prêt <span className="font-mono text-base text-muted-foreground" data-testid="loan-number">{number}</span></span>}
          subtitle={<><b>{l.equipment.name}</b>{l.quantity > 1 ? ` × ${l.quantity}` : ""} · prêté à <b>{who}</b>{org && !who.includes(org) ? ` (${org})` : ""} · <StatusBadge label={status.label} color={status.color} /></>}
          actions={<span className="no-print flex flex-wrap items-center gap-2">
            {!l.returnedAt && <ReturnButton loanId={l.id} label={l.equipment.name} />}
            <SendLoanButton loanId={l.id} to={email} subject={subject} body={body} />
            <PrintButton />
          </span>}
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-md border bg-card p-4" data-testid="loan-what">
            <h2 className="mb-2 text-[15px] font-bold">Le matériel</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Matériel</dt><dd><Link href={`/materiel?materiel=${l.equipment.id}`} className="text-primary hover:underline">{l.equipment.name}</Link>{l.equipment.reference ? <span className="text-muted-foreground"> · réf. {l.equipment.reference}</span> : ""}</dd>
              <dt className="text-muted-foreground">Quantité</dt><dd>{l.quantity}</dd>
              {l.equipment.notes && <><dt className="text-muted-foreground">Consignes</dt><dd>{l.equipment.notes}</dd></>}
              {l.equipment.value != null && <><dt className="text-muted-foreground">Valeur</dt><dd>{fmtEuro(l.equipment.value)}</dd></>}
            </dl>
            <h2 className="mb-2 mt-4 text-[15px] font-bold">L&apos;emprunteur</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="loan-who">
              <dt className="text-muted-foreground">{l.person ? "Personne de l'équipe" : "Contact"}</dt><dd>{l.person ? l.person.name : l.contact ? <Link href={`/contacts?contact=${l.contact.id}`} className="text-primary hover:underline">{contactName(l.contact)}</Link> : "—"}</dd>
              {org && <><dt className="text-muted-foreground">Organisation</dt><dd>{l.organisation ? <Link href={`/organisations?organisation=${l.organisation.id}`} className="text-primary hover:underline">{org}</Link> : org}</dd></>}
              {email && <><dt className="text-muted-foreground">E-mail</dt><dd><a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a></dd></>}
              {phone && <><dt className="text-muted-foreground">Téléphone</dt><dd>{phone}</dd></>}
              {l.edition && <><dt className="text-muted-foreground">Pour</dt><dd><Link href={`/edition/${l.edition.id}`} className="text-primary hover:underline">{l.edition.project.name} · {l.edition.year}</Link></dd></>}
            </dl>
          </section>
          <section className="rounded-md border bg-card p-4" data-testid="loan-when">
            <h2 className="mb-2 text-[15px] font-bold">Dates et retour</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Sorti le</dt><dd>{fmtDate(l.outAt)}<span className="text-xs text-muted-foreground"> · enregistré par {l.createdBy?.name ?? "—"}</span></dd>
              <dt className="text-muted-foreground">Retour attendu</dt><dd className={cn(late && "font-semibold text-danger")} data-testid="loan-due-value">{rw && !l.returnedAt ? <><span className="no-print"><AutoField model="loan" id={l.id} field="dueAt" type="date" value={l.dueAt} label="Retour attendu" testId="loan-due-field" /></span><span className="hidden print:inline">{l.dueAt ? fmtDate(l.dueAt) : "à convenir"}</span></> : l.dueAt ? fmtDate(l.dueAt) : "à convenir"}{late ? " · en retard" : ""}</dd>
              <dt className="text-muted-foreground">Rendu le</dt><dd data-testid="loan-returned-value">{l.returnedAt ? fmtDate(l.returnedAt) : <span className="text-muted-foreground">pas encore</span>}</dd>
              {l.sentAt && <><dt className="text-muted-foreground">Fiche envoyée</dt><dd data-testid="loan-sent-value">le {fmtDate(l.sentAt)}</dd></>}
            </dl>
            <div className="mt-3 grid gap-2">
              {F({ field: "notes", label: "Note au prêt (accessoires, lieu de remise…)", type: "textarea", value: l.notes, testId: "loan-notes" })}
              {(l.returnedAt || l.returnNote) && F({ field: "returnNote", label: "Commentaire de retour", type: "textarea", value: l.returnNote, testId: "loan-return-note" })}
            </div>
            <h2 className="mb-2 mt-4 text-[15px] font-bold">Chèque de caution</h2>
            <div className="grid grid-cols-[8rem_1fr_9rem] gap-2" data-testid="loan-deposit">
              {F({ field: "depositAmount", label: "Montant (€)", type: "number", value: l.depositAmount, testId: "loan-deposit-amount" })}
              {F({ field: "depositRef", label: "Référence (banque, numéro)", value: l.depositRef, testId: "loan-deposit-ref" })}
              {F({ field: "depositReturnedAt", label: "Rendu le", type: "date", value: l.depositReturnedAt, testId: "loan-deposit-returned" })}
            </div>
            {!l.depositAmount && <p className="mt-1 text-[11px] text-muted-foreground">Pas de caution pour ce prêt.</p>}
          </section>
        </div>
        <section className="mt-4 rounded-md border bg-card p-4 no-print" data-testid="loan-files">
          <h2 className="mb-2 text-[15px] font-bold">Pièces <span className="text-xs font-normal text-muted-foreground">· la fiche de prêt signée, l&apos;état des lieux, une photo</span></h2>
          <FilesBlock files={l.attachments} target={{ loanId: l.id }} canEdit={rw} />
        </section>
        <div className="mt-6 hidden text-xs text-muted-foreground print:block">
          <p>Fiche de prêt {number} · CRESS · {fmtDate(new Date())}. Le matériel est remis en bon état et doit être rendu à la date convenue, dans l&apos;état où il a été remis.{l.depositAmount ? " Le chèque de caution est restitué au retour du matériel en bon état." : ""}</p>
          <div className="mt-8 grid grid-cols-2 gap-8"><div>Pour la CRESS — nom, date, signature :<div className="mt-10 border-b" /></div><div>L&apos;emprunteur — nom, date, signature :<div className="mt-10 border-b" /></div></div>
        </div>
        {rw && <div className="no-print mt-3 flex justify-end"><DeleteLoanButton loanId={l.id} /></div>}
      </div>
      <div className="no-print"><Button asChild variant="ghost" size="sm" className="mt-2"><Link href="/materiel">Inventaire</Link></Button></div>
    </div>
  );
}
