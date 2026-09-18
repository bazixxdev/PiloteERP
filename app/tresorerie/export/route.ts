import { NextResponse } from "next/server";
import { getCurrentPersonOrNull, getSettings } from "@/lib/session";
import { canViewTreasury } from "@/lib/rights";
import { buildPlan, isMonth, loadCashRules, loadDerivedFlows, planToCsv, thisMonth } from "@/lib/treasury";

// Export CSV du plan de trésorerie (douze mois) ; réservé à qui consulte la trésorerie.
export async function GET() {
  const me = await getCurrentPersonOrNull();
  if (!me) return new NextResponse("Connexion requise", { status: 401 });
  if (!canViewTreasury(me)) return new NextResponse("Réservé", { status: 403 });
  const settings = await getSettings();
  const openingMonth = isMonth(settings.cashOpeningMonth) ? settings.cashOpeningMonth : thisMonth();
  const [rules, derived] = await Promise.all([loadCashRules(), loadDerivedFlows(openingMonth)]);
  const plan = buildPlan({ openingMonth, opening: settings.cashOpeningBalance, threshold: settings.cashAlertThreshold, rules, derived });
  return new NextResponse(planToCsv(plan), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tresorerie-${openingMonth}.csv"` } });
}
