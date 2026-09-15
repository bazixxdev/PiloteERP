import { daysFromNow } from "./format";

// Versements (lot A). Le statut n'est jamais stocké : il se lit de la date de réception et de la date attendue.
export type PaymentLike = { id: string; label: string; amount: number; expectedAt: Date; receivedAt: Date | null };

export type PaymentStatus = "received" | "expected" | "late";

export function paymentStatus(p: Pick<PaymentLike, "expectedAt" | "receivedAt">): PaymentStatus {
  if (p.receivedAt) return "received";
  return daysFromNow(p.expectedAt) < 0 ? "late" : "expected";
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { received: "Reçu", expected: "Attendu", late: "En retard" };

export function totalReceived(payments: PaymentLike[]): number {
  return payments.filter((p) => p.receivedAt).reduce((s, p) => s + p.amount, 0);
}

export function totalExpected(payments: PaymentLike[]): number {
  return payments.filter((p) => !p.receivedAt).reduce((s, p) => s + p.amount, 0);
}

// Reste à percevoir = obtenu (ou notifié) − reçu, jamais négatif ; null quand le montant de référence est inconnu.
export function remainingToReceive(reference: number | null, payments: PaymentLike[]): number | null {
  if (reference === null) return null;
  return Math.max(0, reference - totalReceived(payments));
}

// Synthèse d'un financement : montant de référence, reçu, attendu (planifié non reçu), reste, part non planifiée.
export function paymentSummary(reference: number | null, payments: PaymentLike[]) {
  const received = totalReceived(payments);
  const expected = totalExpected(payments);
  const remaining = remainingToReceive(reference, payments);
  const late = payments.filter((p) => paymentStatus(p) === "late");
  return {
    received,
    expected,
    remaining,
    // Ce qui n'est ni reçu ni planifié : à échéancer avec le financeur.
    unplanned: reference === null ? null : Math.max(0, reference - received - expected),
    late,
    // Reçu au-delà de la référence : un montant obtenu à corriger, ou un trop-perçu.
    over: reference !== null && received > reference + 0.001,
    pct: reference ? Math.round((received / reference) * 100) : null,
  };
}

export function sortPayments<T extends PaymentLike>(payments: T[]): T[] {
  // Non reçus d'abord (les plus proches en tête), puis reçus (les plus récents en tête).
  return [...payments].sort((a, b) => {
    if (!!a.receivedAt !== !!b.receivedAt) return a.receivedAt ? 1 : -1;
    if (!a.receivedAt) return a.expectedAt.getTime() - b.expectedAt.getTime();
    return (b.receivedAt?.getTime() ?? 0) - (a.receivedAt?.getTime() ?? 0);
  });
}
