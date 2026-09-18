"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canManageTreasury } from "@/lib/rights";
import { addMonths, DIRECTIONS, HR_CATEGORY, isMonth, PERIODS } from "@/lib/treasury";
import { V, le } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const DENIED = `La trésorerie se tient par ${le(V.direction)} ou ${le(V.raf)} (droit « Tient la trésorerie »).`;
const clean = (v: unknown) => { const s = v == null ? "" : String(v).trim(); return s || null; };

async function guard() {
  const me = await getCurrentPerson();
  return { me, denied: canManageTreasury(me) ? null : DENIED };
}

export type CashRuleForm = { label: string; direction: string; category: string; amount: number | string; period: string; startMonth: string; endMonth?: string | null; notes?: string | null; active?: boolean; kind?: string; personId?: string | null };

function validate(input: CashRuleForm): { ok: true; data: { label: string; direction: string; category: string; amount: number; period: string; startMonth: string; endMonth: string | null; notes: string | null; kind: string; personId: string | null } } | { ok: false; error: string } {
  // Une ressource humaine : toujours un décaissement mensuel dans « Salaires et charges ».
  if (input.kind === "hr") input = { ...input, direction: "out", category: HR_CATEGORY, period: "monthly" };
  const label = clean(input.label); if (!label) return { ok: false, error: input.kind === "hr" ? "Donnez le nom de la personne ou du poste." : "Donnez un libellé." };
  if (!DIRECTIONS.some((d) => d.value === input.direction)) return { ok: false, error: "Sens inconnu." };
  const category = clean(input.category) ?? (input.direction === "in" ? "Autres encaissements" : "Autres décaissements");
  const amount = Number(String(input.amount).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Montant invalide." };
  if (!PERIODS.some((p) => p.value === input.period)) return { ok: false, error: "Périodicité inconnue." };
  if (!isMonth(input.startMonth)) return { ok: false, error: "Mois de début invalide (AAAA-MM)." };
  const endMonth = clean(input.endMonth);
  if (endMonth && !isMonth(endMonth)) return { ok: false, error: "Mois de fin invalide (AAAA-MM)." };
  if (endMonth && endMonth < input.startMonth) return { ok: false, error: "Le mois de fin précède le début." };
  return { ok: true, data: { label, direction: input.direction, category, amount, period: input.period, startMonth: input.startMonth, endMonth: input.period === "once" ? null : endMonth, notes: clean(input.notes), kind: input.kind === "hr" ? "hr" : "flow", personId: input.personId || null } };
}

export async function createCashRule(input: CashRuleForm): Promise<Result<{ id: string }>> {
  const { me, denied } = await guard(); if (denied) return { ok: false, error: denied };
  const v = validate(input); if (!v.ok) return v;
  const r = await prisma.cashRule.create({ data: { ...v.data, createdById: me.id } });
  revalidatePath("/tresorerie");
  return { ok: true, data: { id: r.id } };
}

// Modifier une règle. Avec `from` (AAAA-MM, après le premier mois) : le changement ne vaut qu'à partir de ce mois — l'ancienne
// règle s'arrête le mois d'avant, une nouvelle porte les valeurs modifiées (une embauche en mars, un loyer qui augmente en
// janvier : l'historique reste juste).
export async function updateCashRule(id: string, input: CashRuleForm, from?: string | null): Promise<Result<{ id: string }>> {
  const { me, denied } = await guard(); if (denied) return { ok: false, error: denied };
  const v = validate({ ...input, startMonth: from && isMonth(from) ? from : input.startMonth }); if (!v.ok) return v;
  const old = await prisma.cashRule.findUnique({ where: { id } });
  if (!old) return { ok: false, error: "Règle introuvable." };
  if (from && isMonth(from) && from > old.startMonth && old.period !== "once") {
    await prisma.cashRule.update({ where: { id }, data: { endMonth: addMonths(from, -1) } });
    const r = await prisma.cashRule.create({ data: { ...v.data, startMonth: from, createdById: me.id } });
    revalidatePath("/tresorerie");
    return { ok: true, data: { id: r.id } };
  }
  await prisma.cashRule.update({ where: { id }, data: { ...v.data, ...(input.active !== undefined ? { active: Boolean(input.active) } : {}) } });
  revalidatePath("/tresorerie");
  return { ok: true, data: { id } };
}

export async function toggleCashRule(id: string, active: boolean): Promise<Result> {
  const { denied } = await guard(); if (denied) return { ok: false, error: denied };
  await prisma.cashRule.update({ where: { id }, data: { active } });
  revalidatePath("/tresorerie");
  return { ok: true };
}

export async function deleteCashRule(id: string): Promise<Result> {
  const { denied } = await guard(); if (denied) return { ok: false, error: denied };
  await prisma.cashRule.delete({ where: { id } });
  revalidatePath("/tresorerie");
  return { ok: true };
}

// Solde de départ (relevé bancaire à un mois donné) et seuil d'alerte.
export async function setTreasuryOpening(input: { balance: number | string; month: string; threshold: number | string }): Promise<Result> {
  const { denied } = await guard(); if (denied) return { ok: false, error: denied };
  const balance = Number(String(input.balance).replace(/\s/g, "").replace(",", "."));
  const threshold = Number(String(input.threshold).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(balance)) return { ok: false, error: "Solde invalide." };
  if (!Number.isFinite(threshold) || threshold < 0) return { ok: false, error: "Seuil invalide." };
  if (!isMonth(input.month)) return { ok: false, error: "Mois invalide (AAAA-MM)." };
  await prisma.settings.update({ where: { id: 1 }, data: { cashOpeningBalance: balance, cashOpeningMonth: input.month, cashAlertThreshold: threshold } });
  revalidatePath("/tresorerie");
  return { ok: true };
}
