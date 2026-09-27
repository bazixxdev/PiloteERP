import { test } from "node:test";
import assert from "node:assert/strict";
import { modulesOf, instanceHas, INSTANCE_MODULES } from "../../lib/modules";

// « Mes actions » remplace « Ma délégation » (26/09) : le module `delegation` sort d'INSTANCE_MODULES. Une base de
// production peut encore porter le jeton « delegation » dans `Settings.modules` (colonne texte, jamais validée contre la
// liste des clés connues) — modulesOf/instanceHas doivent l'ignorer sans erreur, comme n'importe quel jeton inconnu.
test("un jeton inconnu dans Settings.modules (ex. « delegation », retiré d'INSTANCE_MODULES) est ignoré sans erreur", () => {
  const settings = { modules: "veille,delegation,budget" };
  assert.deepEqual(modulesOf(settings), new Set(["veille", "delegation", "budget"]));
  assert.equal(instanceHas(settings, "veille"), true);
  assert.equal(instanceHas(settings, "budget"), true);
  assert.equal(INSTANCE_MODULES.some((m) => (m.key as string) === "delegation"), false);
  // Aucune clé connue ne plante sur ce settings, jeton inconnu compris.
  for (const m of INSTANCE_MODULES) assert.doesNotThrow(() => instanceHas(settings, m.key));
});
