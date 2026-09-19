// Connecteur Brevo (18/09), repris du client d'erp-tlst : API v3, en-tête `api-key`, pagination, reprise sur 429. Sans clé,
// l'outil tourne sans (mode dégradé, comme Pennylane). Le lecteur est injectable pour les tests et les recettes pointent
// BREVO_API_BASE sur un faux serveur (tests/brevo-mock.mjs).

export type BrevoConfig = { key: string; base: string };

export function brevoConfig(): BrevoConfig | null {
  const key = process.env.BREVO_API_KEY?.trim();
  if (!key) return null;
  return { key, base: (process.env.BREVO_API_BASE ?? "https://api.brevo.com/v3").replace(/\/$/, "") };
}

export class BrevoError extends Error {}

type Fetcher = typeof fetch;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Un appel : paramètres en query, corps JSON, reprise simple sur 429 (contacts ≈ 10 requêtes / seconde côté Brevo).
export async function brevoCall<T>(cfg: BrevoConfig, path: string, opts: { method?: string; params?: Record<string, string | number>; body?: unknown } = {}, f: Fetcher = fetch): Promise<{ status: number; data: T | null }> {
  const url = new URL(`${cfg.base}${path}`);
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, String(v));
  for (let attempt = 1; ; attempt++) {
    const res = await f(url, { method: opts.method ?? "GET", headers: { "api-key": cfg.key, accept: "application/json", ...(opts.body !== undefined ? { "content-type": "application/json" } : {}) }, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, cache: "no-store" });
    if (res.status === 429 && attempt < 5) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 500);
      continue;
    }
    if (!res.ok) {
      let detail = "";
      try { const b = (await res.json()) as { message?: string; code?: string }; if (b?.message) detail = ` — ${b.message}${b.code ? ` (${b.code})` : ""}`; } catch { /* pas de corps */ }
      if (res.status === 401) throw new BrevoError("Brevo refuse la clé d'API (401) : vérifiez BREVO_API_KEY.");
      throw new BrevoError(`Brevo : ${opts.method ?? "GET"} ${path} → HTTP ${res.status}${detail}`);
    }
    if (res.status === 204) return { status: 204, data: null };
    const text = await res.text();
    return { status: res.status, data: text ? (JSON.parse(text) as T) : null };
  }
}

// ——— Types partiels (ce qu'on lit) ———
export type BrevoFolder = { id: number; name: string };
export type BrevoList = { id: number; name: string; folderId: number | null; folderName: string | null; totalSubscribers: number };
export type BrevoContact = { id: number; email?: string | null; attributes?: Record<string, unknown>; listIds?: number[]; emailBlacklisted?: boolean; smsBlacklisted?: boolean; modifiedAt?: string };

async function paged<T>(cfg: BrevoConfig, path: string, key: string, limit: number, f: Fetcher, params: Record<string, string | number> = {}): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += limit) {
    const { data } = await brevoCall<Record<string, T[] | number>>(cfg, path, { params: { ...params, limit, offset } }, f);
    const page = (data?.[key] as T[] | undefined) ?? [];
    out.push(...page);
    if (page.length < limit) break;
  }
  return out;
}

export async function listFolders(cfg: BrevoConfig, f: Fetcher = fetch): Promise<BrevoFolder[]> {
  return paged<BrevoFolder>(cfg, "/contacts/folders", "folders", 50, f);
}

// Toutes les listes, avec le nom de leur dossier.
export async function listLists(cfg: BrevoConfig, f: Fetcher = fetch): Promise<BrevoList[]> {
  const folders = new Map((await listFolders(cfg, f)).map((x) => [x.id, x.name]));
  // Brevo renvoie le nombre d'abonnés dans `uniqueSubscribers` ; `totalSubscribers` vaut 0 sur les comptes récents (constaté le
  // 19/09 sur le compte TLST : 975 contacts, « 0 abonné » partout). On lit l'un puis l'autre.
  const lists = await paged<Omit<BrevoList, "folderName"> & { uniqueSubscribers?: number }>(cfg, "/contacts/lists", "lists", 50, f);
  return lists.map((l) => ({ id: l.id, name: l.name, folderId: l.folderId ?? null, folderName: l.folderId != null ? folders.get(l.folderId) ?? null : null, totalSubscribers: l.uniqueSubscribers || l.totalSubscribers || 0 }));
}

// Tous les contacts du compte (50 par page, la limite de Brevo sur cette adresse), avec leurs listes et attributs.
export async function listAllContacts(cfg: BrevoConfig, f: Fetcher = fetch): Promise<BrevoContact[]> {
  return paged<BrevoContact>(cfg, "/contacts", "contacts", 50, f);
}

export async function listContactsOfList(cfg: BrevoConfig, listId: number, f: Fetcher = fetch): Promise<BrevoContact[]> {
  return paged<BrevoContact>(cfg, `/contacts/lists/${listId}/contacts`, "contacts", 500, f);
}

// Les attributs définis dans le compte (PRENOM, NOM, SMS… ou FIRSTNAME, LASTNAME selon la langue du compte).
export async function listAttributeNames(cfg: BrevoConfig, f: Fetcher = fetch): Promise<string[]> {
  const { data } = await brevoCall<{ attributes?: { name: string }[] }>(cfg, "/contacts/attributes", {}, f);
  return (data?.attributes ?? []).map((a) => a.name);
}

export async function createFolder(cfg: BrevoConfig, name: string, f: Fetcher = fetch): Promise<number> {
  const { data } = await brevoCall<{ id: number }>(cfg, "/contacts/folders", { method: "POST", body: { name } }, f);
  if (!data?.id) throw new BrevoError("Brevo n'a pas renvoyé l'identifiant du dossier créé.");
  return data.id;
}

export async function createList(cfg: BrevoConfig, name: string, folderId: number, f: Fetcher = fetch): Promise<number> {
  const { data } = await brevoCall<{ id: number }>(cfg, "/contacts/lists", { method: "POST", body: { name, folderId } }, f);
  if (!data?.id) throw new BrevoError("Brevo n'a pas renvoyé l'identifiant de la liste créée.");
  return data.id;
}

// Crée ou met à jour un contact (updateEnabled) et l'inscrit aux listes données. 201 + id à la création, 204 à la mise à jour.
export async function upsertContact(cfg: BrevoConfig, input: { email: string; attributes: Record<string, string>; listIds: number[] }, f: Fetcher = fetch): Promise<number | null> {
  const { status, data } = await brevoCall<{ id?: number }>(cfg, "/contacts", { method: "POST", body: { ...input, updateEnabled: true } }, f);
  if (status === 201 && data?.id) return data.id;
  return null;
}

export async function getContact(cfg: BrevoConfig, identifier: string, f: Fetcher = fetch): Promise<BrevoContact | null> {
  try { const { data } = await brevoCall<BrevoContact>(cfg, `/contacts/${encodeURIComponent(identifier)}`, {}, f); return data; } catch (e) { if (e instanceof BrevoError && /HTTP 404/.test(e.message)) return null; throw e; }
}

// Supprime un contact chez Brevo (irréversible : disparaît des listes et des campagnes). 404 = déjà absent, on ne s'en formalise pas.
export async function deleteContact(cfg: BrevoConfig, identifier: string, f: Fetcher = fetch): Promise<boolean> {
  try { await brevoCall(cfg, `/contacts/${encodeURIComponent(identifier)}`, { method: "DELETE" }, f); return true; } catch (e) { if (e instanceof BrevoError && /HTTP 404/.test(e.message)) return false; throw e; }
}

export async function removeFromList(cfg: BrevoConfig, listId: number, emails: string[], f: Fetcher = fetch): Promise<void> {
  for (let i = 0; i < emails.length; i += 150) await brevoCall(cfg, `/contacts/lists/${listId}/contacts/remove`, { method: "POST", body: { emails: emails.slice(i, i + 150) } }, f);
}

// ——— Correspondance attributs Brevo ↔ colonnes communes de l'annuaire ———
// Les comptes français exposent PRENOM / NOM / SMS, les autres FIRSTNAME / LASTNAME ; le reste dépend de chaque compte.
export const BREVO_ATTRIBUTE_MAP: { key: "firstName" | "lastName" | "phone" | "organisationName" | "role" | "city" | "postcode" | "address"; names: string[] }[] = [
  { key: "firstName", names: ["PRENOM", "FIRSTNAME", "FIRST_NAME"] },
  { key: "lastName", names: ["NOM", "LASTNAME", "LAST_NAME"] },
  { key: "phone", names: ["SMS", "TELEPHONE", "PHONE", "TEL", "MOBILE", "PORTABLE"] },
  { key: "organisationName", names: ["STRUCTURE", "SOCIETE", "ENTREPRISE", "ORGANISATION", "ORGANISME", "COMPANY"] },
  { key: "role", names: ["FONCTION", "POSTE", "JOB_TITLE"] },
  { key: "city", names: ["VILLE", "CITY"] },
  { key: "postcode", names: ["CP", "CODE_POSTAL", "POSTCODE", "ZIP"] },
  { key: "address", names: ["ADRESSE", "ADDRESS"] },
];
const MAPPED = new Set(BREVO_ATTRIBUTE_MAP.flatMap((m) => m.names));
// Attributs techniques de Brevo, sans intérêt pour l'annuaire.
const TECHNICAL = new Set(["DOUBLE_OPT-IN", "OPT_IN", "BLACKLIST", "CONTACT_TIMEZONE", "LANDING_PAGE_ID", "CONTACT_ID", "MODIFIED_AT", "ADDED_TIME"]);

// Lit un contact Brevo : colonnes communes reconnues, et les autres attributs (non vides) à garder tels quels.
export function readAttributes(attributes: Record<string, unknown> | undefined) {
  const common: Partial<Record<(typeof BREVO_ATTRIBUTE_MAP)[number]["key"], string>> = {};
  const others: Record<string, string> = {};
  const str = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v).trim());
  for (const [name, raw] of Object.entries(attributes ?? {})) {
    const v = str(raw);
    if (!v) continue;
    const m = BREVO_ATTRIBUTE_MAP.find((x) => x.names.includes(name.toUpperCase()));
    if (m) { if (!common[m.key]) common[m.key] = v; }
    else if (!TECHNICAL.has(name.toUpperCase())) others[name] = v;
  }
  return { common, others };
}

// À l'envoi : les colonnes communes vers les attributs que le compte connaît (rien d'inconnu, Brevo le refuserait).
export function writeAttributes(c: { firstName: string | null; lastName: string; phone: string | null; organisationName: string | null; organisation?: { name: string } | null; role: string | null; city: string | null; postcode: string | null; address: string | null }, known: string[]): Record<string, string> {
  const knownUpper = new Set(known.map((k) => k.toUpperCase()));
  const out: Record<string, string> = {};
  const values: Record<string, string | null | undefined> = { firstName: c.firstName, lastName: c.lastName, phone: c.phone, organisationName: c.organisation?.name ?? c.organisationName, role: c.role, city: c.city, postcode: c.postcode, address: c.address };
  for (const m of BREVO_ATTRIBUTE_MAP) {
    const v = values[m.key];
    if (!v) continue;
    const name = m.names.find((n) => knownUpper.has(n));
    if (name) out[name] = v;
  }
  return out;
}

export const isMappedAttribute = (name: string) => MAPPED.has(name.toUpperCase());

// Compte rendu d'une synchronisation (affiché dans l'admin, gardé dans les paramètres).
export type SyncReport = { contacts: number; created: number; updated: number; unsubscribed: number; deleted: number; lists: number; added: number; removed: number };
export function syncReportText(r: SyncReport): string {
  return `${r.contacts} contacts lus · ${r.created} créés · ${r.updated} complétés · ${r.unsubscribed} désinscrits · ${r.deleted} disparus · ${r.lists} liste${r.lists > 1 ? "s" : ""} (${r.added} entrées, ${r.removed} sorties)`;
}
