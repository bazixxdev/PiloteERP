// Réalisé comptable (lot D) — fonctions pures. Le grand livre analytique, d'où qu'il vienne (fichier xlsx/csv exporté du logiciel
// de compta, API Pennylane…), arrive sous forme de lignes brutes ; on les agrège par (code analytique, compte, exercice) en un
// snapshot sans clé étrangère, puis on rapproche par le code : ligne de financement, projet (donc l'édition de l'année), ou une
// correspondance posée à la main (édition, action, code à ignorer). Patron LigneRealise d'erp-tlst.

export type RawEntry = { analyticCode: string; accountNumber: string; accountLabel?: string; date?: string; piece?: string; thirdParty?: string; label?: string; debit: number; credit: number };
export type Aggregated = { analyticCode: string; accountNumber: string; accountLabel: string | null; year: number; debit: number; credit: number; detail: RawEntry[] };

export type LedgerLineLike = { analyticCode: string; accountNumber: string; accountLabel: string | null; year: number; debit: number; credit: number; detail?: string | null; source: string };
export type TagLike = { code: string; targetKind: string; targetId: string | null };

export const SOURCE_LABEL: Record<string, string> = { file: "Fichier importé", pennylane: "Pennylane" };

// Comptes : 6 = charges, 7 = produits ; 625 = déplacements, missions, réceptions (les frais, au sens des notes de frais).
export function isCharge(account: string): boolean { return account.startsWith("6"); }
export function isProduct(account: string): boolean { return account.startsWith("7"); }
export function isTravelExpense(account: string): boolean { return account.startsWith("625"); }

// Montant « signé » d'une ligne : une charge se lit débit − crédit, un produit crédit − débit.
export function amountOf(l: Pick<LedgerLineLike, "accountNumber" | "debit" | "credit">): number {
  return isProduct(l.accountNumber) ? l.credit - l.debit : l.debit - l.credit;
}

// ---- Lecture d'un fichier : en-têtes reconnus en français et en anglais, insensibles à la casse et aux accents ----

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const COLUMNS: Record<keyof RawEntry, string[]> = {
  analyticCode: ["code analytique", "analytique", "axe analytique", "analytical axis", "category", "categorie", "section analytique", "code"],
  accountNumber: ["compte", "numero de compte", "n compte", "plan item number", "account", "compte general", "numero"],
  accountLabel: ["libelle compte", "intitule compte", "plan item label", "account label", "libelle du compte"],
  date: ["date", "date piece", "date ecriture"],
  piece: ["piece", "numero de piece", "piece number", "n piece", "reference"],
  thirdParty: ["tiers", "thirdparty", "third party", "fournisseur"],
  label: ["libelle", "libelle ecriture", "line label", "label", "intitule"],
  debit: ["debit"],
  credit: ["credit"],
};

// Associe chaque champ à l'en-tête trouvé (le premier candidat présent) ; renvoie les champs manquants pour un message clair.
export function mapHeaders(headers: string[]): { map: Partial<Record<keyof RawEntry, number>>; missing: (keyof RawEntry)[] } {
  const normalized = headers.map(norm);
  const map: Partial<Record<keyof RawEntry, number>> = {};
  for (const [field, candidates] of Object.entries(COLUMNS) as [keyof RawEntry, string[]][]) {
    for (const c of candidates) {
      const i = normalized.findIndex((h) => h === c || (c.length > 4 && h.startsWith(c)));
      if (i >= 0 && !Object.values(map).includes(i)) { map[field] = i; break; }
    }
  }
  const missing = (["analyticCode", "accountNumber", "debit", "credit"] as (keyof RawEntry)[]).filter((f) => map[f] === undefined);
  return { map, missing };
}

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/\s/g, "").replace(/€/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// Lignes brutes depuis un tableau (première ligne = en-têtes). Les lignes sans code analytique ni compte sont ignorées.
export function rowsToEntries(rows: unknown[][]): { entries: RawEntry[]; missing: (keyof RawEntry)[]; skipped: number } {
  if (rows.length < 2) return { entries: [], missing: ["analyticCode", "accountNumber", "debit", "credit"], skipped: 0 };
  const { map, missing } = mapHeaders(rows[0].map((h) => String(h ?? "")));
  if (missing.length) return { entries: [], missing, skipped: 0 };
  const get = (r: unknown[], f: keyof RawEntry) => (map[f] === undefined ? undefined : r[map[f]!]);
  const entries: RawEntry[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const analyticCode = String(get(r, "analyticCode") ?? "").trim();
    const accountNumber = String(get(r, "accountNumber") ?? "").trim();
    if (!analyticCode || !accountNumber) { skipped++; continue; }
    entries.push({
      analyticCode, accountNumber,
      accountLabel: get(r, "accountLabel") ? String(get(r, "accountLabel")) : undefined,
      date: get(r, "date") ? toIsoDate(get(r, "date")) : undefined,
      piece: get(r, "piece") ? String(get(r, "piece")) : undefined,
      thirdParty: get(r, "thirdParty") ? String(get(r, "thirdParty")) : undefined,
      label: get(r, "label") ? String(get(r, "label")) : undefined,
      debit: num(get(r, "debit")), credit: num(get(r, "credit")),
    });
  }
  return { entries, missing: [], skipped };
}

// Dates : ISO, JJ/MM/AAAA, ou numéro de série Excel.
export function toIsoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return d.toISOString().slice(0, 10); }
  const s = String(v ?? "").trim();
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (fr) return `${fr[3].length === 2 ? "20" + fr[3] : fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  return s.slice(0, 10);
}

// Agrégation par (code, compte, exercice) — l'exercice vient de la date de la pièce, sinon de l'exercice demandé.
export function aggregate(entries: RawEntry[], defaultYear: number): Aggregated[] {
  const map = new Map<string, Aggregated>();
  for (const e of entries) {
    const year = e.date && /^\d{4}/.test(e.date) ? Number(e.date.slice(0, 4)) : defaultYear;
    const key = `${e.analyticCode}|${e.accountNumber}|${year}`;
    const a = map.get(key) ?? { analyticCode: e.analyticCode, accountNumber: e.accountNumber, accountLabel: e.accountLabel ?? null, year, debit: 0, credit: 0, detail: [] };
    a.debit += e.debit; a.credit += e.credit; a.accountLabel = a.accountLabel ?? e.accountLabel ?? null; a.detail.push(e);
    map.set(key, a);
  }
  return [...map.values()];
}

// ---- Rapprochement par le code analytique ----

export type Target = { kind: "project" | "edition" | "action" | "fundingLine" | "ignore"; editionId: string | null; id: string | null };
export type ResolveContext = {
  tags: TagLike[];
  projects: { id: string; analyticCode: string }[];
  editions: { id: string; projectId: string; year: number }[];
  fundingLines: { id: string; editionId: string; analyticCode: string | null }[];
  actions: { id: string; editionId: string }[];
};

// Ordre : correspondance posée à la main, puis ligne de financement, puis projet (édition de l'exercice). Sinon inconnu.
export function resolveCode(code: string, year: number, ctx: ResolveContext): Target | null {
  const tag = ctx.tags.find((t) => t.code === code);
  if (tag) {
    if (tag.targetKind === "ignore") return { kind: "ignore", editionId: null, id: null };
    if (tag.targetKind === "edition") return { kind: "edition", editionId: tag.targetId, id: tag.targetId };
    if (tag.targetKind === "action") { const a = ctx.actions.find((x) => x.id === tag.targetId); return a ? { kind: "action", editionId: a.editionId, id: a.id } : null; }
    if (tag.targetKind === "fundingLine") { const l = ctx.fundingLines.find((x) => x.id === tag.targetId); return l ? { kind: "fundingLine", editionId: l.editionId, id: l.id } : null; }
    if (tag.targetKind === "project") { const e = ctx.editions.find((x) => x.projectId === tag.targetId && x.year === year); return { kind: "project", editionId: e?.id ?? null, id: tag.targetId }; }
  }
  // Un code de ligne se répète souvent d'une année sur l'autre (FSE-26, FSE-27…) : on prend la ligne dont l'édition est de l'exercice.
  const lines = ctx.fundingLines.filter((l) => l.analyticCode === code);
  if (lines.length) {
    const yearOf = (l: { editionId: string }) => ctx.editions.find((e) => e.id === l.editionId)?.year;
    const line = lines.find((l) => yearOf(l) === year) ?? lines[0];
    return { kind: "fundingLine", editionId: line.editionId, id: line.id };
  }
  const project = ctx.projects.find((p) => p.analyticCode === code);
  if (project) { const e = ctx.editions.find((x) => x.projectId === project.id && x.year === year); return { kind: "project", editionId: e?.id ?? null, id: project.id }; }
  return null;
}

export type EditionRealized = {
  charges: number; products: number; travel: number;
  byAccount: { accountNumber: string; accountLabel: string | null; amount: number; lines: LedgerLineLike[] }[];
  byAction: Map<string, number>;
  byFundingLine: Map<string, { charges: number; products: number }>;
  sources: string[];
  unknownCodes: string[];
};

// Réalisé d'une édition : toutes les lignes dont le code se résout vers elle pour son exercice.
export function realizedOfEdition(edition: { id: string; year: number }, lines: LedgerLineLike[], ctx: ResolveContext): EditionRealized {
  const out: EditionRealized = { charges: 0, products: 0, travel: 0, byAccount: [], byAction: new Map(), byFundingLine: new Map(), sources: [], unknownCodes: [] };
  const accounts = new Map<string, { accountNumber: string; accountLabel: string | null; amount: number; lines: LedgerLineLike[] }>();
  for (const l of lines) {
    if (l.year !== edition.year) continue;
    const t = resolveCode(l.analyticCode, l.year, ctx);
    if (!t) { if (!out.unknownCodes.includes(l.analyticCode)) out.unknownCodes.push(l.analyticCode); continue; }
    if (t.kind === "ignore" || t.editionId !== edition.id) continue;
    const amount = amountOf(l);
    if (isCharge(l.accountNumber)) { out.charges += amount; if (isTravelExpense(l.accountNumber)) out.travel += amount; }
    else if (isProduct(l.accountNumber)) out.products += amount;
    else continue; // 4xx / 5xx : contreparties, pas de montant utile
    if (!out.sources.includes(l.source)) out.sources.push(l.source);
    const a = accounts.get(l.accountNumber) ?? { accountNumber: l.accountNumber, accountLabel: l.accountLabel, amount: 0, lines: [] };
    a.amount += amount; a.lines.push(l); a.accountLabel = a.accountLabel ?? l.accountLabel; accounts.set(l.accountNumber, a);
    if (t.kind === "action" && t.id && isCharge(l.accountNumber)) out.byAction.set(t.id, (out.byAction.get(t.id) ?? 0) + amount);
    if (t.kind === "fundingLine" && t.id) { const f = out.byFundingLine.get(t.id) ?? { charges: 0, products: 0 }; if (isCharge(l.accountNumber)) f.charges += amount; else f.products += amount; out.byFundingLine.set(t.id, f); }
  }
  out.byAccount = [...accounts.values()].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  return out;
}

// Charges par édition pour toute une liste (portefeuille, alertes) : une passe.
export function chargesByEdition(editions: { id: string; year: number }[], lines: LedgerLineLike[], ctx: ResolveContext): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of lines) {
    if (!isCharge(l.accountNumber)) continue;
    const t = resolveCode(l.analyticCode, l.year, ctx);
    if (!t || t.kind === "ignore" || !t.editionId) continue;
    const e = editions.find((x) => x.id === t.editionId);
    if (!e || e.year !== l.year) continue;
    out.set(e.id, (out.get(e.id) ?? 0) + amountOf(l));
  }
  return out;
}

// Codes présents dans le réalisé que rien ne reconnaît : à rapprocher dans l'admin.
export function unknownCodes(lines: LedgerLineLike[], ctx: ResolveContext): { code: string; year: number; amount: number; sample: string | null }[] {
  const map = new Map<string, { code: string; year: number; amount: number; sample: string | null }>();
  for (const l of lines) {
    if (resolveCode(l.analyticCode, l.year, ctx)) continue;
    const key = `${l.analyticCode}|${l.year}`;
    const u = map.get(key) ?? { code: l.analyticCode, year: l.year, amount: 0, sample: l.accountLabel };
    u.amount += Math.abs(amountOf(l)); map.set(key, u);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}
