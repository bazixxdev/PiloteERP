"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";
import { aggregate, rowsToEntries, type Aggregated, type RawEntry } from "@/lib/ledger";
import { entriesFromWorkbook, fetchAnalyticalLedger, pennylaneConfig, PennylaneError } from "@/lib/pennylane";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const DENIED = "Le réalisé comptable s'importe par la RAF ou la direction.";

// Écriture du snapshot d'une source pour un exercice : remplace (purge + insertion) — rejouer donne le même résultat.
async function writeSnapshot(source: string, year: number, agg: Aggregated[], meta: { fileName?: string | null; rows: number; byId: string }) {
  const forYear = agg.filter((a) => a.year === year);
  await prisma.$transaction([
    prisma.ledgerLine.deleteMany({ where: { source, year } }),
    ...forYear.map((a) => prisma.ledgerLine.create({ data: { source, analyticCode: a.analyticCode, accountNumber: a.accountNumber, accountLabel: a.accountLabel, year: a.year, debit: Math.round(a.debit * 100) / 100, credit: Math.round(a.credit * 100) / 100, detail: JSON.stringify(a.detail.slice(0, 200)) } })),
    prisma.ledgerImport.create({ data: { source, year, fileName: meta.fileName ?? null, lines: forYear.length, rows: meta.rows, byId: meta.byId } }),
  ]);
  return forYear.length;
}

// Import d'un fichier xlsx / csv du grand livre analytique (la base : marche avec n'importe quel logiciel de compta).
export async function importLedgerFile(form: FormData): Promise<Result<{ lines: number; rows: number; skipped: number; ignoredYears: number }>> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me.role)) return { ok: false, error: DENIED };
  const year = Number(form.get("year"));
  const file = form.get("file");
  if (!year || !(file instanceof File)) return { ok: false, error: "Indiquez l'exercice et choisissez un fichier." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Fichier trop volumineux (10 Mo maximum)." };
  let entries: RawEntry[]; let skipped = 0;
  try {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      entries = entriesFromWorkbook(new Uint8Array(await file.arrayBuffer()));
    } else {
      const text = await file.text();
      const sep = text.split("\n")[0]?.includes(";") ? ";" : ",";
      const rows = text.replace(/\r/g, "").split("\n").filter((l) => l.trim()).map((l) => splitCsv(l, sep));
      const r = rowsToEntries(rows);
      if (r.missing.length) return { ok: false, error: `Colonnes introuvables dans le fichier : ${r.missing.map(colLabel).join(", ")}. Attendu : code analytique, compte, débit, crédit (+ libellé, date, pièce, tiers facultatifs).` };
      entries = r.entries; skipped = r.skipped;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fichier illisible." };
  }
  if (entries.length === 0) return { ok: false, error: "Aucune ligne exploitable dans le fichier." };
  const agg = aggregate(entries, year);
  const lines = await writeSnapshot("file", year, agg, { fileName: file.name, rows: entries.length, byId: me.id });
  revalidatePath("/", "layout");
  return { ok: true, data: { lines, rows: entries.length, skipped, ignoredYears: agg.length - agg.filter((a) => a.year === year).length } };
}

function splitCsv(l: string, sep: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur);
  return out.map((s) => s.trim());
}

const colLabel = (f: string) => ({ analyticCode: "code analytique", accountNumber: "compte", debit: "débit", credit: "crédit" } as Record<string, string>)[f] ?? f;

// Synchronisation Pennylane d'un exercice : même snapshot, source « pennylane ». Sans jeton : message clair, rien ne casse.
export async function syncPennylane(year: number): Promise<Result<{ lines: number; rows: number }>> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me.role)) return { ok: false, error: DENIED };
  const cfg = pennylaneConfig();
  if (!cfg) return { ok: false, error: "Pennylane n'est pas configuré (PENNYLANE_API_TOKEN absent) : importez le fichier exporté depuis le logiciel de compta." };
  try {
    const settings = await getSettings();
    let entries = await fetchAnalyticalLedger(year, cfg);
    const axes = settings.pennylaneAxes.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (axes.length) entries = entries.filter((e) => axes.some((a) => e.analyticCode.toLowerCase().startsWith(a)));
    const lines = await writeSnapshot("pennylane", year, aggregate(entries, year), { rows: entries.length, byId: me.id });
    revalidatePath("/", "layout");
    return { ok: true, data: { lines, rows: entries.length } };
  } catch (e) {
    return { ok: false, error: e instanceof PennylaneError ? e.message : `Pennylane injoignable : ${e instanceof Error ? e.message : "erreur inconnue"}` };
  }
}

// Correspondance d'un code inconnu : vers une édition, une action, un projet, une ligne… ou « à ignorer » (fonctionnement).
export async function setAnalyticTag(code: string, targetKind: string, targetId: string | null, note?: string | null): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me.role)) return { ok: false, error: DENIED };
  if (!["project", "edition", "action", "fundingLine", "ignore"].includes(targetKind)) return { ok: false, error: "Cible inconnue." };
  if (targetKind !== "ignore" && !targetId) return { ok: false, error: "Choisissez la cible." };
  await prisma.analyticTag.upsert({ where: { code }, create: { code, targetKind, targetId: targetKind === "ignore" ? null : targetId, note: note ?? null }, update: { targetKind, targetId: targetKind === "ignore" ? null : targetId, note: note ?? null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAnalyticTag(code: string): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me.role)) return { ok: false, error: DENIED };
  await prisma.analyticTag.delete({ where: { code } }).catch(() => null);
  revalidatePath("/", "layout");
  return { ok: true };
}

// Effacer le snapshot d'une source pour un exercice (réimport propre).
export async function clearLedger(source: string, year: number): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me.role)) return { ok: false, error: DENIED };
  await prisma.ledgerLine.deleteMany({ where: { source, year } });
  revalidatePath("/", "layout");
  return { ok: true };
}
