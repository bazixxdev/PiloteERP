import { prisma } from "./db";
import { chargesByEdition, realizedOfEdition, unknownCodes, type LedgerLineLike, type ResolveContext } from "./ledger";

// Réalisé comptable : accès base (le calcul est dans lib/ledger.ts). Le contexte de rapprochement = tout ce qui porte un code.
export async function loadResolveContext(): Promise<ResolveContext> {
  const [tags, projects, editions, fundingLines, actions] = await Promise.all([
    prisma.analyticTag.findMany(),
    prisma.project.findMany({ select: { id: true, analyticCode: true } }),
    prisma.edition.findMany({ select: { id: true, projectId: true, year: true } }),
    prisma.fundingLine.findMany({ select: { id: true, editionId: true, analyticCode: true } }),
    prisma.action.findMany({ select: { id: true, editionId: true } }),
  ]);
  return { tags, projects, editions, fundingLines, actions };
}

export async function loadLedger(year?: number): Promise<LedgerLineLike[]> {
  return prisma.ledgerLine.findMany({ where: year ? { year } : undefined, orderBy: [{ analyticCode: "asc" }, { accountNumber: "asc" }] });
}

// Réalisé d'une édition, avec le nom des sources et la date du dernier import.
export async function realizedForEdition(edition: { id: string; year: number }) {
  const [lines, ctx, imports] = await Promise.all([loadLedger(edition.year), loadResolveContext(), prisma.ledgerImport.findMany({ where: { year: edition.year }, orderBy: { importedAt: "desc" }, take: 5 })]);
  return { realized: realizedOfEdition(edition, lines, ctx), lastImport: imports[0] ?? null, hasLedger: lines.length > 0 };
}

// Charges comptables par édition (Map) pour une liste ; utilisée quand la source du réalisé est le grand livre.
export async function ledgerChargesFor(editions: { id: string; year: number }[]): Promise<Map<string, number>> {
  const years = [...new Set(editions.map((e) => e.year))];
  const [lines, ctx] = await Promise.all([prisma.ledgerLine.findMany({ where: { year: { in: years } } }), loadResolveContext()]);
  return chargesByEdition(editions, lines, ctx);
}

// Pose `ledgerSpent` sur chaque édition : le montant des charges comptables si la source réglée est le grand livre, sinon null
// (budgetOf retombe alors sur le réalisé saisi par la RAF). Une seule règle pour le portefeuille, l'édition, les alertes.
export async function attachLedgerSpent<T extends { id: string; year: number }>(editions: T[], settings: { realizedSource: string }): Promise<(T & { ledgerSpent: number | null })[]> {
  if (settings.realizedSource !== "ledger" || editions.length === 0) return editions.map((e) => ({ ...e, ledgerSpent: null }));
  const charges = await ledgerChargesFor(editions);
  return editions.map((e) => ({ ...e, ledgerSpent: charges.get(e.id) ?? 0 }));
}

export async function loadUnknownCodes() {
  const [lines, ctx] = await Promise.all([loadLedger(), loadResolveContext()]);
  return unknownCodes(lines, ctx);
}
