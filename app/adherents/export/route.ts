import { NextResponse } from "next/server";
import { getCurrentPersonOrNull } from "@/lib/session";
import { loadMemberships, membershipsToCsv } from "@/lib/members";

// Export CSV des adhésions d'une année (?annee=) ; réservé aux personnes connectées.
export async function GET(req: Request) {
  const me = await getCurrentPersonOrNull();
  if (!me) return new NextResponse("Connexion requise", { status: 401 });
  const y = new URL(req.url).searchParams.get("annee");
  const year = y && /^\d{4}$/.test(y) ? Number(y) : new Date().getFullYear();
  return new NextResponse(membershipsToCsv(await loadMemberships(year)), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="adhesions-${year}.csv"` } });
}
