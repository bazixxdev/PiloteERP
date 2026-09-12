import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dayjs } from "@/lib/format";

// Export mensuel des temps, agrégé par projet ou par personne (EF-D5), vers l'Excel de la RAF.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("mois") ?? dayjs().format("YYYY-MM");
  const par = url.searchParams.get("par") === "personne" ? "personne" : "projet";
  const start = dayjs(month + "-01");
  const entries = await prisma.timeEntry.findMany({ where: { date: { gte: start.toDate(), lt: start.add(1, "month").toDate() } }, include: { person: true, project: true, action: true, timeCode: true } });

  const agg = new Map<string, { a: string; b: string; c: string; hours: number }>();
  for (const t of entries) {
    const projet = t.project?.name ?? `[${t.timeCode?.code ?? "?"}] ${t.timeCode?.label ?? ""}`;
    const code = t.project?.analyticCode ?? t.timeCode?.code ?? "";
    const key = par === "projet" ? `${projet}|${t.action?.name ?? ""}|${t.person.name}` : `${t.person.name}|${projet}|${t.action?.name ?? ""}`;
    const row = agg.get(key) ?? (par === "projet" ? { a: projet, b: t.action?.name ?? "", c: t.person.name, hours: 0 } : { a: t.person.name, b: projet, c: t.action?.name ?? "", hours: 0 });
    row.hours += t.hours;
    agg.set(key, { ...row, c: par === "projet" ? row.c : row.c || code });
  }
  const headers = par === "projet" ? ["projet", "action", "personne", "heures", "jours"] : ["personne", "projet", "action", "heures", "jours"];
  const lines = [headers.join(";"), ...[...agg.values()].sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b)).map((r) => [r.a, r.b, r.c, r.hours.toFixed(2).replace(".", ","), (r.hours / 7).toFixed(2).replace(".", ",")].join(";"))];
  return new NextResponse("﻿" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="temps-${month}-par-${par}.csv"` } });
}
