// Budget des dépenses directes sans double comptage (cahier v1-byGPT §12) :
// engagement restant = max(0, engagé − réalisé rattaché) ; réalisé total = réalisé hors devis + Σ réalisés rattachés ;
// disponible = enveloppe − réalisé total − engagements restants (peut être négatif : on ne masque pas un dépassement).
// Lot D : quand la source du réalisé est le grand livre (Settings.realizedSource = ledger), `ledgerSpent` porte les charges
// comptables de l'édition et remplace le réalisé saisi — jamais les deux à la fois (anti-double comptage).
export type ExpenseLike = { committed: number; spent: number; status: string };
export type BudgetLike = { budgetEnvelope: number | null; spent: number; expenses: ExpenseLike[]; ledgerSpent?: number | null };

export function budgetOf(e: BudgetLike) {
  const realizedLinked = e.expenses.reduce((s, x) => s + x.spent, 0);
  const remainingCommitments = e.expenses.filter((x) => x.status === "open").reduce((s, x) => s + Math.max(0, x.committed - x.spent), 0);
  const fromLedger = e.ledgerSpent !== undefined && e.ledgerSpent !== null;
  const realized = fromLedger ? e.ledgerSpent! : e.spent + realizedLinked;
  const used = realized + remainingCommitments;
  return {
    envelope: e.budgetEnvelope,
    realized,
    realizedLinked,
    remainingCommitments,
    used,
    available: e.budgetEnvelope == null ? null : e.budgetEnvelope - used,
    // D'où vient le réalisé : « ledger » (compta) ou « raf » (saisi) — pour l'afficher à côté du chiffre.
    source: fromLedger ? "ledger" : "raf",
  };
}
