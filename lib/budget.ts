// Budget des dépenses directes sans double comptage (cahier v1-byGPT §12) :
// engagement restant = max(0, engagé − réalisé rattaché) ; réalisé total = réalisé hors devis + Σ réalisés rattachés ;
// disponible = enveloppe − réalisé total − engagements restants (peut être négatif : on ne masque pas un dépassement).
export type ExpenseLike = { committed: number; spent: number; status: string };
export type BudgetLike = { budgetEnvelope: number | null; spent: number; expenses: ExpenseLike[] };

export function budgetOf(e: BudgetLike) {
  const realizedLinked = e.expenses.reduce((s, x) => s + x.spent, 0);
  const remainingCommitments = e.expenses.filter((x) => x.status === "open").reduce((s, x) => s + Math.max(0, x.committed - x.spent), 0);
  const realized = e.spent + realizedLinked;
  const used = realized + remainingCommitments;
  return {
    envelope: e.budgetEnvelope,
    realized,
    realizedLinked,
    remainingCommitments,
    used,
    available: e.budgetEnvelope == null ? null : e.budgetEnvelope - used,
  };
}
