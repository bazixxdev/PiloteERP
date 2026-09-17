import { NextResponse } from "next/server";
import { listFunders } from "@/lib/organisations";
import { prisma } from "@/lib/db";
import { exportAllowed } from "@/lib/export-auth";
import { buildMatrix, matrixToCsv } from "@/lib/matrix";

// Export CSV de « Qui finance quoi » (lot C) : une ligne par édition, une colonne par financeur ; depuis l'outil ou avec le jeton
// d'API (Excel « À partir du web »). Toute la CRESS : le périmètre d'un pôle se filtre dans Excel par la colonne « pole ».
export async function GET(req: Request) {
  if (!(await exportAllowed(req))) return new NextResponse("Jeton d'API requis", { status: 401 });
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("annee")) || new Date().getFullYear();
  const [editions, funders, conventions] = await Promise.all([
    prisma.edition.findMany({ where: { year }, include: { project: { include: { pole: true, pilot: true } }, fundingLines: { include: { deliverables: true } } } }),
    listFunders(),
    prisma.convention.findMany({ include: { lines: { select: { id: true, amountGranted: true, editionId: true } } } }),
  ]);
  const csv = matrixToCsv(buildMatrix(year, editions, funders, conventions));
  return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="qui-finance-quoi-${year}.csv"` } });
}
