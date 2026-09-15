import { Section } from "@/components/common/section";
import { PaymentsList, type PaymentRow } from "@/components/funding/payments-list";
import { fmtEuro } from "@/lib/format";
import { paymentSummary } from "@/lib/payments";
import type { TabCtx } from "./types";

// Une seule liste des versements de l'édition, toutes lignes confondues (le miroir des livrables) : ce que la RAF attend
// des financeurs de ce projet cette année, dans l'ordre des dates. Lecture et case « reçu » seulement : le détail (montant, date,
// suppression) se modifie dans le panneau de la ligne. Les tranches d'une convention partagée se lisent sur la convention.
export function EditionPayments({ e, rw }: Pick<TabCtx, "e"> & { rw: boolean }) {
  const payments: PaymentRow[] = e.fundingLines.flatMap((f) => f.payments.map((p) => ({ ...p, source: { label: f.funder.name, href: `/financeurs/${f.funderId}` } })));
  const granted = e.fundingLines.reduce((s, f) => s + (f.amountGranted ?? 0), 0);
  const viaConvention = e.fundingLines.filter((f) => f.convention && f.payments.length === 0 && f.convention.payments.length > 0);
  const s = paymentSummary(granted || null, payments);
  if (payments.length === 0 && viaConvention.length === 0) return null;
  return (
    <Section
      title="Versements"
      description={<>Ce que les financeurs de cette édition ont versé et doivent encore verser{s.late.length > 0 && <span className="text-danger"> · {s.late.length} en retard</span>} · la RAF et la direction sont prévenues quand un versement attendu est dépassé ; le détail se modifie dans le panneau de la ligne.</>}
      testId="edition-payments"
    >
      {payments.length > 0 && <PaymentsList payments={payments} reference={granted || null} rw={rw} showSource compact testId="edition-payments-list" />}
      {viaConvention.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Versé par tranches sur convention : {viaConvention.map((f) => `${f.funder.name} (${f.convention!.reference}, ${fmtEuro(paymentSummary(f.convention!.amountNotified, f.convention!.payments).received)} reçus sur ${fmtEuro(f.convention!.amountNotified)})`).join(" · ")}.
        </p>
      )}
    </Section>
  );
}
