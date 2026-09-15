import Link from "next/link";
import { AutoField } from "@/components/inline/auto-field";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { paymentStatus, paymentSummary, sortPayments, type PaymentLike } from "@/lib/payments";
import { cn } from "@/lib/utils";
import { AddPaymentForm, DeletePaymentButton, PaymentReceived } from "./payment-controls";

export type PaymentRow = PaymentLike & { reference?: string | null; note?: string | null; source?: { label: string; href: string } };

// Liste des versements d'un financement (ligne ou convention) : attendus d'abord, reçus repliés, une case « reçu » par ligne.
// `reference` = le montant à percevoir (obtenu d'une ligne, notifié d'une convention) ; la synthèse en découle.
export function PaymentsList({ payments, reference, rw, target, compact, showSource, testId = "payments" }: {
  payments: PaymentRow[];
  reference: number | null;
  rw: boolean;
  target?: { fundingLineId?: string; conventionId?: string };
  compact?: boolean;
  showSource?: boolean;
  testId?: string;
}) {
  const s = paymentSummary(reference, payments);
  const sorted = sortPayments(payments);
  const todo = sorted.filter((p) => !p.receivedAt);
  const done = sorted.filter((p) => p.receivedAt);
  const row = (p: PaymentRow) => {
    const st = paymentStatus(p);
    const n = daysFromNow(p.expectedAt);
    return (
      <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm" data-testid={`payment-${p.id}`} data-status={st}>
        <PaymentReceived id={p.id} received={!!p.receivedAt} readOnly={!rw} label={p.label} />
        <div className="min-w-[180px] flex-1 basis-48">
          {rw && !compact ? <AutoField model="payment" id={p.id} field="label" type="text" value={p.label} inputClassName={cn(p.receivedAt && "text-muted-foreground")} label={`Versement ${p.label}`} /> : <span className={cn("block truncate px-2", p.receivedAt && "text-muted-foreground")}>{p.label}</span>}
          {showSource && p.source && <Link href={p.source.href} className="block truncate px-2 text-[11px] text-primary hover:underline">{p.source.label}</Link>}
        </div>
        <span className="w-28 shrink-0 text-right tabular font-medium">{rw && !compact ? <AutoField model="payment" id={p.id} field="amount" type="number" value={p.amount} suffix="€" label={`Montant du versement ${p.label}`} /> : fmtEuro(p.amount)}</span>
        {rw && !compact ? <div className="w-36 shrink-0"><AutoField model="payment" id={p.id} field="expectedAt" type="date" value={p.expectedAt} label={`Date attendue du versement ${p.label}`} /></div> : <span className="w-24 shrink-0 text-xs tabular text-muted-foreground">{fmtDate(p.expectedAt)}</span>}
        <span className={cn("ml-auto w-32 shrink-0 text-right text-xs", st === "received" ? "text-mint" : st === "late" ? "font-semibold text-danger" : "text-muted-foreground")}>
          {st === "received" ? `reçu ${fmtDate(p.receivedAt)}` : st === "late" ? `${-n} j de retard` : n === 0 ? "attendu aujourd'hui" : `attendu J-${n}`}
        </span>
        {rw && !compact && !p.receivedAt && <DeletePaymentButton id={p.id} label={p.label} />}
      </li>
    );
  };
  return (
    <div data-testid={testId}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground" data-testid={`${testId}-summary`}>
          <b className="text-foreground">{fmtEuro(s.received)} reçus</b>{reference !== null && <> sur {fmtEuro(reference)}{s.pct !== null && ` (${s.pct} %)`}</>}
          {s.remaining !== null && s.remaining > 0 && <> · <span className="font-medium text-foreground">reste à percevoir {fmtEuro(s.remaining)}</span></>}
          {s.remaining === 0 && reference !== null && reference > 0 && <> · <span className="text-mint">tout est perçu</span></>}
          {s.unplanned !== null && s.unplanned > 0 && <> · {fmtEuro(s.unplanned)} sans versement planifié</>}
          {s.late.length > 0 && <> · <span className="font-semibold text-danger">{s.late.length} en retard</span></>}
          {s.over && <> · <span className="font-semibold text-danger">reçu au-delà du montant de référence</span></>}
        </span>
        {rw && target && <AddPaymentForm fundingLineId={target.fundingLineId} conventionId={target.conventionId} suggestedAmount={s.unplanned} testId={`${testId}-add`} />}
      </div>
      {todo.length === 0 ? (
        <p className="text-sm text-muted-foreground">{payments.length === 0 ? "Aucun versement planifié." : "Rien en attente : tout ce qui était planifié est reçu."}</p>
      ) : <ul className="divide-y" data-testid={`${testId}-todo`}>{todo.map(row)}</ul>}
      {done.length > 0 && (
        <details className="group mt-2 text-xs text-muted-foreground" open={compact ? undefined : todo.length === 0}>
          <summary className="cursor-pointer list-none">✓ {done.length} reçu{done.length > 1 ? "s" : ""} · {fmtEuro(s.received)} <span className="text-primary group-open:hidden">afficher</span><span className="hidden text-primary group-open:inline">masquer</span></summary>
          <ul className="mt-1 divide-y" data-testid={`${testId}-done`}>{done.map(row)}</ul>
        </details>
      )}
    </div>
  );
}
