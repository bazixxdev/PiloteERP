import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { FIELDS } from "../../lib/fields";

// Sentinelles des règles de .agents/rules/ : elles cassent quand une convention issue de l'audit de septembre 2026
// est contournée. Les mettre à jour est un acte délibéré, pas un réflexe : relire la règle citée avant.

const ROOT = path.resolve(__dirname, "../..");
const walk = (dir: string, out: string[] = []): string[] => {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};

// SEC-27 / BLK-14 — les champs ouverts à saveField sont figés ici. Ajouter un champ = relire
// .agents/rules/securite-autorisation.md : statuts, permissions, montants financiers, paiements, états de validation
// et relations passent par une commande dédiée avec ses invariants. `settings.apiToken` et `fundingLine.status/amountGranted`
// sont des exceptions historiques déjà gardées dans saveField (à sortir un jour, BLK-14).
const SAVE_FIELD_ALLOWLIST: Record<string, string> = {
  edition: "status decisionDate conditionalStart stakes axis sressMeasure snessLink otherTexts yearPriorities expectedOutcome plannedFunders directExpenseEnvelope fte imposedIndicators sponsorId operationalObjectives quantitativeObjectives content audience calendar deliveryDate partners method governance ownIndicators timeNeed budgetNeed codirDecision codirDate boardValidated boardDate venues equipment evidenceToKeep evaluation report budgetEnvelope spent",
  action: "name ownerId milestoneDate timeTarget state fundingLineId isPublic description venue participants",
  fundingLine: "funderId conventionId scheme status amountRequested amountGranted submittedAt answeredAt contractedAt analyticCode allocationKeyRef multiYear notes contactId",
  deliverable: "label dueDate done",
  payment: "label amount expectedAt receivedAt reference note",
  call: "funderId label scheme deadline rolling recurring amountValue amountKind durationYears targetProjectId link description",
  convention: "reference scheme label description startYear endYear status form amountRequested amountKind amountNotified targetProjectId deadline ownerId helpers sources decisionNote submittedAt notifiedAt signedAt notes contactId",
  indicator: "label target actual imposed",
  person: "name firstName lastName jobTitle phone arrivedAt leftAt note role workRhythm availableDays poleId active email",
  project: "name analyticCode poleId pilotId guarantorId missionId strategicAxis recurring archived",
  editionPersonDays: "soldDays plannedDays availableDays",
  expense: "label supplier committed spent status reference nature",
  rhythm: "label hoursEven hoursOdd",
  settings: "validationThresholdLevel1 validationThresholdLevel2 reminderDaysBefore envelopeAlertPercent deliverableAlertDays timeVisibility horizonDays timeRules serverPathTemplate apiToken hoursPerDay operatingDaysPerMonth billingEmail billingNote realizedSource pennylaneAxes",
  refValue: "label color",
  funder: "name notes",
  organisation: "name notes siret website address email phone active",
  equipment: "name category reference location quantity purchasedAt value notes",
  loan: "dueAt notes returnNote depositAmount depositRef depositReturnedAt",
  membership: "college amount status paidAt method notes",
  contact: "firstName lastName role email phone notes organisationName address postcode city tags",
  mission: "name",
  timeCode: "label kind",
  pole: "name leadId",
  docLink: "label url codirOnly",
};

test("saveField : aucun champ ajouté sans relecture de l'invariant (SEC-27)", () => {
  const actual = Object.fromEntries(Object.entries(FIELDS).map(([m, f]) => [m, Object.keys(f).join(" ")]));
  assert.deepEqual(actual, SAVE_FIELD_ALLOWLIST, "FIELDS a changé : relire .agents/rules/securite-autorisation.md (§ saveField), puis mettre à jour SAVE_FIELD_ALLOWLIST.");
});

// SEC-02 / SEC-03 / SEC-17 — chaque route HTTP porte sa garde d'accès, explicitement.
const ROUTE_GUARDS = ["getCurrentPerson", "exportDenial", "sessionExportAllowed", "toNextJsHandler"];
const ROUTE_EXCEPTIONS: Record<string, string> = {
  "app/api/agenda/[token]/route.ts": "active", // flux ICS par jeton personnel : vérifie Person.active (SEC-08)
};

test("chaque route.ts porte une garde d'accès connue (SEC-02/03/08/17)", () => {
  const routes = walk(path.join(ROOT, "app")).filter((p) => p.endsWith("/route.ts")).map((p) => path.relative(ROOT, p));
  assert.ok(routes.length >= 10, "routes introuvables");
  for (const r of routes) {
    const src = readFileSync(path.join(ROOT, r), "utf8");
    const needle = ROUTE_EXCEPTIONS[r] ? [ROUTE_EXCEPTIONS[r]] : ROUTE_GUARDS;
    assert.ok(needle.some((g) => src.includes(g)), `${r} : aucune garde parmi ${needle.join(", ")} — voir .agents/rules/securite-autorisation.md (§ routes)`);
  }
});

// Toute Server Action part de la personne connectée ; l'autorisation se décide ensuite par ressource.
const ACTION_EXCEPTIONS = new Set(["app/actions/session.ts"]); // switchPerson : mode démo, garde sa propre logique

test("chaque fichier d'actions charge la personne connectée (authentification ≠ autorisation)", () => {
  const files = readdirSync(path.join(ROOT, "app/actions")).filter((f) => f.endsWith(".ts")).map((f) => `app/actions/${f}`);
  for (const f of files) {
    if (ACTION_EXCEPTIONS.has(f)) continue;
    const src = readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(src.includes("getCurrentPerson"), `${f} n'appelle pas getCurrentPerson — voir .agents/rules/securite-autorisation.md`);
  }
});

// Les recettes tournent en profil explicite (SEC-20/24) et ne ramassent ni les unitaires ni la suite sécurité.
test("playwright.config.ts : profil de recette explicite, spec seulement, tests/security exclu", () => {
  const cfg = readFileSync(path.join(ROOT, "playwright.config.ts"), "utf8");
  assert.match(cfg, /PILOTE_ENV_PROFILE: "test"/);
  assert.match(cfg, /testMatch: \/\.\*\\\.spec\\\.ts\$\//);
  assert.match(cfg, /testIgnore: \/tests\\\/security\\\/\//);
});

// Les artefacts régénérés par les suites (sessions, pièces déposées, identifiants de fixtures) ne rentrent pas dans git.
test("aucun artefact de suite de tests suivi par git", () => {
  const r = spawnSync("git", ["ls-files", "uploads-security", "uploads-security-harness", "uploads-test", "uploads-test-tlst", "tests/.auth", "tests/.security-auth", "test-results", "playwright-report"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) return; // hors dépôt git (archive, CI sans .git) : rien à vérifier
  assert.equal(r.stdout.trim(), "", `fichiers à sortir de git :\n${r.stdout}`);
});
