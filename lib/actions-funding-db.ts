import type { Prisma } from "@prisma/client";
import { runsIn } from "./actions";

// Pas de « use server » : écriture interne, appelée DANS la transaction d'une commande déjà gardée (rattachement d'une année
// à un dossier, reconduction). Une nouvelle ligne d'un dossier rejoint les actions du projet déjà financées par ce dossier et
// qui courent cette année-là (spec actions § 2), sans montant : il reste à le répartir.
export async function linkNewLineToRunningActions(tx: Prisma.TransactionClient, line: { id: string; conventionId: string | null; editionId: string }) {
  if (!line.conventionId) return;
  const edition = await tx.edition.findUnique({ where: { id: line.editionId }, select: { year: true, projectId: true } });
  if (!edition) return;
  const actions = await tx.action.findMany({
    where: { projectId: edition.projectId, fundings: { some: { fundingLine: { conventionId: line.conventionId } } } },
    select: { id: true, startDate: true, endDate: true },
  });
  const running = actions.filter((a) => a.startDate && a.endDate && runsIn({ startDate: a.startDate, endDate: a.endDate }, edition.year));
  for (const a of running) {
    await tx.actionFunding.upsert({ where: { actionId_fundingLineId: { actionId: a.id, fundingLineId: line.id } }, create: { actionId: a.id, fundingLineId: line.id }, update: {} });
  }
}
