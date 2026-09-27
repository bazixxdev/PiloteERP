import { test } from "node:test";
import assert from "node:assert/strict";
import { navTreeFor, locate, type NavContext } from "../../lib/navigation";

const DIRECTOR = ["codir.access", "admin.manage", "time.lock", "treasury.view"];
const base = (over: Partial<NavContext> = {}): NavContext => ({
  role: "pilot", permissions: [], validationLevel: 0,
  modules: ["tasks", "notes"], veille: true, adherents: true, tresorerie: true, materiel: true,
  tracksTime: true, showTeam: false, canCloseMonths: false, wide: null,
  badges: { requests: 3, reminders: 2 }, today: new Date("2026-10-05T12:00:00"),
  ...over,
});
const ids = (ctx: NavContext) => navTreeFor(ctx).map((s) => s.id);
const labels = (ctx: NavContext, id: string) => navTreeFor(ctx).find((s) => s.id === id)?.items.map((l) => l.label) ?? [];
const at = (ctx: NavContext, url: string) => { const u = new URL(url, "http://x"); return locate(navTreeFor(ctx), u.pathname, u.searchParams); };

test("six sections au plus, dans l'ordre du quotidien puis par objet", () => {
  assert.deepEqual(ids(base({ role: "director", permissions: DIRECTOR, showTeam: true, canCloseMonths: true })), ["travail", "projets", "financements", "reseau", "ressources", "admin"]);
  assert.deepEqual(ids(base()), ["travail", "projets", "financements", "reseau", "ressources"]);
});

test("Mon travail : À traiter porte le badge des demandes ; Mon temps disparaît pour qui ne suit pas son temps", () => {
  const travail = navTreeFor(base()).find((s) => s.id === "travail")!;
  assert.equal(travail.items.find((l) => l.href === "/demandes")?.badge, 3);
  assert.ok(labels(base(), "travail").includes("Mon temps"));
  assert.ok(!labels(base({ tracksTime: false }), "travail").includes("Mon temps"));
});

test("Projets porte le badge des échéances (comme Mon travail porte celui des demandes)", () => {
  assert.equal(navTreeFor(base()).find((s) => s.id === "projets")?.badge, 2);
});

test("Trésorerie : visible avec le module et le droit, absente sans le droit, absente sans le module", () => {
  assert.ok(labels(base({ permissions: ["treasury.view"] }), "ressources").includes("Trésorerie"));
  assert.ok(!labels(base(), "ressources").includes("Trésorerie"));
  assert.ok(!labels(base({ permissions: ["treasury.view"], tresorerie: false }), "ressources").includes("Trésorerie"));
});

test("Temps de l'équipe suit les droits, même pour qui ne suit pas son temps", () => {
  assert.ok(labels(base({ tracksTime: false, showTeam: true }), "ressources").includes("Temps de l'équipe"));
  assert.ok(labels(base({ tracksTime: false, canCloseMonths: true }), "ressources").includes("Temps de l'équipe"));
  assert.ok(!labels(base(), "ressources").includes("Temps de l'équipe"));
  const cloture = navTreeFor(base({ canCloseMonths: true })).find((s) => s.id === "ressources")!.items.find((l) => l.label === "Temps de l'équipe");
  assert.equal(cloture?.href, "/cloture"); // sans temps d'autrui visible, l'entrée ouvre la clôture
});

test("Projets : À décider et Préparer pour le CODIR seulement ; Préparer en saison seulement", () => {
  const codir = base({ permissions: ["codir.access"] });
  assert.ok(labels(codir, "projets").includes("À décider"));
  assert.ok(labels(codir, "projets").includes("Préparer 2027"));
  assert.ok(!labels(base(), "projets").includes("À décider"));
  assert.ok(!labels({ ...codir, today: new Date("2026-05-10T12:00:00") }, "projets").some((l) => l.startsWith("Préparer")));
  assert.ok(labels({ ...codir, today: new Date("2027-01-10T12:00:00") }, "projets").includes("Préparer 2027"));
});

test("les modules d'instance masquent leurs entrées ; une section vide disparaît", () => {
  const sans = base({ veille: false, adherents: false, tresorerie: false, materiel: false });
  assert.ok(!labels(sans, "financements").includes("Appels à projets"));
  assert.ok(!labels(sans, "reseau").includes("Adhérents"));
  assert.ok(!ids(sans).includes("ressources"));
});

test("l'entrée active suit l'adresse, onglets et pages rattachées comprises", () => {
  const dir = base({ role: "director", permissions: DIRECTOR, showTeam: true, canCloseMonths: true });
  assert.deepEqual(at(dir, "/demandes?vue=mes"), { section: "travail", leaf: "/demandes" });
  assert.deepEqual(at(dir, "/validations"), { section: "travail", leaf: "/demandes" });
  assert.deepEqual(at(dir, "/notifications"), { section: "travail", leaf: "/ma-semaine" });
  assert.deepEqual(at(dir, "/temps"), { section: "travail", leaf: "/temps" });
  assert.deepEqual(at(dir, "/temps?equipe=1"), { section: "ressources", leaf: "/temps?equipe=1" });
  assert.deepEqual(at(dir, "/cloture"), { section: "ressources", leaf: "/temps?equipe=1" });
  assert.deepEqual(at(dir, "/portefeuille"), { section: "projets", leaf: "/projets" });
  assert.deepEqual(at(dir, "/cafe"), { section: "projets", leaf: "/echeances" });
  assert.deepEqual(at(dir, "/conventions?vue=obtenus"), { section: "financements", leaf: "/conventions" });
  assert.deepEqual(at(dir, "/adherents?vue=cotisations"), { section: "reseau", leaf: "/adherents" });
  assert.deepEqual(at(dir, "/materiel/prets?vue=termines"), { section: "ressources", leaf: "/materiel/prets" });
  assert.deepEqual(at(dir, "/materiel"), { section: "ressources", leaf: "/materiel/prets" });
  assert.deepEqual(at(dir, "/admin?section=parametres"), { section: "admin", leaf: "/admin" });
  assert.deepEqual(at(dir, "/seminaire?annee=2027"), { section: "projets", leaf: "/seminaire" });
  assert.deepEqual(at({ ...dir, today: new Date("2026-05-10T12:00:00") }, "/seminaire"), { section: "projets", leaf: "/projets" });
});
