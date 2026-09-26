// Convention partagée : affectations = lignes de financement des éditions rattachées.
// Les affectations confirmées (montant obtenu) ne doivent pas dépasser le montant notifié ; le reliquat non affecté est affiché.
export type ConventionLike = { amountNotified: number | null; amountRequested: number | null; lines: { id: string; amountGranted: number | null; amountRequested: number | null }[] };

export function allocationOf(c: ConventionLike) {
  const granted = c.lines.reduce((s, l) => s + (l.amountGranted ?? 0), 0);
  const requested = c.lines.reduce((s, l) => s + (l.amountRequested ?? 0), 0);
  const ceiling = c.amountNotified ?? null;
  return { granted, requested, ceiling, remaining: ceiling === null ? null : ceiling - granted, over: ceiling !== null && granted > ceiling };
}

// Contrôle avant d'enregistrer un montant obtenu sur une affectation : la somme des autres + le nouveau ≤ notifié.
export function allocationCheck(c: ConventionLike, lineId: string, newGranted: number | null): { ok: true } | { ok: false; error: string } {
  if (c.amountNotified === null || newGranted === null) return { ok: true };
  const others = c.lines.filter((l) => l.id !== lineId).reduce((s, l) => s + (l.amountGranted ?? 0), 0);
  const total = others + newGranted;
  if (total > c.amountNotified + 0.001) {
    const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
    return { ok: false, error: `Les affectations confirmées atteindraient ${fmt(total)} pour ${fmt(c.amountNotified)} notifiés : écart de ${fmt(total - c.amountNotified)}. Réduisez une affectation ou corrigez le montant notifié.` };
  }
  return { ok: true };
}

export function conventionCovers(c: { startYear: number; endYear: number }, year: number): boolean {
  return c.startYear <= year && year <= c.endYear;
}

// Rattacher une année à un dossier (26/09) : si l'année a déjà une ligne de ce financeur hors dossier — typiquement la ligne
// « à déposer » recréée en reconduisant —, on la rattache au lieu d'en créer une seconde. Seulement s'il n'y en a qu'une :
// avec plusieurs, on ne devine pas laquelle, une nouvelle ligne est créée.
export function reusableLine<L extends { id: string; funderId: string; conventionId: string | null }>(lines: L[], funderId: string): L | null {
  const free = lines.filter((l) => l.funderId === funderId && l.conventionId === null);
  return free.length === 1 ? free[0] : null;
}
