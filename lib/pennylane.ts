import { rowsToEntries, type RawEntry } from "./ledger";
import { readSpreadsheet } from "./spreadsheet";

// Connecteur Pennylane (lot D), repris du client d'erp-tlst : l'API v2 produit un export du grand livre analytique (xlsx) pour
// une période ; on le lit comme un fichier. Lecteur injectable pour les tests ; sans jeton, l'outil tourne sans (mode dégradé).
export type PennylaneConfig = { token: string; base: string };

export function pennylaneConfig(): PennylaneConfig | null {
  const token = process.env.PENNYLANE_API_TOKEN?.trim();
  if (!token) return null;
  return { token, base: (process.env.PENNYLANE_API_BASE ?? "https://app.pennylane.com/api/external/v2").replace(/\/$/, "") };
}

export class PennylaneError extends Error {}

type Fetcher = typeof fetch;

// Demande l'export, attend le fichier, le télécharge. `period_end` borné à aujourd'hui (l'API refuse le futur).
export async function fetchAnalyticalLedger(year: number, cfg: PennylaneConfig, f: Fetcher = fetch, waitMs = 2000, maxTries = 15): Promise<RawEntry[]> {
  const today = new Date().toISOString().slice(0, 10);
  const end = `${year}-12-31` < today ? `${year}-12-31` : today;
  const headers = { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json", Accept: "application/json" };
  const start = await f(`${cfg.base}/exports/analytical_general_ledgers`, { method: "POST", headers, body: JSON.stringify({ period_start: `${year}-01-01`, period_end: end, mode: "in_line" }) });
  if (start.status === 400) {
    const t = await start.text();
    if (/no result|aucun/i.test(t)) return []; // exercice vide : snapshot vide, pas une erreur
    throw new PennylaneError(`Pennylane refuse la demande d'export (${t.slice(0, 200)})`);
  }
  if (!start.ok) throw new PennylaneError(`Pennylane : HTTP ${start.status} à la demande d'export`);
  let job = (await start.json()) as { id: string; file_url?: string | null; status?: string };
  for (let i = 0; i < maxTries && !job.file_url; i++) {
    await new Promise((r) => setTimeout(r, waitMs));
    const st = await f(`${cfg.base}/exports/analytical_general_ledgers/${job.id}`, { headers });
    if (!st.ok) throw new PennylaneError(`Pennylane : HTTP ${st.status} en attendant l'export`);
    job = (await st.json()) as typeof job;
  }
  if (!job.file_url) throw new PennylaneError("Pennylane : l'export n'est pas prêt, réessayez dans une minute.");
  const file = await f(job.file_url);
  if (!file.ok) throw new PennylaneError(`Pennylane : HTTP ${file.status} au téléchargement du fichier`);
  const buf = new Uint8Array(await file.arrayBuffer());
  return entriesFromWorkbook(buf);
}

// Lecture d'un classeur (Pennylane ou fichier déposé) : première feuille, première ligne = en-têtes.
export async function entriesFromWorkbook(buf: Uint8Array): Promise<RawEntry[]> {
  const rows = await readSpreadsheet(buf, "export.xlsx");
  const r = rowsToEntries(rows);
  if (r.missing.length) throw new PennylaneError(`Colonnes introuvables : ${r.missing.join(", ")}`);
  return r.entries;
}
