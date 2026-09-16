import { daysFromNow } from "./format";

// « Qui finance quoi » (lot C) : la matrice éditions × financeurs d'une année, en fonctions pures (patron du /pilotage
// d'erp-tlst). Cellule = montant obtenu (confirmé) ou demandé (en attente), ou « à déposer » ; pieds de ligne et de colonne ;
// zones d'attention : éditions sans financement, conventions sous-affectées, dossiers encore à déposer sur une édition en cours,
// livrables en retard par financeur. Les montants sont masqués hors CODIR : la matrice ne montre alors que des pastilles.

export type MatrixLine = { id: string; funderId: string; status: string; amountGranted: number | null; amountRequested: number | null; conventionId: string | null; deliverables: { label: string; dueDate: Date; done: boolean }[] };
export type MatrixEdition = {
  id: string; year: number; status: string; budgetEnvelope: number | null;
  project: { id: string; name: string; analyticCode: string; poleId: string; pole: { name: string }; pilot: { name: string } };
  fundingLines: MatrixLine[];
};
export type MatrixFunder = { id: string; name: string };
export type MatrixConvention = { id: string; reference: string; funderId: string; startYear: number; endYear: number; amountNotified: number | null; lines: { id: string; amountGranted: number | null; editionId: string }[] };

// Ce que vaut une cellule : confirmé (obtenu), attendu (demandé, dossier non tranché), à déposer, ou rien.
export type CellKind = "granted" | "requested" | "to_submit";
export type Cell = { kind: CellKind; amount: number | null; lines: number; late: number; conventionRef?: string; lineId: string };

const PENDING = new Set(["to_submit", "submitted"]);

export function cellOf(lines: MatrixLine[], conventions: Map<string, MatrixConvention>): Cell | null {
  if (lines.length === 0) return null;
  const granted = lines.reduce((s, l) => s + (l.amountGranted ?? 0), 0);
  const requested = lines.reduce((s, l) => s + (l.amountRequested ?? 0), 0);
  const late = lines.reduce((s, l) => s + l.deliverables.filter((d) => !d.done && daysFromNow(d.dueDate) < 0).length, 0);
  const conv = lines.map((l) => (l.conventionId ? conventions.get(l.conventionId)?.reference : undefined)).find(Boolean);
  const lineId = lines[0].id; // la ligne à ouvrir au clic sur la cellule
  // Obtenu dès qu'un montant est accordé ; demandé quand un dossier est parti (déposé, notifié sans montant…) ; sinon à déposer,
  // avec le montant prévu s'il est déjà écrit sur la ligne.
  if (lines.some((l) => l.amountGranted !== null && l.amountGranted > 0)) return { kind: "granted", amount: granted, lines: lines.length, late, conventionRef: conv, lineId };
  if (lines.some((l) => l.status !== "to_submit")) return { kind: "requested", amount: requested || null, lines: lines.length, late, conventionRef: conv, lineId };
  return { kind: "to_submit", amount: requested || null, lines: lines.length, late, conventionRef: conv, lineId };
}

export type MatrixRow = {
  edition: MatrixEdition;
  cells: Map<string, Cell>; // par financeur
  granted: number; requested: number;
  coverage: number | null; // obtenu / enveloppe, null sans enveloppe
  orphan: boolean; // aucune ligne de financement
  pending: number; // lignes à déposer / déposées
};

export type MatrixColumn = { funder: MatrixFunder; granted: number; requested: number; editions: number; late: number };

export type Matrix = {
  year: number;
  rows: MatrixRow[];
  columns: MatrixColumn[]; // seulement les financeurs présents sur l'année, par total obtenu décroissant
  totals: { granted: number; requested: number; envelope: number };
  attention: {
    orphans: MatrixEdition[];
    pending: { edition: MatrixEdition; funders: string[] }[]; // éditions en cours dont un dossier n'est pas tranché
    underAllocated: { convention: MatrixConvention; remaining: number }[]; // notifié − affecté > 0 sur la période
    lateByFunder: { funder: MatrixFunder; count: number }[];
  };
};

export function buildMatrix(year: number, editions: MatrixEdition[], funders: MatrixFunder[], conventions: MatrixConvention[]): Matrix {
  const convById = new Map(conventions.map((c) => [c.id, c]));
  const funderById = new Map(funders.map((f) => [f.id, f]));
  const rows: MatrixRow[] = editions
    .filter((e) => e.year === year)
    .map((e) => {
      const byFunder = new Map<string, MatrixLine[]>();
      for (const l of e.fundingLines) byFunder.set(l.funderId, [...(byFunder.get(l.funderId) ?? []), l]);
      const cells = new Map<string, Cell>();
      for (const [fid, lines] of byFunder) { const c = cellOf(lines, convById); if (c) cells.set(fid, c); }
      const granted = e.fundingLines.reduce((s, l) => s + (l.amountGranted ?? 0), 0);
      const requested = e.fundingLines.reduce((s, l) => s + (l.amountRequested ?? 0), 0);
      return { edition: e, cells, granted, requested, coverage: e.budgetEnvelope ? granted / e.budgetEnvelope : null, orphan: e.fundingLines.length === 0, pending: e.fundingLines.filter((l) => PENDING.has(l.status)).length };
    })
    .sort((a, b) => a.edition.project.pole.name.localeCompare(b.edition.project.pole.name, "fr") || a.edition.project.name.localeCompare(b.edition.project.name, "fr"));

  const colMap = new Map<string, MatrixColumn>();
  for (const r of rows) {
    for (const [fid, c] of r.cells) {
      const f = funderById.get(fid); if (!f) continue;
      const col = colMap.get(fid) ?? { funder: f, granted: 0, requested: 0, editions: 0, late: 0 };
      col.granted += c.kind === "granted" ? c.amount ?? 0 : 0;
      col.requested += c.kind === "requested" ? c.amount ?? 0 : 0;
      col.editions += 1; col.late += c.late;
      colMap.set(fid, col);
    }
  }
  const columns = [...colMap.values()].sort((a, b) => b.granted - a.granted || b.requested - a.requested || a.funder.name.localeCompare(b.funder.name, "fr"));

  const underAllocated = conventions
    .filter((c) => c.startYear <= year && year <= c.endYear && c.amountNotified !== null)
    .map((c) => ({ convention: c, remaining: (c.amountNotified ?? 0) - c.lines.reduce((s, l) => s + (l.amountGranted ?? 0), 0) }))
    .filter((x) => x.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  return {
    year, rows, columns,
    totals: { granted: rows.reduce((s, r) => s + r.granted, 0), requested: rows.reduce((s, r) => s + r.requested, 0), envelope: rows.reduce((s, r) => s + (r.edition.budgetEnvelope ?? 0), 0) },
    attention: {
      orphans: rows.filter((r) => r.orphan).map((r) => r.edition),
      pending: rows.filter((r) => r.pending > 0 && r.edition.status === "in_progress").map((r) => ({ edition: r.edition, funders: r.edition.fundingLines.filter((l) => PENDING.has(l.status)).map((l) => funderById.get(l.funderId)?.name ?? "?") })),
      underAllocated,
      lateByFunder: columns.filter((c) => c.late > 0).map((c) => ({ funder: c.funder, count: c.late })).sort((a, b) => b.count - a.count),
    },
  };
}

// Lecture d'une couverture : vert dès que l'obtenu approche l'enveloppe de dépenses directes, ocre en dessous. Au-delà de 100 %
// n'est pas une anomalie : la subvention finance aussi les jours vendus (temps), pas seulement les dépenses directes.
export function coverageTone(coverage: number | null): "mint" | "warning" | "muted" {
  if (coverage === null) return "muted";
  return coverage >= 0.9 ? "mint" : "warning";
}

// Export CSV : une ligne par édition, une colonne par financeur (obtenu ; demandé entre parenthèses), puis totaux.
export function matrixToCsv(m: Matrix): string {
  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Math.round(n)).replace(".", ","));
  const head = ["pole", "projet", "code", "edition", "enveloppe", ...m.columns.map((c) => c.funder.name), "obtenu", "demande", "couverture"];
  const lines = m.rows.map((r) => [
    r.edition.project.pole.name, r.edition.project.name, r.edition.project.analyticCode, String(r.edition.year), fmt(r.edition.budgetEnvelope),
    ...m.columns.map((c) => { const cell = r.cells.get(c.funder.id); return !cell ? "" : cell.kind === "granted" ? fmt(cell.amount) : cell.kind === "requested" ? `(${fmt(cell.amount)})` : `à déposer${cell.amount ? ` ${fmt(cell.amount)}` : ""}`; }),
    fmt(r.granted), fmt(r.requested), r.coverage === null ? "" : `${Math.round(r.coverage * 100)} %`,
  ]);
  const foot = ["", "Total", "", String(m.year), fmt(m.totals.envelope), ...m.columns.map((c) => fmt(c.granted)), fmt(m.totals.granted), fmt(m.totals.requested), ""];
  return [head, ...lines, foot].map((r) => r.map((v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(";")).join("\n");
}
