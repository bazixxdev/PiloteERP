// Faux Brevo pour les recettes (tests/brevo.spec.ts) : l'API v3 réduite à ce que le connecteur appelle. Démarré par Playwright
// (playwright.config.ts) ; le serveur de test pointe BREVO_API_BASE dessus. Données fictives, remises à zéro par POST /__reset ;
// GET /__state renvoie tout (pour vérifier ce que l'outil a envoyé).
import http from "node:http";

const PORT = Number(process.env.BREVO_MOCK_PORT ?? 3299);

const initial = () => ({
  folders: [{ id: 1, name: "Réseau" }],
  lists: [
    { id: 11, name: "Newsletter ESS", folderId: 1 },
    { id: 12, name: "Élus et collectivités", folderId: 1 },
  ],
  attributes: [{ name: "PRENOM" }, { name: "NOM" }, { name: "SMS" }, { name: "SOCIETE" }, { name: "TERRITOIRE" }],
  contacts: [
    // Déjà dans l'annuaire du seed (même e-mail) : complétée, pas dupliquée.
    { id: 101, email: "f.diallo@exemple.fr", attributes: { PRENOM: "Fatou", NOM: "Diallo", TERRITOIRE: "Indre-et-Loire" }, listIds: [11, 12], emailBlacklisted: false },
    // Inconnu ici : créé avec sa structure (SOCIETE) et son attribut propre.
    { id: 102, email: "k.benali@exemple.fr", attributes: { PRENOM: "Karim", NOM: "Benali", SMS: "0611000002", SOCIETE: "Coop Berry", TERRITOIRE: "Cher" }, listIds: [11] },
    // Désinscrite : marquée, gardée, jamais renvoyée.
    { id: 103, email: "n.roux@exemple.fr", attributes: { PRENOM: "Nadia", NOM: "Roux" }, listIds: [11], emailBlacklisted: true },
    // Sans aucun attribut ni liste : entre quand même dans l'annuaire (nom = e-mail).
    { id: 104, email: "contact@sans-nom.example", attributes: {}, listIds: [] },
  ],
  nextId: 200,
});
let state = initial();

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => resolve(s ? JSON.parse(s) : {})); });
const page = (arr, url) => { const limit = Number(url.searchParams.get("limit") ?? 50); const offset = Number(url.searchParams.get("offset") ?? 0); return arr.slice(offset, offset + limit); };
const publicContact = (c) => ({ id: c.id, email: c.email, attributes: c.attributes, listIds: c.listIds, emailBlacklisted: Boolean(c.emailBlacklisted), smsBlacklisted: false });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname.replace(/^\/v3/, "");
  if (p === "/__reset") { state = initial(); return json(res, 200, { ok: true }); }
  if (p === "/__state") return json(res, 200, state);
  if (req.headers["api-key"] !== "test-key") return json(res, 401, { code: "unauthorized", message: "Key not found" });
  let m;
  if (req.method === "GET" && p === "/contacts/folders") return json(res, 200, { folders: page(state.folders, url), count: state.folders.length });
  if (req.method === "POST" && p === "/contacts/folders") { const b = await readBody(req); const f = { id: state.nextId++, name: b.name }; state.folders.push(f); return json(res, 201, { id: f.id }); }
  if (req.method === "GET" && p === "/contacts/lists") return json(res, 200, { lists: page(state.lists.map((l) => ({ ...l, totalSubscribers: state.contacts.filter((c) => c.listIds.includes(l.id)).length })), url), count: state.lists.length });
  if (req.method === "POST" && p === "/contacts/lists") { const b = await readBody(req); const l = { id: state.nextId++, name: b.name, folderId: b.folderId }; state.lists.push(l); return json(res, 201, { id: l.id }); }
  if (req.method === "GET" && p === "/contacts/attributes") return json(res, 200, { attributes: state.attributes });
  if (req.method === "GET" && p === "/contacts") return json(res, 200, { contacts: page(state.contacts.map(publicContact), url), count: state.contacts.length });
  if (req.method === "POST" && p === "/contacts") {
    const b = await readBody(req);
    const email = String(b.email ?? "").toLowerCase();
    const existing = state.contacts.find((c) => c.email === email);
    if (existing) {
      if (!b.updateEnabled) return json(res, 400, { code: "duplicate_parameter", message: "Contact already exist" });
      existing.attributes = { ...existing.attributes, ...(b.attributes ?? {}) };
      for (const id of b.listIds ?? []) if (!existing.listIds.includes(id)) existing.listIds.push(id);
      return json(res, 204);
    }
    const c = { id: state.nextId++, email, attributes: b.attributes ?? {}, listIds: b.listIds ?? [], emailBlacklisted: false };
    state.contacts.push(c);
    return json(res, 201, { id: c.id });
  }
  if ((m = p.match(/^\/contacts\/lists\/(\d+)\/contacts$/)) && req.method === "GET") { const id = Number(m[1]); return json(res, 200, { contacts: page(state.contacts.filter((c) => c.listIds.includes(id)).map(publicContact), url), count: 0 }); }
  if ((m = p.match(/^\/contacts\/lists\/(\d+)\/contacts\/remove$/)) && req.method === "POST") { const id = Number(m[1]); const b = await readBody(req); for (const c of state.contacts) if ((b.emails ?? []).includes(c.email)) c.listIds = c.listIds.filter((x) => x !== id); return json(res, 201, { contacts: { success: b.emails } }); }
  if ((m = p.match(/^\/contacts\/lists\/(\d+)\/contacts\/add$/)) && req.method === "POST") { const id = Number(m[1]); const b = await readBody(req); for (const c of state.contacts) if ((b.emails ?? []).includes(c.email) && !c.listIds.includes(id)) c.listIds.push(id); return json(res, 201, { contacts: { success: b.emails } }); }
  if ((m = p.match(/^\/contacts\/([^/]+)$/)) && req.method === "GET") { const key = decodeURIComponent(m[1]).toLowerCase(); const c = state.contacts.find((x) => x.email === key || String(x.id) === key); return c ? json(res, 200, publicContact(c)) : json(res, 404, { code: "document_not_found", message: "Contact does not exist" }); }
  json(res, 404, { code: "not_found", message: `${req.method} ${p}` });
}).listen(PORT, () => console.log(`brevo-mock on ${PORT}`));
