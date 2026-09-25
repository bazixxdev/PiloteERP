import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { csvCell } from "@/lib/csv";
import { sessionExportAllowed } from "@/lib/export-auth";
import { loadBudgetPlan } from "@/lib/budget-plan-db";
import { getCurrentPerson } from "@/lib/session";

// Export CSV du budget prévisionnel d'une édition (25/09). Totaux par catégorie seulement : jamais le détail par personne.
// Les montants sont calculés par l'outil (nombres) ; seules les chaînes saisies passent par csvCell (SEC-13).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionExportAllowed(req))) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const me = await getCurrentPerson();
  const { id } = await params;
  const e = await prisma.edition.findUnique({ where: { id }, select: { id: true, year: true, projectId: true, project: { select: { analyticCode: true } } } });
  if (!e) return new NextResponse("Introuvable", { status: 404 });
  const plan = await loadBudgetPlan(e, me);
  const n = (x: number) => x.toFixed(2).replace(".", ",");
  const rows = [
    ["Catégorie", "Prévu", "Réalisé retenu", "Réalisé calculé", "Engagé restant", "Écart", "% consommé", "Saisie manuelle : motif"].map(csvCell).join(";"),
    ...plan.table.rows.map((r) => [csvCell(r.label), n(r.planned), n(r.actual), n(r.computed), n(r.engaged), n(r.gap), r.pct === null ? "" : String(r.pct), csvCell(r.override?.reason ?? "")].join(";")),
    ...(plan.table.unclassified ? [[csvCell("Non classé"), "", n(plan.table.unclassified), n(plan.table.unclassified), "", "", "", ""].join(";")] : []),
    [csvCell("Total"), n(plan.table.totals.planned), n(plan.table.totals.actual), "", n(plan.table.totals.engaged), n(plan.table.totals.gap), "", ""].join(";"),
  ];
  return new NextResponse("﻿" + rows.join("\r\n") + "\r\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="budget-previsionnel-${e.project.analyticCode}-${e.year}.csv"` } });
}
