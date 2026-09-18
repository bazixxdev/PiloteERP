// Connecteur HelloAsso (18/09), repris du client d'erp-tlst : API v5, OAuth2 client_credentials (jeton ~30 min, gardé en
// mémoire), pagination des commandes. Identifiants dans l'environnement du serveur ; sans eux, l'outil tourne sans (mode
// dégradé). Le lecteur est injectable ; les recettes pointent HELLOASSO_API_BASE sur un faux serveur (tests/helloasso-mock.mjs).

export type HelloAssoConfig = { clientId: string; clientSecret: string; slug: string; base: string };

export function helloAssoConfig(): HelloAssoConfig | null {
  const clientId = process.env.HELLOASSO_CLIENT_ID?.trim();
  const clientSecret = process.env.HELLOASSO_CLIENT_SECRET?.trim();
  const slug = process.env.HELLOASSO_ORG_SLUG?.trim();
  if (!clientId || !clientSecret || !slug) return null;
  return { clientId, clientSecret, slug, base: (process.env.HELLOASSO_API_BASE ?? "https://api.helloasso.com").replace(/\/$/, "") };
}

export class HelloAssoError extends Error {}

type Fetcher = typeof fetch;
let cachedToken: { key: string; value: string; expiresAt: number } | null = null;

async function token(cfg: HelloAssoConfig, f: Fetcher): Promise<string> {
  const key = `${cfg.base}|${cfg.clientId}`;
  if (cachedToken && cachedToken.key === key && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value;
  const res = await f(`${cfg.base}/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.clientId, client_secret: cfg.clientSecret }), cache: "no-store" });
  if (!res.ok) throw new HelloAssoError(res.status === 401 || res.status === 400 ? "HelloAsso refuse les identifiants (vérifiez HELLOASSO_CLIENT_ID / HELLOASSO_CLIENT_SECRET)." : `HelloAsso : HTTP ${res.status} à l'authentification`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { key, value: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 1800) * 1000 };
  return j.access_token;
}

export async function helloAssoGet<T>(cfg: HelloAssoConfig, path: string, params: Record<string, string | number | boolean> = {}, f: Fetcher = fetch): Promise<T> {
  const t = await token(cfg, f);
  const url = new URL(`${cfg.base}/v5${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await f(url, { headers: { authorization: `Bearer ${t}`, accept: "application/json" }, cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try { const b = (await res.json()) as { message?: string; errors?: { message?: string }[] }; detail = b?.message ?? b?.errors?.[0]?.message ?? ""; } catch { /* pas de corps */ }
    if (res.status === 404) throw new HelloAssoError(`HelloAsso : organisation « ${cfg.slug} » introuvable (HELLOASSO_ORG_SLUG).`);
    throw new HelloAssoError(`HelloAsso : GET ${path} → HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
  }
  return (await res.json()) as T;
}

// ——— Types partiels (ce qu'on lit) ———
export type HelloAssoForm = { formSlug: string; formType: string; title: string; state?: string; url?: string; startDate?: string | null };
export type HelloAssoPayer = { firstName?: string; lastName?: string; email?: string; company?: string | null; city?: string | null; zipCode?: string | null; address?: string | null };
export type HelloAssoItem = { id: number; type: string; name?: string; amount?: number; state?: string; customFields?: { name: string; answer: string }[]; user?: { firstName?: string; lastName?: string } };
export type HelloAssoOrder = { id: number; date: string; formSlug: string; formType: string; payer?: HelloAssoPayer; items?: HelloAssoItem[] };
type Paged<T> = { data: T[]; pagination?: { pageIndex: number; totalPages: number; totalCount: number; continuationToken?: string } };

export async function listForms(cfg: HelloAssoConfig, f: Fetcher = fetch): Promise<HelloAssoForm[]> {
  const r = await helloAssoGet<Paged<HelloAssoForm> | HelloAssoForm[]>(cfg, `/organizations/${cfg.slug}/forms`, {}, f);
  return Array.isArray(r) ? r : (r.data ?? []);
}

// Toutes les commandes (100 par page ; on s'arrête à la première page incomplète — `totalPages` s'est révélé peu fiable).
export async function listOrders(cfg: HelloAssoConfig, f: Fetcher = fetch, maxPages = 50): Promise<HelloAssoOrder[]> {
  const out: HelloAssoOrder[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await helloAssoGet<Paged<HelloAssoOrder>>(cfg, `/organizations/${cfg.slug}/orders`, { pageIndex: page, pageSize: 100, withDetails: true }, f);
    const batch = r.data ?? [];
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// Lecture d'un item : la structure (payeur « company » ou champ personnalisé), l'année (dans le titre du formulaire ou le
// tarif, sinon celle de la commande), le règlement d'après l'état de l'item.
export const STRUCTURE_FIELD = /structure|raison sociale|organis|association|entreprise|soci[ée]t[ée]|employeur|nom de la/i;
export function itemStructure(order: HelloAssoOrder, item: HelloAssoItem): string | null {
  const company = order.payer?.company?.trim();
  if (company) return company;
  const cf = (item.customFields ?? []).find((c) => STRUCTURE_FIELD.test(c.name) && c.answer?.trim());
  return cf ? cf.answer.trim() : null;
}
export function itemYear(order: HelloAssoOrder, item: HelloAssoItem, formTitle: string | undefined): number {
  const m = `${formTitle ?? ""} ${item.name ?? ""}`.match(/\b(20\d{2})\b/);
  if (m) return Number(m[1]);
  return new Date(order.date).getFullYear();
}
export function itemStatus(item: HelloAssoItem): "paid" | "due" | "cancelled" {
  const s = (item.state ?? "").toLowerCase();
  if (s === "processed") return "paid";
  if (s === "canceled" || s === "cancelled" || s === "refunded" || s === "refunding") return "cancelled";
  return "due";
}

// Compte rendu d'une synchronisation.
export type HelloAssoReport = { orders: number; memberships: number; created: number; updated: number; organisations: number; contacts: number; lists: number; added: number; removed: number };
export function helloAssoReportText(r: HelloAssoReport): string {
  const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  return `${pl(r.orders, "commande lue", "commandes lues")} · ${pl(r.memberships, "adhésion", "adhésions")} (${pl(r.created, "nouvelle", "nouvelles")}, ${pl(r.updated, "mise à jour", "mises à jour")}) · ${pl(r.organisations, "structure", "structures")} et ${pl(r.contacts, "contact", "contacts")} créés · ${pl(r.lists, "événement suivi", "événements suivis")} (${r.added} entrées, ${r.removed} sorties)`;
}
