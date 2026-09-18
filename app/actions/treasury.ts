"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canManageTreasury } from "@/lib/rights";
import { DIRECTIONS, isMonth, PERIODS } from "@/lib/treasury";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const DENIED = "La trésorerie se tient par la direction ou la RAF (droit « Tient la trésorerie »).";
const clean = (v: unknown) => { const s = v == null ? "" : String(v).trim(); return s || null; };

async function guard() {
  const me = await getCurrentPerson();
  return { me, denied: canManageTreasury(me) ? null : DENIED };
}

export type CashRuleForm = { label: string; direction: string; category: string; amount: number | string; period: string; startMonth: string; endMonth?: string | null; notes?: string | null; active?: boolean };

function validate(input: CashRuleForm): { ok: true; data: { label: string; direction: string; category: string; amount: number; period: string; startMonth: string; endMonth: string | null; notes: string | null } } | { ok: false; error: string } {
  const label = clean(input.label); if (!label) return { ok: false, error: "Donnez un libellé." };
  if (!DIRECTIONS.some((d) => d.value === input.direction)) return { ok: false, error: "Sens inconnu." };
  const category = clean(input.category) ?? (input.direction === "in" ? "Autres encaissements" : "Autres décaissements");
  const amount = Number(String(input.amount).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Montant invalide." };
  if (!PERIODS.some((p) => p.value === input.period)) return { ok: false, error: "Périodicité inconnue." };
  if (!isMonth(input.startMonth)) return { ok: false, error: "Mois de début invalide (AAAA-MM)." };
  const endMonth = clean(input.endMonth);
  if (endMonth && !isMonth(endMonth)) return { ok: false, error: "Mois de fin invalide (AAAA-MM)." };
  if (endMonth && endMonth < input.startMonth) return { ok: false, error: "Le mois de fin précède le début." };
  return { ok: true, data: { label, direction: input.direction, category, amount, period: input.period, startMonth: input.startMonth, endMonth: input.period === "once" ? null : endMonth, notes: clean(input.notes) } };
}

export async function createCashRule(input: CashRuleForm): Promise<Result<{ id: string }>> {
  const { me, denied } = await guard(); if (denied) return { ok: false, error: denied };
  const v = validate(input); if (!v.ok) return v;
  const r = await prisma.cashRule.create({ data: { ...v.data, createdById: me.id } });
  revalidatePath("/tresorerie");
  return { ok: true, data: { id: r.id } };
}

export async function updateCashRule(id: string, input: CashRuleForm): Promise<Result> {
  const { denied } = await guard(); if (denied) return { ok: false, error: denied };
  const v = validate(input); if (!v.ok) return v;
  await prisma.cashRule.update({ where: { id }, data: { ...v.data, ...(input.active !== undefined ? { active: Boolean(input.active) } : {}) } });
  revalidatePath("/tresorerie");
  return { ok: true };
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
