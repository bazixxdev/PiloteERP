#!/usr/bin/env node
// Lot I : aucun mot du vocabulaire client en dur dans ce qui s'affiche. Parcourt l'AST TypeScript de app/, components/, lib/ et
// ne regarde que les chaînes (littéraux, gabarits) et le texte JSX — jamais les commentaires ni les identifiants. Exclusions :
// config/clients/, lib/vocab.ts, lib/lexique.ts (compose avec V), les attributs data-testid, et une ligne marquée `// vocab-ok`.
// 26/09 : étendu à tests/**/*.ts (recette Playwright) — une recette ne doit pas hériter le mot en dur là où l'app ne l'a plus.
// Là, on ne regarde que ce qui compare un libellé affiché : les arguments de toContainText, getByText, toHaveAttribute,
// toHaveText, et la seule propriété `name` passée à getByRole (le rôle lui-même, ex. "tab", n'est pas un mot du vocabulaire).
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["app", "components", "lib"];
const TEST_ROOTS = ["tests"];
const SKIP = [/^lib\/vocab\.ts$/, /^lib\/lexique\.ts$/, /^config\//];
// Les mêmes mots interdits que pour l'app : composer avec tests/vocab.ts (W / WTlst), pas les réécrire en dur.
const TEST_ASSERTION_CALLS = new Set(["toContainText", "getByText", "toHaveAttribute", "toHaveText"]);
const TEST_NAME_ONLY_CALLS = new Set(["getByRole"]);
// Motifs sensibles à la casse : « Pilote » (le produit) et « edition » sans accent (routes) ne comptent pas.
// Frontières de mot Unicode (\b ne connaît pas les accents) : (?<!\p{L}) … (?!\p{L}).
const W = (core) => new RegExp(`(?<!\\p{L})(?:${core})(?!\\p{L})`, "u");
const WORDS = [
  ["CRESS", /CRESS/],
  ["édition", W("[Éé]ditions?")],
  ["pôle", W("[Pp]ôles?")],
  ["CODIR", W("CODIR")],
  ["RAF", W("RAF")],
  ["direction", W("[Dd]irection")],
  ["pilote", W("pilotes?")],
  ["action", W("[Aa]ctions?")],
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) yield p;
  }
}

// Un mot interdit trouvé dans une chaîne, sauf ligne marquée `// vocab-ok`.
function pushIfForbidden(findings, file, sf, lines, node, s) {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
  if (/vocab-ok/.test(lines[line])) return;
  for (const [label, re] of WORDS) {
    if (re.test(s)) findings.push(`${file}:${line + 1}: [${label}] ${s.trim().slice(0, 90).replace(/\n/g, " ")}`);
  }
}

const findings = [];
for (const root of ROOTS) {
  for (const file of files(root)) {
    if (SKIP.some((re) => re.test(file))) continue;
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      let s = null;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) s = node.text;
      else if (ts.isJsxText(node)) s = node.text;
      if (s !== null) {
        const parent = node.parent;
        const isTestId = parent && ts.isJsxAttribute(parent) && parent.name.getText() === "data-testid";
        const isImport = parent && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent));
        // Un type littéral (`"direction" | "admin"`) ou une clé technique (`module: "direction"`, `pilote_person`, `@pilote.cress`)
        // n'est pas de l'affichage : pas d'espace, pas de majuscule, pas d'accent.
        const isType = parent && ts.isLiteralTypeNode(parent);
        const isKey = /^[a-z0-9_:.@/?=&#-]+$/.test(s);
        const isClass = parent && ts.isJsxAttribute(parent) && parent.name.getText() === "className";
        if (!isTestId && !isImport && !isType && !isKey && !isClass) pushIfForbidden(findings, file, sf, lines, node, s);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

// tests/**/*.ts (26/09) : seuls les libellés comparés à l'affichage — arguments de toContainText/getByText/toHaveAttribute/
// toHaveText, et la propriété `name` d'un getByRole — pas les testid, les rôles ARIA ou le texte saisi par le test lui-même.
function calleeName(expr) {
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isIdentifier(expr)) return expr.text;
  return null;
}

for (const root of TEST_ROOTS) {
  for (const file of files(root)) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const isKey = (s) => /^[a-z0-9_:.@/?=&#-]+$/.test(s);
    // Une chaîne, un gabarit ou une regex littéraux quelque part sous `node` ; si `restrictToName`, seulement ceux qui vivent
    // sous une propriété `name: …` (le premier argument de getByRole, le rôle ARIA, n'est jamais un mot du vocabulaire).
    const scan = (node, restrictToName, insideName) => {
      let s = null;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) s = node.text;
      else if (ts.isRegularExpressionLiteral(node)) { const t = node.text; s = t.slice(1, t.lastIndexOf("/")); }
      if (s !== null && (!restrictToName || insideName) && !isKey(s)) pushIfForbidden(findings, file, sf, lines, node, s);
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "name") {
        scan(node.initializer, restrictToName, true);
        return;
      }
      ts.forEachChild(node, (c) => scan(c, restrictToName, insideName));
    };
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const name = calleeName(node.expression);
        if (name && (TEST_ASSERTION_CALLS.has(name) || TEST_NAME_ONLY_CALLS.has(name))) {
          const restrictToName = TEST_NAME_ONLY_CALLS.has(name);
          for (const arg of node.arguments) scan(arg, restrictToName, !restrictToName);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

if (process.argv.includes("--words")) console.log(WORDS.map(([l]) => l).join(", "));
if (findings.length) {
  console.error(findings.join("\n"));
  console.error(`\n✖ ${findings.length} mot(s) en dur — passer par V / helpers de lib/vocab.ts, ou reformuler (docs/superpowers/specs/2026-09-18-lot-i-multi-instance-design.md §2).`);
  process.exit(1);
}
console.log("✔ aucun mot du vocabulaire en dur dans ce qui s'affiche");
