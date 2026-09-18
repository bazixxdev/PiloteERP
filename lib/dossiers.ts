// Dossiers de financement (lot 2 du 19/09) : le cycle d'un dossier, ce qui est « obtenu », les montants par an.
export const OPEN_STATUSES = ["study", "drafting", "submitted"] as const;
export const WON_STATUSES = ["notified", "contracted", "justified"] as const;
export const CLOSED_STATUSES = ["lost", "dismissed"] as const;
export const isWon = (status: string) => (WON_STATUSES as readonly string[]).includes(status);
export const isOpen = (status: string) => (OPEN_STATUSES as readonly string[]).includes(status);

// Les passages possibles depuis un statut, avec le libellé du bouton et ce qu'il faut demander.
export const TRANSITIONS: Record<string, { to: string; label: string; ask?: "reason" | "award"; tone?: "primary" | "danger" | "muted" }[]> = {
  study: [{ to: "drafting", label: "On répond", tone: "primary" }, { to: "dismissed", label: "Écarter", ask: "reason", tone: "muted" }],
  drafting: [{ to: "submitted", label: "Déposé", tone: "primary" }, { to: "dismissed", label: "Écarter", ask: "reason", tone: "muted" }],
  submitted: [{ to: "notified", label: "Obtenu", ask: "award", tone: "primary" }, { to: "lost", label: "Refusé", ask: "reason", tone: "danger" }],
  notified: [{ to: "contracted", label: "Conventionné / signé", tone: "primary" }],
  contracted: [{ to: "justified", label: "Justifié", tone: "muted" }],
  justified: [],
  lost: [{ to: "study", label: "Rouvrir", tone: "muted" }],
  dismissed: [{ to: "study", label: "Rouvrir", tone: "muted" }],
};

export const AMOUNT_KINDS = [{ value: "total", label: "global (sur toute la durée)" }, { value: "annual", label: "par an" }];

// Montant par an et montant global, d'après le montant saisi, sa nature et la durée.
export function amounts(amount: number | null, kind: string, years: number): { perYear: number | null; total: number | null } {
  if (amount == null) return { perYear: null, total: null };
  const y = Math.max(1, years);
  return kind === "annual" ? { perYear: amount, total: amount * y } : { perYear: amount / y, total: amount };
}
export const durationOf = (c: { startYear: number; endYear: number }) => Math.max(1, c.endYear - c.startYear + 1);
