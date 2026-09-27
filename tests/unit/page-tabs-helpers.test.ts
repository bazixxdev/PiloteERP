import { test } from "node:test";
import assert from "node:assert/strict";
import { teamTabs } from "../../app/temps/team-tabs";
import { materielTabs } from "../../app/materiel/tabs";
import { projectTabs } from "../../app/projets/tabs";
import { seesSomeoneElse } from "../../lib/time-visibility";
import { V, pl } from "../../lib/vocab";

// Onglets de « Temps de l'équipe » (spec menu § 6.3, 6.6) : chacun selon son droit (team/close), jamais l'un sans l'autre ;
// teamHref garde la cible historique du bouton (task-4-review.md, Important #1 côté page, testé ici côté fonction pure).
test("teamTabs : équipe seule, clôture seule, les deux, teamHref gardé", () => {
  assert.deepEqual(teamTabs("equipe", { team: false, close: false }), []);

  const teamOnly = teamTabs("equipe", { team: true, close: false });
  assert.equal(teamOnly.length, 1);
  assert.deepEqual(teamOnly[0], { href: "/temps?equipe=1", label: "Temps de l'équipe", active: true, testId: "team-tab-equipe" });

  const closeOnly = teamTabs("cloture", { team: false, close: true });
  assert.equal(closeOnly.length, 1);
  assert.deepEqual(closeOnly[0], { href: "/cloture", label: "Clôture", active: true, testId: "team-tab-cloture" });

  const both = teamTabs("cloture", { team: true, close: true, teamHref: "/temps?personne=p1&semaine=2026-W40" });
  assert.equal(both.length, 2);
  assert.equal(both[0].href, "/temps?personne=p1&semaine=2026-W40"); // teamHref gardé, pas le "/temps?equipe=1" par défaut
  assert.equal(both[0].active, false); // current = "cloture" : l'onglet équipe n'est pas actif
  assert.equal(both[1].active, true);
});

// Matériel et prêts (spec menu § 2) : prêts en cours / terminés, puis l'inventaire — un seul onglet actif à la fois.
test("materielTabs : trois onglets, un seul actif selon current", () => {
  const tabs = materielTabs("encours");
  assert.deepEqual(tabs.map((t) => t.href), ["/materiel/prets", "/materiel/prets?vue=termines", "/materiel"]);
  assert.deepEqual(tabs.map((t) => t.active), [true, false, false]);
  assert.deepEqual(materielTabs("termines").map((t) => t.active), [false, true, false]);
  assert.deepEqual(materielTabs("inventaire").map((t) => t.active), [false, false, true]);
});

// « Tous les {projets} » / « Portefeuille » (CODIR) ou « Mes {projets} » (les autres) — spec menu § 6.4. Le mot du
// vocabulaire client n'est jamais écrit en dur ici : on le recalcule avec les mêmes helpers que app/projets/tabs.ts.
test("projectTabs : « Portefeuille » pour le CODIR, « Mes {projets} » sinon, jamais de mot en dur", () => {
  assert.equal(projectTabs("tous", false)[0].label, `Tous les ${pl(V.projet)}`);
  assert.equal(projectTabs("tous", true)[0].active, true);
  assert.equal(projectTabs("portefeuille", true)[1].label, "Portefeuille");
  assert.equal(projectTabs("portefeuille", false)[1].label, `Mes ${pl(V.projet)}`);
  assert.equal(projectTabs("portefeuille", false)[1].active, true);
});

// Une seule règle pour « au moins une autre personne dont je vois le temps » (layout et /cloture, spec menu § 6.6).
test("seesSomeoneElse : exclut soi-même, exclut qui ne suit pas son temps, respecte la visibilité", () => {
  const me = { id: "me", poleId: "p1", role: "pilot", permissions: [] as string[], validationLevel: 0 };
  const other = (over: Partial<{ id: string; poleId: string | null; tracksTime: boolean }> = {}) => ({ id: "other", poleId: "p1", tracksTime: true, ...over });

  // Soi-même dans la liste : jamais compté, même avec la visibilité la plus large.
  assert.equal(seesSomeoneElse(me, [{ ...other({ id: me.id }) }], "all"), false);
  // Quelqu'un d'autre qui ne suit pas son temps : exclu, même visible par ailleurs.
  assert.equal(seesSomeoneElse(me, [other({ tracksTime: false })], "all"), false);
  // Visibilité "self" (par défaut) sans droit particulier : personne d'autre n'est vue.
  assert.equal(seesSomeoneElse(me, [other()], "self"), false);
  // Visibilité "all" : la personne (qui suit son temps) est vue.
  assert.equal(seesSomeoneElse(me, [other()], "all"), true);
  // Une liste avec plusieurs personnes : il suffit d'une seule visible.
  assert.equal(seesSomeoneElse(me, [other({ id: "a", tracksTime: false }), other({ id: "b" })], "all"), true);
});
