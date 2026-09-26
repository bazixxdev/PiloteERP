import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exportDenial } from "@/lib/export-auth";
import { getCurrentPersonOrNull, getSettings } from "@/lib/session";
import { canSeeTimeOf } from "@/lib/rights";
import { loadFundedActions } from "@/lib/funded-actions-db";
import { fundedActionsCsv } from "@/lib/funded-actions";

// Export CSV des actions financées et de leur temps (`projet;action;personne;heures;montant`) : `?ligne=<id>` (l'année de la
// ligne) ou `?dossier=<id>&annee=2026` (les lignes du dossier cette année-là). Qui ? la même garde que « Qui finance quoi »
// (codir.access : les montants par financeur) : depuis l'outil, ou avec le jeton d'API pour Excel. Les heures par personne
// suivent en plus la visibilité du temps de la personne connectée (canSeeTimeOf, comme la page de l'action) : un droit sur les
// montants n'ouvre pas le temps des autres ; le jeton d'API, crédence globale (comme l'export de clôture), voit tout.
export async function GET(req: Request) {
  const denied = await exportDenial(req, "codir.access");
  if (denied) return new NextResponse(denied.message, { status: denied.status });
  const url = new URL(req.url);
  const ligne = url.searchParams.get("ligne");
  const dossier = url.searchParams.get("dossier");
  const annee = url.searchParams.get("annee");
  // Paramètres validés avant toute requête : un identifiant ou une année mal formés répondent 400, jamais 500.
  const ID = /^[A-Za-z0-9_-]{1,64}$/;
  if (ligne !== null && !ID.test(ligne)) return bad("Paramètre « ligne » invalide : identifiant de ligne de financement attendu.");
  if (dossier !== null && !ID.test(dossier)) return bad("Paramètre « dossier » invalide : identifiant de dossier attendu.");
  if (annee !== null && !(/^\d{4}$/.test(annee) && Number(annee) >= 2000 && Number(annee) <= 2100)) return bad("Paramètre « annee » invalide : une année entre 2000 et 2100 est attendue.");

  let lineIds: string[];
  let year: number;
  if (ligne) {
    const line = await prisma.fundingLine.findUnique({ where: { id: ligne }, select: { id: true, edition: { select: { year: true } } } });
    if (!line) return new NextResponse("Introuvable", { status: 404 });
    lineIds = [line.id];
    year = line.edition.year;
  } else if (dossier) {
    year = annee !== null ? Number(annee) : new Date().getFullYear();
    const c = await prisma.convention.findUnique({ where: { id: dossier }, select: { lines: { where: { edition: { year } }, select: { id: true } } } });
    if (!c) return new NextResponse("Introuvable", { status: 404 });
    lineIds = c.lines.map((l) => l.id);
  } else {
    return bad("Paramètre « ligne » ou « dossier » requis.");
  }

  // Jeton présenté (déjà vérifié par exportDenial) : tout le détail. Session : la visibilité du temps de la personne.
  const byToken = Boolean(url.searchParams.get("jeton"));
  const [me, settings] = byToken ? [null, null] : await Promise.all([getCurrentPersonOrNull(), getSettings()]);
  const items = await loadFundedActions(lineIds, (p) => byToken || (me !== null && settings !== null && canSeeTimeOf(me, p, settings.timeVisibility)));
  return new NextResponse("\uFEFF" + fundedActionsCsv(items), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="financements-temps-${year}.csv"` },
  });
}

function bad(message: string) {
  return new NextResponse(message, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
