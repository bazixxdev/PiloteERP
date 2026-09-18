// Faux HelloAsso pour les recettes (tests/adherents.spec.ts) : l'API v5 réduite à ce que le connecteur appelle (jeton,
// formulaires, commandes). Démarré par Playwright ; le serveur de test pointe HELLOASSO_API_BASE dessus. Données fictives.
import http from "node:http";

const PORT = Number(process.env.HELLOASSO_MOCK_PORT ?? 3298);
const SLUG = "cress-demo";
const forms = [
  { formSlug: "adhesion-2026", formType: "Membership", title: "Adhésion 2026", state: "Public" },
  { formSlug: "forum-regional-2026", formType: "Event", title: "Forum régional de l'ESS 2026", state: "Public", startDate: "2026-11-19T09:00:00+01:00" },
  { formSlug: "dons", formType: "Donation", title: "Soutenir la CRESS", state: "Public" },
];
const orders = [
  // Une structure inconnue : organisation créée (genre adhérent), payeur = référent, adhésion réglée.
  { id: 501, date: "2026-02-10T10:00:00+01:00", formSlug: "adhesion-2026", formType: "Membership", payer: { firstName: "Ali", lastName: "Nouveau", email: "a.nouveau@exemple.fr", company: "Tiers-lieu de Vierzon", city: "Vierzon", zipCode: "18100" }, items: [{ id: 9001, type: "Membership", name: "Collège associations", amount: 15000, state: "Processed", customFields: [] }] },
  // Une personne physique inconnue : contact créé, adhésion à titre personnel.
  { id: 502, date: "2026-03-02T10:00:00+01:00", formSlug: "adhesion-2026", formType: "Membership", payer: { firstName: "Théo", lastName: "Lambert", email: "t.lambert@exemple.fr", company: "", city: "Tours" }, items: [{ id: 9002, type: "Membership", name: "Personne physique", amount: 3000, state: "Processed", customFields: [] }] },
  // Une structure déjà adhérente, dont l'adhésion 2026 est « à régler » (reconduite) : c'est elle que HelloAsso règle.
  { id: 503, date: "2026-04-15T10:00:00+01:00", formSlug: "adhesion-2026", formType: "Membership", payer: { firstName: "Nadège", lastName: "Roussel", email: "n.roussel@exemple.fr", company: "", city: "Orléans" }, items: [{ id: 9003, type: "Membership", name: "Collège coopératives", amount: 18000, state: "Processed", customFields: [{ name: "Structure", answer: "Scop Bâti Loire" }] }] },
  // Inscrits au forum : un contact connu (payeur), une participante sans e-mail, une élue connue.
  { id: 601, date: "2026-09-01T10:00:00+02:00", formSlug: "forum-regional-2026", formType: "Event", payer: { firstName: "Marius", lastName: "Garnier", email: "m.garnier@exemple.fr", company: "Initiative Loiret" }, items: [
    { id: 9101, type: "Registration", name: "Tarif adhérent", amount: 0, state: "Processed", customFields: [{ name: "Atelier", answer: "Coopération" }], user: { firstName: "Marius", lastName: "Garnier" } },
    { id: 9102, type: "Registration", name: "Tarif plein", amount: 2000, state: "Processed", customFields: [{ name: "Atelier", answer: "Financement" }], user: { firstName: "Chloé", lastName: "Petit" } },
  ] },
  { id: 602, date: "2026-09-03T10:00:00+02:00", formSlug: "forum-regional-2026", formType: "Event", payer: { firstName: "Fatou", lastName: "Diallo", email: "f.diallo@exemple.fr", company: "Tours Métropole Val de Loire" }, items: [{ id: 9103, type: "Registration", name: "Tarif adhérent", amount: 0, state: "Processed", customFields: [{ name: "Atelier", answer: "Coopération" }], user: { firstName: "Fatou", lastName: "Diallo" } }] },
  // Une inscription annulée : ignorée.
  { id: 603, date: "2026-09-04T10:00:00+02:00", formSlug: "forum-regional-2026", formType: "Event", payer: { firstName: "Zoé", lastName: "Annulée", email: "z.annulee@exemple.fr" }, items: [{ id: 9104, type: "Registration", name: "Tarif plein", amount: 2000, state: "Canceled", customFields: [], user: { firstName: "Zoé", lastName: "Annulée" } }] },
];

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => resolve(s)); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "POST" && url.pathname === "/oauth2/token") {
    const body = new URLSearchParams(await readBody(req));
    if (body.get("client_id") !== "test-id" || body.get("client_secret") !== "test-secret") return json(res, 401, { message: "invalid_client" });
    return json(res, 200, { access_token: "tok-123", token_type: "bearer", expires_in: 1800 });
  }
  if (req.headers.authorization !== "Bearer tok-123") return json(res, 401, { message: "Unauthorized" });
  if (url.pathname === `/v5/organizations/${SLUG}/forms`) return json(res, 200, { data: forms, pagination: { pageIndex: 1, totalPages: 1, totalCount: forms.length } });
  if (url.pathname === `/v5/organizations/${SLUG}/orders`) { const page = Number(url.searchParams.get("pageIndex") ?? 1); return json(res, 200, { data: page === 1 ? orders : [], pagination: { pageIndex: page, totalPages: 1, totalCount: orders.length } }); }
  json(res, 404, { message: `not found: ${req.method} ${url.pathname}` });
}).listen(PORT, () => console.log(`helloasso-mock on ${PORT}`));
