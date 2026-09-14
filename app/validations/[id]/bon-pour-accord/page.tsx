import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { fmtDate, fmtEuro } from "@/lib/format";

// Bon pour accord (lot 3) : à la validation d'un devis, le mail au fournisseur est prêt — accord, montant, référence, adresse de
// facturation. Un « bon pour accord » écrit par une personne habilitée vaut acceptation : plus d'impression, de tampon ni de signature.
// L'envoi réel (mail sortant) est en V1 ; ici, on copie ou on ouvre son client mail.
export default async function BonPourAccordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  const v = await prisma.validationRequest.findUnique({ where: { id }, include: { requester: true, decider: true, edition: { include: { project: { include: { pole: true } } } }, attachments: true } });
  if (!v) notFound();
  const approved = v.status === "approved";
  const ref = `${v.edition.project.analyticCode}-${v.edition.year}-${v.id.slice(-6).toUpperCase()}`;
  const subject = `Bon pour accord — ${v.label} — CRESS Centre-Val de Loire (réf. ${ref})`;
  const body = [
    `Bonjour,`,
    ``,
    `Nous vous confirmons notre accord sur votre devis « ${v.label} »${v.amount != null ? ` pour un montant de ${fmtEuro(v.amount)}` : ""}${v.attachments[0] ? ` (${v.attachments[0].fileName})` : ""}.`,
    `Projet : ${v.edition.project.name} (${v.edition.year}) · référence à rappeler : ${ref}.`,
    ``,
    `Facturation : ${settings.billingEmail}. ${settings.billingNote}`,
    ``,
    `Bon pour accord donné le ${fmtDate(v.decidedAt ?? new Date())} par ${v.decider?.name ?? "—"}, ${v.decider?.role === "director" ? "directrice" : "responsable habilité·e"}, CRESS Centre-Val de Loire.`,
    ``,
    `Cordialement,`,
    `${v.requester.name}`,
  ].join("\n");
  const mailto = `mailto:${encodeURIComponent(v.supplierEmail ?? "")}?cc=${encodeURIComponent(settings.billingEmail)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Bon pour accord" subtitle={<>Devis « {v.label} » · <Link href={`/edition/${v.editionId}?onglet=validations`} className="text-primary hover:underline">{v.edition.project.name} · {v.edition.year}</Link> · demandé par {v.requester.name}</>} />
      {!approved ? (
        <div className="rounded-md border bg-warning-soft px-4 py-3 text-sm" data-testid="bpa-not-approved">Ce devis n'est pas approuvé ({v.status === "pending" ? "en attente" : "refusé"}) : pas de bon pour accord.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Section title="Mail prêt à envoyer" description="Copiez-le ou ouvrez votre messagerie : le fournisseur reçoit l'accord et l'adresse de facturation. Rien à imprimer, rien à tamponner." testId="bpa">
            <dl className="mb-3 grid gap-1 text-xs">
              <div className="grid grid-cols-[80px_1fr]"><dt className="text-muted-foreground">À</dt><dd data-testid="bpa-to">{v.supplierEmail ?? <span className="italic text-muted-foreground">adresse du fournisseur non renseignée sur la demande</span>}{v.supplier ? ` (${v.supplier})` : ""}</dd></div>
              <div className="grid grid-cols-[80px_1fr]"><dt className="text-muted-foreground">Copie</dt><dd>{settings.billingEmail}</dd></div>
              <div className="grid grid-cols-[80px_1fr]"><dt className="text-muted-foreground">Objet</dt><dd className="font-medium">{subject}</dd></div>
            </dl>
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-sans text-sm leading-relaxed" data-testid="bpa-body">{body}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={`Objet : ${subject}\n\n${body}`} label="Copier le mail" />
              <Button asChild size="sm"><a href={mailto} data-testid="bpa-mailto"><Mail />Ouvrir dans ma messagerie</a></Button>
            </div>
          </Section>
          <Section title="Et après" className="text-sm">
            <ol className="grid gap-2 text-xs">
              <li><b>1.</b> Le devis approuvé est déjà <b>engagé</b> sur le budget de l'édition ({v.amount != null ? fmtEuro(v.amount) : "—"}).</li>
              <li><b>2.</b> La facture arrive sur <b>{settings.billingEmail}</b>. Si elle arrive chez vous, transférez-la.</li>
              <li><b>3.</b> La RAF la marque <b>reçue</b> puis <b>payée</b> dans l'onglet Budget ; vous êtes prévenu·e à chaque étape, et on vous demande si la prestation est conforme (sans bloquer le paiement).</li>
            </ol>
            <p className="mt-3 text-[10px] text-muted-foreground">Vu par {me.name}. Décision : {v.decider?.name} le {fmtDate(v.decidedAt)}{v.decisionComment ? ` — « ${v.decisionComment} »` : ""}.</p>
          </Section>
        </div>
      )}
    </div>
  );
}
