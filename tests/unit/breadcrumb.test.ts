import { test } from "node:test";
import assert from "node:assert/strict";
import { navTreeFor, type NavContext } from "../../lib/navigation";
import { breadcrumbParts } from "../../components/shell/breadcrumb";

// Fil d'Ariane aligné sur les six sections (menu rangé par usage, tâche 6 du 27/09) : section > feuille > maillon d'onglet
// ou de vue. Même contexte que tests/unit/navigation.test.ts, direction avec les droits qui font apparaître les feuilles
// rattachées (À décider, Temps de l'équipe) testées ici.
const DIRECTOR = ["codir.access", "admin.manage", "time.lock", "treasury.view"];
const ctx: NavContext = {
  role: "director", permissions: DIRECTOR, validationLevel: 3,
  modules: ["tasks", "notes"], veille: true, adherents: true, tresorerie: true, materiel: true,
  tracksTime: true, showTeam: true, canCloseMonths: true, wide: null,
  badges: { requests: 3, reminders: 2 }, today: new Date("2026-10-05T12:00:00"),
};
const tree = navTreeFor(ctx);
const sp = (query = "") => new URLSearchParams(query);
const parts = (pathname: string, query = "") => breadcrumbParts(tree, [], pathname, sp(query));

test("À traiter (ex-Mes demandes), vue « mes » comprise : Mon travail › À traiter", () => {
  assert.deepEqual(parts("/demandes", "vue=mes"), ["Mon travail", "À traiter"]);
});

test("café du lundi rattaché à Échéances : Projets › Échéances › Café du lundi", () => {
  assert.deepEqual(parts("/cafe"), ["Projets", "Échéances", "Café du lundi"]);
});

test("café du lundi en projection plein écran : dernier maillon Projection", () => {
  assert.deepEqual(parts("/cafe", "plein=1"), ["Projets", "Échéances", "Projection"]);
});

test("clôture rattachée à Temps de l'équipe : Ressources › Temps de l'équipe › Clôture", () => {
  assert.deepEqual(parts("/cloture"), ["Ressources", "Temps de l'équipe", "Clôture"]);
});

test("portefeuille en mode CODIR : Projets › À décider (remplace la vue de la feuille, ne s'y ajoute pas)", () => {
  assert.deepEqual(parts("/portefeuille", "mode=codir"), ["Projets", "À décider"]);
});
