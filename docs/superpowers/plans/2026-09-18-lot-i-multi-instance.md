# Lot I — Multi-instance : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un seul dépôt `pilote/` sert plusieurs clients (CRESS aujourd'hui, TLST demain, d'autres ensuite) : nom, logos, favicon, thème, polices, vocabulaire, seed et déploiement viennent d'un fichier client choisi au build, sans que le code métier sache quel client tourne.

**Architecture:** `config/clients/<client>.ts` (versionné) décrit l'habillage ; `config/clients/index.ts` choisit le client par `NEXT_PUBLIC_CLIENT` (imports statiques, aucune requête). `lib/vocab.ts` expose les mots (`V.edition`, `le(V.pole)`…) ; `lib/branding.ts` est le seul point d'entrée du layout, du logo et du favicon (la base pourra le surcharger plus tard : écran Apparence, feuille de route). Le seed est découpé en tronc commun + un seed par client ; `deploy.sh <instance>` lit `deploy/instances/<instance>.env`. Un script de contrôle (`scripts/check-vocab.mjs`, AST TypeScript) interdit les mots en dur dans ce qui s'affiche.

**Tech Stack:** Next.js 15 (App Router, `basePath`), React 19, TypeScript 5, Prisma 6 + PostgreSQL, better-auth, Tailwind 4 (tokens CSS dans `app/globals.css`), Playwright, `tsx`, Node 26 (`node --test`), Python 3 + Pillow (génération des images), bash + systemd + nginx (bazixx-vps).

**Spec:** `docs/superpowers/specs/2026-09-18-lot-i-multi-instance-design.md`

## Global Constraints

- Jamais de `if (client.key === …)` ni de branche par client dans le code métier ; le code importe `V`, `branding()`, `client.settings`, jamais `client.key` (`docs/produit.md`).
- Les commentaires de code gardent leurs mots (« édition », « CRESS ») : ce sont des explications. Les clés techniques ne bougent pas : routes `/edition/[id]`, `perimetre=cress`, `data-testid`, noms de tables et de colonnes, `Person.role` (`director`, `raf`, `pole_lead`, `pilot`, `contributor`, `assistant`), clés de modules, clés de permissions.
- La suite Playwright existante tourne sous `NEXT_PUBLIC_CLIENT=cress` et doit rester verte **sans modifier les attentes des tests existants** (ils voient toujours « Toute la CRESS », « Édition », etc.).
- Le résultat du seed CRESS est identique avant et après le découpage (mêmes comptes de lignes par table).
- Pas de `rm -rf` sans demander à Gaël ; ne jamais `pkill -f "next dev"` (Aplomb tourne sur 3000) ; le serveur de dev est sur 3001 ; Playwright sur 3100 / `.next-test` / base `pilote_test`.
- Commits en français, message = ce que ça change pour l'outil, terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Avant chaque tâche : `git status` propre et `git log -1` pour vérifier qu'aucune autre session n'a écrit dans le dépôt.

---

## Carte des fichiers

**Créés**
- `config/clients/types.ts` — types `Client`, `Word`, `Vocab`, `Theme`, `FontSpec`, `Img`.
- `config/clients/cress.ts`, `config/clients/tlst.ts` — les deux clients.
- `config/clients/index.ts` — sélection par `NEXT_PUBLIC_CLIENT`, export `client`.
- `lib/vocab.ts` — `V` et helpers d'article / capitale / accord.
- `lib/branding.ts` — `branding()` : nom, logos, thème, polices (fichier aujourd'hui, base demain).
- `components/shell/logo.tsx` — `<Logo variant>`.
- `app/icon.tsx` — favicon du client.
- `public/clients/cress/{logo.png,logo-white.png,mark.png,favicon.png}` ; `public/clients/tlst/…` (TLST : placeholders générés, à remplacer par le vrai logo).
- `scripts/make-brand-images.py` — génère logo blanc, favicon, et les placeholders TLST.
- `scripts/check-vocab.mjs` — contrôle des mots en dur.
- `tests/unit/vocab.test.ts`, `tests/unit/clients.test.ts` — tests `node --test` via `tsx`.
- `prisma/seeds/common.ts`, `prisma/seeds/cress.ts`, `prisma/seeds/tlst.ts`.
- `prisma/migrations/<stamp>_settings_neutral_defaults/migration.sql`.
- `tests/habillage.spec.ts` — recette sous `tlst`.
- `deploy/instances/cress.env`, `deploy/instances/tlst.env`, `deploy/systemd/pilote@.service`, `deploy/nginx/tlst.bazixx.fr.conf`.

**Modifiés**
- `app/layout.tsx` (titre, `<style>` du thème, polices), `app/globals.css` (commentaire), `components/shell/sidebar.tsx`, `components/shell/topbar.tsx`, `components/auth/auth-shell.tsx` (Logo).
- `prisma/schema.prisma` (défauts neutres de `Settings.serverPathTemplate`, `billingEmail`), `prisma/seed.ts` (aiguillage).
- Les ≈ 180 fichiers de `app/`, `components/`, `lib/` qui affichent un mot du vocabulaire (liste par tâche plus bas).
- `playwright.config.ts` (projet `tlst`), `package.json` (scripts `test:unit`, `check:vocab`, `seed:tlst`).
- `deploy/deploy.sh`, `deploy/README.md`, `env.example`, `.gitignore` (rien à ajouter a priori).
- `docs/LOTS-TLST.md`, `docs/produit.md`, `docs/RETOURS-A-CHAUD.md`, `docs/charte.md`, `README.md`.

**Supprimés / déplacés**
- `app/favicon.ico` → supprimé (remplacé par `app/icon.tsx`).
- `public/logo-cress.png` → `public/clients/cress/logo.png` ; `public/logo-cress-mark.png` → `public/clients/cress/mark.png`.

---

### Task 1 : Types, fichiers clients, sélection

**Files:**
- Create: `config/clients/types.ts`, `config/clients/cress.ts`, `config/clients/tlst.ts`, `config/clients/index.ts`
- Test: `tests/unit/clients.test.ts`
- Modify: `package.json` (script `test:unit`)

**Interfaces:**
- Produces: `client: Client` (export de `config/clients/index.ts`) ; types `Client`, `Word`, `Vocab`, `Theme`, `FontSpec`, `Img` ; `CLIENT_KEYS = ["cress", "tlst"]`.

- [ ] **Step 1 : Écrire le test**

`tests/unit/clients.test.ts` :
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cress } from "../../config/clients/cress";
import { tlst } from "../../config/clients/tlst";
import { CLIENT_KEYS, clientFor } from "../../config/clients/index";

test("chaque client a un nom, ses quatre images et ses dix mots", () => {
  for (const c of [cress, tlst]) {
    assert.ok(c.shortName && c.longName, c.key);
    for (const k of ["color", "white", "mark"] as const) assert.match(c.logos[k].src, /^\/clients\/[a-z]+\/[a-z-]+\.png$/, `${c.key} ${k}`);
    assert.match(c.logos.favicon, /^\/clients\/[a-z]+\/favicon\.png$/);
    for (const w of ["projet", "edition", "action", "pole", "codir", "raf", "direction", "pilote"] as const) {
      assert.ok(c.vocab[w].one && c.vocab[w].many, `${c.key} vocab.${w}`);
      assert.ok(["m", "f"].includes(c.vocab[w].gender));
    }
  }
});

test("la CRESS garde ses mots d'aujourd'hui", () => {
  assert.equal(cress.shortName, "CRESS");
  assert.equal(cress.longName, "CRESS Centre-Val de Loire");
  assert.equal(cress.orgGender, "f");
  assert.equal(cress.vocab.edition.one, "édition");
  assert.equal(cress.vocab.pole.one, "pôle");
  assert.equal(cress.vocab.codir.one, "CODIR");
  assert.equal(cress.settings.serverPathTemplate, "\\\\cress\\Partage\\Action\\{code}\\{annee}");
  assert.equal(cress.settings.billingEmail, "factures@cress-cvl.example");
  assert.equal(cress.modules, "veille,adherents,tresorerie,materiel");
});

test("TLST parle d'actions, d'étapes et d'équipe", () => {
  assert.equal(tlst.shortName, "TLST");
  assert.equal(tlst.orgGender, "m");
  assert.equal(tlst.vocab.edition.one, "action");
  assert.equal(tlst.vocab.action.one, "étape");
  assert.equal(tlst.vocab.pole.one, "équipe");
  assert.equal(tlst.vocab.pole.gender, "f");
});

test("clientFor choisit par clé et refuse l'inconnu", () => {
  assert.deepEqual(CLIENT_KEYS, ["cress", "tlst"]);
  assert.equal(clientFor("cress"), cress);
  assert.equal(clientFor("tlst"), tlst);
  assert.equal(clientFor(undefined), cress);
  assert.throws(() => clientFor("acme"), /NEXT_PUBLIC_CLIENT/);
});
```

- [ ] **Step 2 : Ajouter le script et vérifier que le test échoue**

Dans `package.json`, scripts : `"test:unit": "tsx --test tests/unit/*.test.ts"`.

Run : `npm run test:unit`
Expected : échec, `Cannot find module '../../config/clients/cress'`.

- [ ] **Step 3 : Écrire `config/clients/types.ts`**

```ts
// Ce qui est propre à un client (docs/produit.md, lot I) : l'habillage livré avec le code. Le code métier n'importe jamais
// `key` ; il passe par lib/vocab.ts (les mots) et lib/branding.ts (nom, logos, thème, polices).
export type Word = { one: string; many: string; gender: "m" | "f" };

export type Vocab = {
  projet: Word;    // ce qui se répète d'une année sur l'autre
  edition: Word;   // le projet une année donnée — l'objet piloté
  action: Word;    // un jalon daté dans l'édition
  pole: Word;      // l'équipe d'une personne
  codir: Word;     // l'instance qui décide
  raf: Word;       // la personne qui suit les factures
  direction: Word; // la personne qui tranche
  pilote: Word;    // la personne responsable d'un projet
};

export type Img = { src: string; width: number; height: number };

// Un token par variable de app/globals.css :root ; ce qui manque garde la valeur produit.
export type Theme = Partial<Record<
  | "background" | "foreground" | "card" | "card-foreground" | "popover" | "popover-foreground"
  | "primary" | "primary-foreground" | "secondary" | "secondary-foreground" | "muted" | "muted-foreground"
  | "accent" | "accent-foreground" | "destructive" | "border" | "input" | "ring"
  | "coral" | "coral-foreground" | "mint" | "mint-soft" | "mint-pale" | "sand"
  | "warning" | "warning-foreground" | "warning-soft" | "danger" | "danger-soft" | "info-soft"
  | "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "radius"
  | "sidebar" | "sidebar-foreground" | "sidebar-primary" | "sidebar-primary-foreground"
  | "sidebar-accent" | "sidebar-accent-foreground" | "sidebar-border" | "sidebar-ring" | "sky" | "sky-strong",
  string
>>;

// Une pile de polices installées, ou une police Google chargée par next/font (nom exact de Google Fonts).
export type FontSpec = { stack: string } | { google: string; weights: ("400" | "600" | "700")[]; fallback: string };

export type Client = {
  key: string;
  shortName: string;
  longName: string;
  orgGender: "m" | "f";
  logos: { color: Img; white: Img; mark: Img; favicon: string };
  theme: Theme;
  fonts: { titles: FontSpec; sans: FontSpec };
  modules: string; // Settings.modules posé au seed
  settings: { serverPathTemplate: string; billingEmail: string; billingNote?: string };
  vocab: Vocab;
};
```

- [ ] **Step 4 : Écrire `config/clients/cress.ts`** (valeurs d'aujourd'hui, prises dans `app/globals.css`, `app/layout.tsx`, `prisma/schema.prisma`)

```ts
import type { Client } from "./types";

export const cress: Client = {
  key: "cress",
  shortName: "CRESS",
  longName: "CRESS Centre-Val de Loire",
  orgGender: "f",
  logos: {
    color: { src: "/clients/cress/logo.png", width: 465, height: 187 },
    white: { src: "/clients/cress/logo-white.png", width: 465, height: 187 },
    mark: { src: "/clients/cress/mark.png", width: 190, height: 177 },
    favicon: "/clients/cress/favicon.png",
  },
  // Charte V2 (maquette du 13/09/2026, inspirée du site CRESS Pays de la Loire) — mêmes valeurs que le thème produit.
  theme: {
    background: "#f7f7f3", foreground: "#243d49", card: "#ffffff", "card-foreground": "#243d49",
    popover: "#ffffff", "popover-foreground": "#243d49",
    primary: "#1b6a8a", "primary-foreground": "#ffffff", secondary: "#e6f0f5", "secondary-foreground": "#1b6a8a",
    muted: "#efefea", "muted-foreground": "#5e6c72", accent: "#e5f1eb", "accent-foreground": "#226552",
    destructive: "#a24533", border: "#dce3e5", input: "#b8c1b4", ring: "#1b6a8a",
    coral: "#ea5427", "coral-foreground": "#ffffff", mint: "#226552", "mint-soft": "#e5f1eb", "mint-pale": "#85c8b5", sand: "#f8e9c6",
    warning: "#8c601b", "warning-foreground": "#8c601b", "warning-soft": "#faf0d8", danger: "#a24533", "danger-soft": "#fae9e2", "info-soft": "#e6f0f5",
    "chart-1": "#1b6a8a", "chart-2": "#ea5427", "chart-3": "#85c8b5", "chart-4": "#8c601b", "chart-5": "#5e9bb8",
    sidebar: "#e9f3f8", "sidebar-foreground": "#5e6c72", "sidebar-primary": "#1b6a8a", "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#d7e9f2", "sidebar-accent-foreground": "#1b6a8a", "sidebar-border": "#d3e3ea", "sidebar-ring": "#1b6a8a",
    sky: "#cfe6f2", "sky-strong": "#a9d3e6",
  },
  fonts: {
    titles: { stack: '"Trebuchet MS", "Segoe UI", Arial, sans-serif' },
    sans: { stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' },
  },
  modules: "veille,adherents,tresorerie,materiel",
  settings: {
    serverPathTemplate: "\\\\cress\\Partage\\Action\\{code}\\{annee}",
    billingEmail: "factures@cress-cvl.example",
  },
  vocab: {
    projet: { one: "projet", many: "projets", gender: "m" },
    edition: { one: "édition", many: "éditions", gender: "f" },
    action: { one: "action", many: "actions", gender: "f" },
    pole: { one: "pôle", many: "pôles", gender: "m" },
    codir: { one: "CODIR", many: "CODIR", gender: "m" },
    raf: { one: "RAF", many: "RAF", gender: "f" },
    direction: { one: "direction", many: "directions", gender: "f" },
    pilote: { one: "pilote", many: "pilotes", gender: "m" },
  },
};
```

- [ ] **Step 5 : Écrire `config/clients/tlst.ts`**

```ts
import type { Client } from "./types";

// Tiers-Lieu Nourricier du Sud Touraine (Loches). Palette de départ : verts / terre d'un tiers-lieu nourricier (le vert forêt
// d'erp-tlst), à corriger par Gaël ; logos = placeholders générés par scripts/make-brand-images.py, à remplacer par le vrai logo.
export const tlst: Client = {
  key: "tlst",
  shortName: "TLST",
  longName: "Tiers-Lieu Nourricier du Sud Touraine",
  orgGender: "m",
  logos: {
    color: { src: "/clients/tlst/logo.png", width: 465, height: 187 },
    white: { src: "/clients/tlst/logo-white.png", width: 465, height: 187 },
    mark: { src: "/clients/tlst/mark.png", width: 190, height: 177 },
    favicon: "/clients/tlst/favicon.png",
  },
  theme: {
    background: "#f6f5ef", foreground: "#26332a", card: "#ffffff", "card-foreground": "#26332a",
    primary: "#3f6b4a", "primary-foreground": "#ffffff", secondary: "#e7efe6", "secondary-foreground": "#3f6b4a",
    muted: "#eeede4", "muted-foreground": "#5f6b62", accent: "#f2ead6", "accent-foreground": "#7a5a1e",
    destructive: "#9c4a2e", border: "#dcdfd3", input: "#b9c0b0", ring: "#3f6b4a",
    coral: "#c8742f", "coral-foreground": "#ffffff", mint: "#3f6b4a", "mint-soft": "#e7efe6", "mint-pale": "#9fc4a5", sand: "#f2ead6",
    warning: "#7a5a1e", "warning-foreground": "#7a5a1e", "warning-soft": "#f7f0dc", danger: "#9c4a2e", "danger-soft": "#f6e7df", "info-soft": "#e7efe6",
    "chart-1": "#3f6b4a", "chart-2": "#c8742f", "chart-3": "#9fc4a5", "chart-4": "#7a5a1e", "chart-5": "#6f8f7a",
    sidebar: "#eaf0e6", "sidebar-foreground": "#5f6b62", "sidebar-primary": "#3f6b4a", "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#d9e5d6", "sidebar-accent-foreground": "#3f6b4a", "sidebar-border": "#d3dccd", "sidebar-ring": "#3f6b4a",
    sky: "#d9e5d6", "sky-strong": "#b7cdb3",
  },
  fonts: {
    titles: { google: "Nunito", weights: ["600", "700"], fallback: '"Segoe UI", Arial, sans-serif' },
    sans: { stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' },
  },
  modules: "veille,adherents,tresorerie,materiel",
  settings: {
    serverPathTemplate: "\\\\nas\\Partage\\Actions\\{code}\\{annee}",
    billingEmail: "compta@tlst.example",
  },
  vocab: {
    projet: { one: "projet", many: "projets", gender: "m" },
    edition: { one: "action", many: "actions", gender: "f" },
    action: { one: "étape", many: "étapes", gender: "f" },
    pole: { one: "équipe", many: "équipes", gender: "f" },
    codir: { one: "bureau", many: "bureaux", gender: "m" },
    raf: { one: "trésorier·e", many: "trésorier·es", gender: "f" },
    direction: { one: "coordination", many: "coordinations", gender: "f" },
    pilote: { one: "responsable", many: "responsables", gender: "m" },
  },
};
```

- [ ] **Step 6 : Écrire `config/clients/index.ts`**

```ts
import { cress } from "./cress";
import { tlst } from "./tlst";
import type { Client } from "./types";

export type { Client, Vocab, Word, Theme, FontSpec, Img } from "./types";

// Un client par instance, choisi au build par NEXT_PUBLIC_CLIENT (deploy/instances/<instance>.env → .env serveur). Imports
// statiques : Next embarque le bon fichier côté serveur et navigateur, sans requête. Clé inconnue = échec franc au démarrage.
export const CLIENT_KEYS = ["cress", "tlst"] as const;

export function clientFor(key: string | undefined): Client {
  switch (key ?? "cress") {
    case "cress": return cress;
    case "tlst": return tlst;
    default: throw new Error(`NEXT_PUBLIC_CLIENT="${key}" inconnu : attendu ${CLIENT_KEYS.join(" | ")}`);
  }
}

export const client: Client = clientFor(process.env.NEXT_PUBLIC_CLIENT);
```

- [ ] **Step 7 : Lancer le test**

Run : `npm run test:unit`
Expected : 4 tests PASS.

- [ ] **Step 8 : Commit**

```bash
git add config tests/unit package.json
git commit -m "Lot I — fichiers clients : CRESS et TLST décrits (nom, logos, thème, polices, mots), choisis par NEXT_PUBLIC_CLIENT

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2 : Le vocabulaire (`lib/vocab.ts`)

**Files:**
- Create: `lib/vocab.ts`
- Test: `tests/unit/vocab.test.ts`

**Interfaces:**
- Consumes: `client`, `Word` (Task 1).
- Produces: `V` (les huit mots + `org`, `orgLong`), `cap(w | s)`, `le(w)`, `un(w)`, `du(w)`, `de(w)`, `au(w)`, `ce(w)`, `tout(w)`, `adj(w, masc, fem)`, `pl(w)` (= `w.many`), `Cap` alias de `cap`. Tous renvoient une `string`.

- [ ] **Step 1 : Écrire le test**

`tests/unit/vocab.test.ts` :
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Word } from "../../config/clients/types";
import { cap, le, un, du, de, au, ce, tout, adj, pl, elide } from "../../lib/vocab";

const edition: Word = { one: "édition", many: "éditions", gender: "f" };
const action: Word = { one: "action", many: "actions", gender: "f" };
const pole: Word = { one: "pôle", many: "pôles", gender: "m" };
const equipe: Word = { one: "équipe", many: "équipes", gender: "f" };
const cress: Word = { one: "CRESS", many: "CRESS", gender: "f" };
const tlst: Word = { one: "TLST", many: "TLST", gender: "m" };
const codir: Word = { one: "CODIR", many: "CODIR", gender: "m" };

test("élision devant une voyelle ou un h muet", () => {
  assert.equal(elide("édition"), true);
  assert.equal(elide("action"), true);
  assert.equal(elide("pôle"), false);
  assert.equal(elide("équipe"), true);
  assert.equal(elide("habilitation"), true);
  assert.equal(elide("CRESS"), false);
});

test("articles", () => {
  assert.equal(le(edition), "l'édition");
  assert.equal(le(pole), "le pôle");
  assert.equal(le(equipe), "l'équipe");
  assert.equal(le(cress), "la CRESS");
  assert.equal(le(tlst), "le TLST");
  assert.equal(un(edition), "une édition");
  assert.equal(un(pole), "un pôle");
  assert.equal(du(edition), "de l'édition");
  assert.equal(du(pole), "du pôle");
  assert.equal(du(cress), "de la CRESS");
  assert.equal(de(edition), "d'édition");
  assert.equal(de(pole), "de pôle");
  assert.equal(au(pole), "au pôle");
  assert.equal(au(edition), "à l'édition");
  assert.equal(au(cress), "à la CRESS");
  assert.equal(ce(pole), "ce pôle");
  assert.equal(ce(edition), "cette édition");
  assert.equal(ce(action), "cette action");
});

test("tout, capitale, accord, pluriel", () => {
  assert.equal(tout(cress), "toute la CRESS");
  assert.equal(tout(tlst), "tout le TLST");
  assert.equal(cap(tout(cress)), "Toute la CRESS");
  assert.equal(cap(edition), "Édition");
  assert.equal(cap(le(edition)), "L'édition");
  assert.equal(adj(pole, "nouveau", "nouvelle"), "nouveau pôle");
  assert.equal(adj(equipe, "nouveau", "nouvelle"), "nouvelle équipe");
  assert.equal(pl(edition), "éditions");
  assert.equal(cap(pl(codir)), "CODIR");
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `npm run test:unit`
Expected : échec, `Cannot find module '../../lib/vocab'`.

- [ ] **Step 3 : Écrire `lib/vocab.ts`**

```ts
// Les mots de l'outil, une fois pour toutes (lot I) : « édition » à la CRESS, « action » chez TLST… Le code métier n'écrit
// jamais ces mots en dur dans ce qui s'affiche : il passe par V et ces helpers (scripts/check-vocab.mjs y veille). Les
// commentaires de code gardent les mots CRESS. Les clés techniques (routes, data-testid, colonnes) ne bougent pas.
import { client } from "@/config/clients";
import type { Word } from "@/config/clients/types";

export type { Word };

export const V = {
  ...client.vocab,
  org: { one: client.shortName, many: client.shortName, gender: client.orgGender } as Word,
  orgLong: client.longName,
};

// Élision : voyelle ou h muet en tête (« l'édition », « d'équipe »). Les sigles en capitales ne s'élident pas (« la CRESS »).
export function elide(s: string): boolean {
  if (/^[A-Z]{2,}$/.test(s)) return false;
  return /^[aeiouyàâäéèêëîïôöùûüh]/i.test(s);
}

const asWord = (w: Word | string): Word => (typeof w === "string" ? { one: w, many: w, gender: "m" } : w);

export const cap = (w: Word | string): string => {
  const s = typeof w === "string" ? w : w.one;
  return s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1);
};
export const Cap = cap;
export const pl = (w: Word): string => w.many;

export const le = (w: Word): string => (elide(w.one) ? `l'${w.one}` : `${w.gender === "f" ? "la" : "le"} ${w.one}`);
export const les = (w: Word): string => `les ${w.many}`;
export const un = (w: Word): string => `${w.gender === "f" ? "une" : "un"} ${w.one}`;
export const du = (w: Word): string => (elide(w.one) ? `de l'${w.one}` : w.gender === "f" ? `de la ${w.one}` : `du ${w.one}`);
export const des = (w: Word): string => `des ${w.many}`;
export const de = (w: Word): string => (elide(w.one) ? `d'${w.one}` : `de ${w.one}`);
export const au = (w: Word): string => (elide(w.one) ? `à l'${w.one}` : w.gender === "f" ? `à la ${w.one}` : `au ${w.one}`);
export const ce = (w: Word): string => `${w.gender === "f" ? "cette" : elide(w.one) ? "cet" : "ce"} ${w.one}`;
export const tout = (w: Word): string => `${w.gender === "f" ? "toute" : "tout"} ${le(w)}`;
export const tous = (w: Word): string => `${w.gender === "f" ? "toutes" : "tous"} les ${w.many}`;
// Accord d'un adjectif antéposé : adj(V.pole, "nouveau", "nouvelle") → « nouveau pôle » / « nouvelle équipe ».
export const adj = (w: Word, masc: string, fem: string): string => `${w.gender === "f" ? fem : masc} ${w.one}`;
// Accord d'un participe ou adjectif postposé, avec le mot : ppe(V.edition, "validé") → « édition validée ».
export const ppe = (w: Word, base: string): string => `${w.one} ${base}${w.gender === "f" ? "e" : ""}`;
// Seulement la terminaison, pour un adjectif écrit ailleurs dans la phrase.
export const e = (w: Word): string => (w.gender === "f" ? "e" : "");

export { asWord };
```

- [ ] **Step 4 : Lancer le test**

Run : `npm run test:unit`
Expected : 7 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/vocab.ts tests/unit/vocab.test.ts
git commit -m "Lot I — vocabulaire : V et les helpers d'article, d'accord et de capitale

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3 : Images de marque (logos blancs, favicons, placeholders TLST)

**Files:**
- Create: `scripts/make-brand-images.py`, `public/clients/cress/{logo.png,logo-white.png,mark.png,favicon.png}`, `public/clients/tlst/{logo.png,logo-white.png,mark.png,favicon.png}`
- Delete: `public/logo-cress.png`, `public/logo-cress-mark.png` (déplacés), `app/favicon.ico` (à la Task 4)

**Interfaces:**
- Produces: les huit fichiers PNG aux chemins déclarés dans Task 1.

- [ ] **Step 1 : Déplacer les logos CRESS**

```bash
mkdir -p public/clients/cress public/clients/tlst
git mv public/logo-cress.png public/clients/cress/logo.png
git mv public/logo-cress-mark.png public/clients/cress/mark.png
```

- [ ] **Step 2 : Écrire `scripts/make-brand-images.py`**

```python
#!/usr/bin/env python3
"""Images de marque par client (lot I) : logo blanc (fond sombre), favicon (marque 64 px), et placeholders TLST tant que le
vrai logo n'est pas fourni. Relancer après avoir déposé un nouveau logo couleur : python3 scripts/make-brand-images.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent / "public" / "clients"

def whiten(src: Path, dst: Path) -> None:
    """Tous les pixels opaques passent en blanc, l'alpha est gardé : un logo pour fond sombre."""
    im = Image.open(src).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (255, 255, 255, a)
    im.save(dst)

def favicon(mark: Path, dst: Path, size: int = 64) -> None:
    im = Image.open(mark).convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    canvas.save(dst)

def wordmark(text: str, color: tuple, size: tuple, dst: Path, font_size: int) -> None:
    """Placeholder : le sigle en gras, centré, fond transparent."""
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf", font_size)
    except OSError:
        font = ImageFont.load_default(size=font_size)
    box = draw.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text(((size[0] - w) / 2 - box[0], (size[1] - h) / 2 - box[1]), text, fill=color, font=font)
    im.save(dst)

def main() -> None:
    cress = ROOT / "cress"
    whiten(cress / "logo.png", cress / "logo-white.png")
    favicon(cress / "mark.png", cress / "favicon.png")

    tlst = ROOT / "tlst"
    tlst.mkdir(parents=True, exist_ok=True)
    green = (63, 107, 74, 255)  # primary TLST (config/clients/tlst.ts)
    wordmark("TLST", green, (465, 187), tlst / "logo.png", 120)
    wordmark("TLST", (255, 255, 255, 255), (465, 187), tlst / "logo-white.png", 120)
    wordmark("T", green, (190, 177), tlst / "mark.png", 150)
    favicon(tlst / "mark.png", tlst / "favicon.png")
    print("ok :", *sorted(p.relative_to(ROOT.parent) for p in ROOT.rglob("*.png")), sep="\n  ")

if __name__ == "__main__":
    main()
```

- [ ] **Step 3 : Générer et vérifier**

Run : `python3 scripts/make-brand-images.py && ls -la public/clients/cress public/clients/tlst`
Expected : 4 PNG par client. Ouvrir `public/clients/cress/logo-white.png` (Read) : le logo en blanc sur transparent ; `public/clients/tlst/logo.png` : « TLST » en vert.

- [ ] **Step 4 : Commit**

```bash
git add scripts/make-brand-images.py public/clients public/logo-cress.png public/logo-cress-mark.png
git commit -m "Lot I — images de marque par client : logos CRESS déplacés, logo blanc et favicon générés, placeholders TLST

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4 : `branding()`, composant Logo, favicon, thème et polices dans le layout

**Files:**
- Create: `lib/branding.ts`, `components/shell/logo.tsx`, `app/icon.tsx`
- Modify: `app/layout.tsx`, `components/shell/sidebar.tsx:143-147`, `components/shell/topbar.tsx:34`, `components/auth/auth-shell.tsx:10`, `app/globals.css:66-70` (commentaire)
- Delete: `app/favicon.ico`
- Test: vérification manuelle en dev sous `cress` puis `tlst` (le test Playwright vient en Task 9)

**Interfaces:**
- Consumes: `client` (Task 1).
- Produces: `branding(): Branding` = `{ shortName, longName, logos, themeCss: string, fonts }` ; `<Logo variant="color" | "white" | "mark" className? />` ; `app/icon.tsx` (route `/icon`).

- [ ] **Step 1 : Écrire `lib/branding.ts`**

```ts
// Point d'entrée unique de l'habillage (lot I) : aujourd'hui le fichier client, demain le fichier surchargé par ce que la base
// contiendra (écran admin › Apparence, feuille de route). Le layout, le logo et le favicon ne lisent que ceci.
import { client } from "@/config/clients";
import type { FontSpec, Img, Theme } from "@/config/clients/types";

export type Branding = {
  shortName: string;
  longName: string;
  logos: { color: Img; white: Img; mark: Img; favicon: string };
  themeCss: string; // « --primary: #…; --sidebar: #…; » à poser dans :root
  fonts: { titles: FontSpec; sans: FontSpec };
};

export function themeToCss(theme: Theme): string {
  return Object.entries(theme).map(([k, v]) => `--${k}: ${v};`).join(" ");
}

export function branding(): Branding {
  return {
    shortName: client.shortName,
    longName: client.longName,
    logos: client.logos,
    themeCss: themeToCss(client.theme),
    fonts: client.fonts,
  };
}

// Pile CSS d'une police : la pile locale telle quelle, ou la police Google suivie de son repli.
export function fontStack(spec: FontSpec): string {
  return "stack" in spec ? spec.stack : `"${spec.google}", ${spec.fallback}`;
}
```

- [ ] **Step 2 : Écrire `components/shell/logo.tsx`**

```tsx
import { withBase } from "@/lib/base-path";
import { branding } from "@/lib/branding";
import { cn } from "@/lib/utils";

// Le logo du client (lot I) : couleur (barre latérale, connexion), blanc (fond sombre : projection, bandeaux), marque seule
// (mobile, barre repliée). PNG statique servi tel quel : l'optimiseur d'images ne gère pas le basePath.
export function Logo({ variant, className, decorative = false }: { variant: "color" | "white" | "mark"; className?: string; decorative?: boolean }) {
  const b = branding();
  const img = b.logos[variant];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={withBase(img.src)} alt={decorative ? "" : b.longName} width={img.width} height={img.height} className={cn("h-auto", className)} />;
}
```

- [ ] **Step 3 : Écrire `app/icon.tsx`** (Next sert ce fichier comme favicon, y compris sous `basePath`)

```tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { branding } from "@/lib/branding";

export const dynamic = "force-static";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Favicon du client (lot I) : le PNG de public/clients/<client>/favicon.png, servi par la route /icon que Next référence seule.
export default async function Icon() {
  const file = await readFile(path.join(process.cwd(), "public", branding().logos.favicon));
  return new Response(file, { headers: { "Content-Type": contentType } });
}
```

Puis : `git rm app/favicon.ico`.

- [ ] **Step 4 : Modifier `app/layout.tsx`**

Remplacer l'import et `metadata` :
```ts
import { branding, fontStack } from "@/lib/branding";
import { Nunito } from "next/font/google";

// Police Google des titres quand le client en déclare une (TLST : Nunito). next/font exige un appel statique par police :
// on charge celles que les clients connus utilisent ; un client à pile locale ne s'en sert pas.
const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--font-google-nunito" });
const GOOGLE_FONTS: Record<string, { className: string; variable: string }> = { Nunito: { className: nunito.variable, variable: "var(--font-google-nunito)" } };

const brand = branding();
export const metadata: Metadata = {
  title: `Pilote · ${brand.longName}`,
  description: "Outil de pilotage des projets",
};

// Tokens du thème et polices du client, posés sur :root par-dessus les valeurs produit de globals.css.
function themeStyle(): string {
  const titles = "google" in brand.fonts.titles ? `${GOOGLE_FONTS[brand.fonts.titles.google]?.variable ?? `"${brand.fonts.titles.google}"`}, ${brand.fonts.titles.fallback}` : fontStack(brand.fonts.titles);
  const sans = "google" in brand.fonts.sans ? `${GOOGLE_FONTS[brand.fonts.sans.google]?.variable ?? `"${brand.fonts.sans.google}"`}, ${brand.fonts.sans.fallback}` : fontStack(brand.fonts.sans);
  return `:root { ${brand.themeCss} --font-titles: ${titles}; --font-sans: ${sans}; }`;
}
const fontClasses = [brand.fonts.titles, brand.fonts.sans].map((f) => ("google" in f ? GOOGLE_FONTS[f.google]?.className ?? "" : "")).join(" ").trim();
```

Dans les deux `return` du layout, remplacer `<html lang="fr">` par :
```tsx
<html lang="fr" className={fontClasses || undefined}>
  <head><style dangerouslySetInnerHTML={{ __html: themeStyle() }} /></head>
```
(le `<head>` explicite est accepté par l'App Router ; Next y fusionne ses propres balises).

- [ ] **Step 5 : Remplacer les `<img>` des logos**

`components/shell/sidebar.tsx` (lignes 143-147) :
```tsx
<Link href="/portefeuille" className="flex items-center justify-center" aria-label={`${branding().longName} · Portefeuille`}>
  <Logo variant="color" className={cn("w-[120px]", collapsed ? "hidden" : "hidden lg:block")} />
  <Logo variant="mark" decorative className={cn("w-8", collapsed ? "block" : "lg:hidden")} />
</Link>
```
avec `import { Logo } from "./logo";` et `import { branding } from "@/lib/branding";` ; retirer l'import `withBase` s'il ne sert plus qu'aux logos.

`components/shell/topbar.tsx` (ligne 34) : `<span className="md:hidden"><Logo variant="mark" className="w-6" /></span>`.

`components/auth/auth-shell.tsx` (ligne 10) : `<Logo variant="color" className="mx-auto mb-6 w-[170px]" />` ; retirer l'import `withBase`.

- [ ] **Step 6 : Commentaire dans `app/globals.css`** (ligne 66) : ajouter « Ces valeurs sont le thème produit de repli ; le client les surcharge dans le layout (lib/branding.ts, lot I). »

- [ ] **Step 7 : Vérifier en dev**

Run : `npm run lint && npx tsc --noEmit`
Expected : aucune erreur.

Run (le serveur de dev sur 3001 doit être relancé pour prendre `NEXT_PUBLIC_CLIENT`) : `preview_start` avec la configuration `.claude/launch.json` de la racine CRESS/, puis dans le navigateur : le titre de l'onglet « Pilote · CRESS Centre-Val de Loire », le logo dans la barre latérale, le favicon CRESS (requête `/icon` en 200 dans `read_network_requests`), les couleurs inchangées (`javascript_tool` : `getComputedStyle(document.documentElement).getPropertyValue("--primary")` = `#1b6a8a`).

Puis arrêter ce serveur et relancer avec `NEXT_PUBLIC_CLIENT=tlst` (variable dans l'environnement du serveur, `.claude/launch.json` accepte `env`) : titre « Pilote · Tiers-Lieu Nourricier du Sud Touraine », placeholder « TLST » vert, `--primary` = `#3f6b4a`, titres en Nunito (`getComputedStyle(document.querySelector("h1")).fontFamily` contient « Nunito »). Revenir à `cress`.

- [ ] **Step 8 : Suite Playwright**

Run : `npm test`
Expected : tout vert (≈ 4 min). Si un test cherche `/logo-cress.png`, corriger le test pour chercher `img[alt="CRESS Centre-Val de Loire"]` (même attente fonctionnelle).

- [ ] **Step 9 : Commit**

```bash
git add lib/branding.ts components/shell/logo.tsx app/icon.tsx app/favicon.ico app/layout.tsx app/globals.css components/shell/sidebar.tsx components/shell/topbar.tsx components/auth/auth-shell.tsx tests
git commit -m "Lot I — le layout s'habille depuis le client : titre, thème complet, polices, logos et favicon

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5 : Défauts neutres de `Settings` (migration)

**Files:**
- Modify: `prisma/schema.prisma` (`Settings.serverPathTemplate`, `Settings.billingEmail`)
- Create: `prisma/migrations/<stamp>_settings_neutral_defaults/migration.sql` (généré)
- Modify: `prisma/seed.ts:126-135` (le seed pose les valeurs du client — provisoire jusqu'à la Task 7 qui découpe le seed)

**Interfaces:**
- Consumes: `client.settings` (Task 1).

- [ ] **Step 1 : Modifier le schéma**

```prisma
  // Gabarit du chemin du dossier de référence sur le serveur ({code}, {annee}) — posé par le seed du client (lot I).
  serverPathTemplate        String @default("")
  …
  // Adresse de facturation écrite sur le bon pour accord (lot 3) — posée par le seed du client (lot I).
  billingEmail              String  @default("")
```

- [ ] **Step 2 : Générer la migration**

Run : `npx prisma migrate dev --name settings_neutral_defaults --create-only && cat prisma/migrations/*settings_neutral_defaults/migration.sql`
Expected : deux `ALTER TABLE "Settings" ALTER COLUMN … SET DEFAULT ''`. Puis `npx prisma migrate dev` (applique sur `pilote_dev`).

- [ ] **Step 3 : Le seed pose les valeurs du client**

Dans `prisma/seed.ts`, `prisma.settings.create({ data: { id: 1, … } })` : ajouter `serverPathTemplate: client.settings.serverPathTemplate, billingEmail: client.settings.billingEmail, modules: client.modules,` avec `import { client } from "../config/clients";` en tête. Retirer `billingEmail` et `modules` de l'`update` de la ligne 1035 (ils sont posés à la création ; `operatingDaysPerMonth: 1.5` y reste).

- [ ] **Step 4 : Vérifier**

Run : `npm run seed && psql postgresql://pilote:pilote@localhost:5432/pilote_dev -Atc 'select "serverPathTemplate", "billingEmail", modules from "Settings"'`
Expected : `\\cress\Partage\Action\{code}\{annee}|factures@cress-cvl.example|veille,adherents,tresorerie,materiel`.

- [ ] **Step 5 : Commit**

```bash
git add prisma
git commit -m "Lot I — Settings : chemin serveur et adresse de facturation sans défaut CRESS, posés par le seed du client

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6 : Le contrôle des mots en dur (`scripts/check-vocab.mjs`)

**Files:**
- Create: `scripts/check-vocab.mjs`
- Modify: `package.json` (script `check:vocab`)

**Interfaces:**
- Produces: `npm run check:vocab` → liste `fichier:ligne: extrait` et code de retour 1 si trouvaille, 0 sinon ; option `--words` pour lister les motifs.

- [ ] **Step 1 : Écrire le script**

```js
#!/usr/bin/env node
// Lot I : aucun mot du vocabulaire client en dur dans ce qui s'affiche. Parcourt l'AST TypeScript de app/, components/, lib/ et
// ne regarde que les chaînes (littéraux, gabarits) et le texte JSX — jamais les commentaires ni les identifiants. Exclusions :
// config/clients/, lib/vocab.ts, lib/lexique.ts (compose avec V), les attributs data-testid, et une ligne marquée `// vocab-ok`.
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["app", "components", "lib"];
const SKIP = [/^lib\/vocab\.ts$/, /^lib\/lexique\.ts$/, /^config\//];
// Motifs sensibles à la casse : « Pilote » (le produit) et « edition » sans accent (routes) ne comptent pas.
const WORDS = [
  ["CRESS", /CRESS/],
  ["édition", /\b[Éé]ditions?\b/],
  ["pôle", /\b[Pp]ôles?\b/],
  ["CODIR", /\bCODIR\b/],
  ["RAF", /\bRAF\b/],
  ["direction", /\b[Dd]irection\b/],
  ["pilote", /\bpilotes?\b/],
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) yield p;
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
        if (!isTestId && !isImport) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
          if (!/vocab-ok/.test(lines[line])) {
            for (const [label, re] of WORDS) {
              const m = s.match(re);
              if (m) findings.push(`${file}:${line + 1}: [${label}] ${s.trim().slice(0, 90).replace(/\n/g, " ")}`);
            }
          }
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
```

`package.json` : `"check:vocab": "node scripts/check-vocab.mjs"`.

- [ ] **Step 2 : Lancer, constater le rouge, garder le compte**

Run : `npm run check:vocab 2>&1 | tail -3`
Expected : plusieurs centaines de trouvailles, code 1. Noter le nombre dans le message de commit : c'est le point de départ des Tasks 7 à 8.

- [ ] **Step 3 : Commit**

```bash
git add scripts/check-vocab.mjs package.json
git commit -m "Lot I — check:vocab : le contrôle des mots en dur (AST, chaînes et texte JSX seulement) — N trouvailles au départ

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7 : Passage du vocabulaire — socle (`lib/`, `components/`)

**Files:**
- Modify: `lib/lexique.ts`, `lib/modules.ts`, `lib/permissions.ts`, `lib/navigation.ts`, `lib/requests.ts`, `lib/scope.ts`, `lib/ics.ts`, `lib/organisations.ts`, `lib/notes.ts`, `lib/calls.ts`, `lib/alerts.ts`, `lib/budget.ts`, `lib/conventions.ts`, `lib/deadline-notifications.ts`, `lib/fiche-docx.ts`, `lib/fields.ts`, `lib/ledger.ts`, `lib/ledger-db.ts`, `lib/load.ts`, `lib/lock.ts`, `lib/matrix.ts`, `lib/people.ts`, `lib/projects.ts`, `lib/queries.ts`, `lib/refs.ts`, `lib/rights.ts`, `lib/roles.ts`, `lib/session.ts`, `lib/tasks.ts`, `lib/treasury.ts`, `lib/brevo-sync.ts`, `lib/auth.ts`, et tous les `components/**` listés par `npm run check:vocab`.

**Interfaces:**
- Consumes: `V`, `cap`, `le`, `un`, `du`, `de`, `au`, `ce`, `tout`, `tous`, `adj`, `ppe`, `e`, `pl` (Task 2).
- Produces: `lexique(): { term; def; example }[]` (remplace la constante `LEXIQUE`) ; `wideViewLabel(me)` renvoie `cap(tout(V.org))` pour la direction ; `VISIBILITIES`, `INSTANCE_MODULES`, `PERMISSIONS`, `DEFAULT_ROLES` gardent leurs formes (constantes calculées à l'import avec `V`).

- [ ] **Step 1 : Règles de remplacement** (à appliquer à chaque trouvaille de `check:vocab` dans `lib/` et `components/`)

| Trouvé | Écrire |
|---|---|
| `"Toute la CRESS"` | `` `${cap(tout(V.org))}` `` |
| `"toute la CRESS"` | `` `${tout(V.org)}` `` |
| `"CRESS Centre-Val de Loire"` | `V.orgLong` |
| `"CRESS"` seul (signature, catégorie iCal) | `V.org.one` |
| `"Édition"` / `"Éditions"` (titre, colonne) | `cap(V.edition)` / `cap(pl(V.edition))` |
| `"l'édition"`, `"une édition"`, `"de l'édition"`, `"cette édition"` | `le(V.edition)`, `un(V.edition)`, `du(V.edition)`, `ce(V.edition)` |
| `"Nouvelle édition"` | `cap(adj(V.edition, "nouveau", "nouvelle"))` |
| `"édition validée"` | `ppe(V.edition, "validé")` |
| `"Mon pôle"` | `` `Mon ${V.pole.one}` `` (« mon » vaut pour les deux genres devant voyelle ; devant consonne féminine → `` `${V.pole.gender === "f" ? "Ma" : "Mon"} ${V.pole.one}` `` : ajouter le helper `mon(w)` dans `lib/vocab.ts` si le cas se présente plus d'une fois) |
| `"le CODIR"`, `"la RAF"`, `"la direction"`, `"le pilote"` | `le(V.codir)`, `le(V.raf)`, `le(V.direction)`, `le(V.pilote)` |
| Phrase d'aide longue | reformuler sans le mot si naturel, sinon gabarit avec `${…}` |
| Commentaire `//` | ne rien changer |

Imports : `import { V, cap, le, un, du, de, au, ce, tout, tous, adj, ppe, e, pl } from "@/lib/vocab";` (ne garder que ce qui sert : `npm run lint` signale les imports inutilisés).

- [ ] **Step 2 : `lib/lexique.ts`** — transformer la constante en fonction :

```ts
import { V, cap, le, un, du, ce, pl } from "@/lib/vocab";
export type LexiqueEntry = { term: string; def: string; example: string };
export function lexique(): LexiqueEntry[] {
  return [
    { term: cap(V.projet), def: `Ce qui se répète d'une année sur l'autre : un code analytique, ${un(V.pilote)}, ${un(V.pole)}, une mission du plan opérationnel.`, example: "« Mois de l'ESS » (MOI-01)" },
    { term: cap(V.edition), def: `Le projet une année donnée : la fiche en quatre couches, le budget, l'équipe, le temps, les financements, la décision ${du(V.codir)}. C'est l'objet que l'on pilote.`, example: `« Mois de l'ESS · 2026 »` },
    { term: cap(V.action), def: `Une étape ou une occurrence dans ${le(V.edition)} : un jalon daté, un responsable, un état, éventuellement publique (flux agenda du site).`, example: "« Soirée de lancement 12 novembre »" },
    // … chaque entrée existante, réécrite avec V ; « la CRESS » → le(V.org) ; le reste du texte inchangé.
  ];
}
```
Adapter `components/common/lexique-dialog.tsx` (appel `lexique()`, et la phrase « Vocabulaire à valider avec la CRESS » → `` `Vocabulaire à valider avec ${le(V.org)}` ``) et les autres importateurs de `LEXIQUE` (`grep -rn "LEXIQUE" app components lib`).

- [ ] **Step 3 : `lib/requests.ts`, `lib/navigation.ts`, `lib/scope.ts`, `components/common/perimeter.tsx`**

`wideViewLabel` : `return me.role === "director" ? cap(tout(V.org)) : null;`. `perimeter.tsx` : `chip("pole", \`Mon ${V.pole.one} · ${poleName}\`)` et `chip("cress", cap(tout(V.org)))` — la clé `"cress"` du `Perimeter` reste (technique).

- [ ] **Step 4 : `lib/modules.ts`, `lib/permissions.ts`, `lib/roles.ts`, `lib/organisations.ts`, `lib/ics.ts`** — libellés et hints avec `V` ; `PRODID` iCal = `` `-//${V.orgLong}//Pilote//FR` `` ; nom du calendrier public `` `${V.orgLong} · agenda` `` ; catégorie `V.org.one`.

- [ ] **Step 5 : Le reste de `lib/` et `components/`** jusqu'à ce que `npm run check:vocab | grep -E "^(lib|components)/"` soit vide.

- [ ] **Step 6 : Vérifier**

Run : `npm run lint && npx tsc --noEmit && npm run check:vocab | grep -cE "^(lib|components)/"`
Expected : lint et types OK ; `0`.

Run : `npm test`
Expected : tout vert. Les textes rendus sous `cress` sont **identiques** (mêmes mots, mêmes majuscules) ; une différence signalée par un test = une faute de reformulation, pas une attente à changer.

- [ ] **Step 7 : Commit**

```bash
git add lib components
git commit -m "Lot I — vocabulaire : socle (lexique, navigation, périmètre, droits, modules, iCal, composants communs) passé par V

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8 : Passage du vocabulaire — écrans (`app/`)

**Files:**
- Modify: tous les fichiers de `app/` listés par `npm run check:vocab` (≈ 120 : `app/edition/**` 30, `app/actions/**` 24, `app/admin/**` 8, `app/conventions/**` 5, `app/projets/**` 4, `app/plan-de-charge/**` 4, `app/matrice/**` 3, `app/materiel/**` 3, `app/demandes/**` 3, `app/contacts/**` 3, `app/codir/**` 3, `app/cloture/**` 3, et un ou deux fichiers dans `tresorerie`, `temps`, `seminaire`, `portefeuille`, `notes`, `appels`, `api`, `annuel`, `validations`, `taches`, `plan-operationnel`, `organisations`, `mot-de-passe-oublie`, `ma-semaine`, `financeurs`, `echeances`, `connexion`, `compte`, `cafe`, `adherents`).

**Interfaces:**
- Consumes: Task 2 et Task 7.

Faire en **quatre commits** pour garder des diffs relisibles, avec `npm test` avant chacun :

- [ ] **Step 1 : `app/edition/**` et `app/actions/**`** (mêmes règles que Task 7, Step 1). Cas particuliers : `app/edition/[id]/edition-menu.tsx` « La fiche (Word, gabarit CRESS) » → `` `La fiche (Word, gabarit ${V.org.one})` `` ; `app/edition/[id]/documents.tsx` « Chemins sur le serveur de la CRESS » → `` `Chemins sur le serveur ${du(V.org)}` `` ; les notifications et sujets de mail dans `app/actions/*.ts` (ex. `expenses.ts:28`) avec `V`.

Run : `npm run check:vocab | grep -cE "^app/(edition|actions)/"` → `0` ; `npm test` vert. Commit : « Lot I — vocabulaire : fiche d'édition et actions serveur ».

- [ ] **Step 2 : `app/admin/**`, `app/codir/**`, `app/demandes/**`, `app/validations/**`, `app/cloture/**`, `app/conventions/**`, `app/projets/**`** — `app/admin/page.tsx:97` « paramétrable par le référent CRESS » → `` `paramétrable par le référent ${V.org.one}` `` ; `app/validations/[id]/bon-pour-accord/page.tsx:22,31` sujet et corps avec `V.orgLong` et `le(V.direction)` (le rôle `director` → libellé « directrice » : garder la phrase telle quelle sous une forme neutre : `` `${v.decider?.role === "director" ? le(V.direction) : "responsable habilité·e"}` ``) ; `app/demandes/page.tsx:57,99` et `request-row.tsx` avec `cap(tout(V.org))`.

Run : `npm run check:vocab | grep -cE "^app/(admin|codir|demandes|validations|cloture|conventions|projets)/"` → `0` ; `npm test` vert. Commit : « Lot I — vocabulaire : admin, CODIR, demandes, validations, clôture, dossiers, projets ».

- [ ] **Step 3 : `app/materiel/**`, `app/contacts/**`, `app/adherents/**`, `app/tresorerie/**`, `app/organisations/**`, `app/financeurs/**`, `app/appels/**`** — `app/materiel/pret/[id]/page.tsx:44,55,119,120` (sujet, signature, fiche imprimée : `V.org.one`, « Pour la CRESS » → `` `Pour ${le(V.org)}` ``) ; `app/materiel/controls.tsx:52` placeholder « Kakemono CRESS » → `` `Kakemono ${V.org.one}` `` ; `app/appels/page.tsx:21,113`.

Run : `npm run check:vocab | grep -cE "^app/(materiel|contacts|adherents|tresorerie|organisations|financeurs|appels)/"` → `0` ; `npm test` vert. Commit : « Lot I — vocabulaire : matériel, contacts, adhérents, trésorerie, annuaire, appels ».

- [ ] **Step 4 : Tout le reste** (`temps`, `plan-de-charge`, `matrice`, `seminaire`, `portefeuille`, `notes`, `api`, `annuel`, `taches`, `plan-operationnel`, `ma-semaine`, `echeances`, `connexion`, `mot-de-passe-oublie`, `compte`, `cafe`, `layout.tsx`) — `app/matrice/export/route.ts:8` (commentaire : rien) et le nom de feuille / titres d'export ; `app/plan-operationnel/export/route.ts:24` → `` `Plan opérationnel ${year} — ${V.orgLong}` `` ; `app/annuel/filters.tsx:19` → `cap(tout(V.org))` ; `app/notes/editor.tsx:22` et `app/notes/page.tsx:70`.

Run : `npm run check:vocab`
Expected : `✔ aucun mot du vocabulaire en dur dans ce qui s'affiche`, code 0.

Run : `npm run lint && npx tsc --noEmit && npm test`
Expected : tout vert.

Commit : « Lot I — vocabulaire : tous les écrans passés par V, check:vocab au vert ».

- [ ] **Step 5 : Vérification visuelle sous `tlst`**

Relancer le dev sur 3001 avec `NEXT_PUBLIC_CLIENT=tlst` ; parcourir portefeuille, une fiche d'action, matrice, demandes, admin, annuaire, trésorerie, adhérents, matériel, notes, lexique. Chercher à l'œil un « édition », « pôle », « CRESS », un article faux (« le équipe », « de la action »), une majuscule manquante. Corriger dans le code (jamais dans le fichier client), relancer `npm run check:vocab`. Captures d'écran (outil `computer` → screenshot) enregistrées dans `docs/screens/tlst/` : `portefeuille.png`, `fiche-action.png`, `admin.png`, `lexique.png`. Revenir à `cress`.

Commit : « Lot I — docs : captures de l'instance TLST ».

---

### Task 9 : Seeds — tronc commun, seed CRESS inchangé, seed TLST

**Files:**
- Create: `prisma/seeds/common.ts`, `prisma/seeds/cress.ts`, `prisma/seeds/tlst.ts`
- Modify: `prisma/seed.ts` (devient l'aiguillage), `package.json` (`seed:tlst`)

**Interfaces:**
- Produces: `seedCommon(prisma, opts): Promise<{ passwordHash, roles }>` ; `seedCress(prisma)` ; `seedTlst(prisma, { skeleton: boolean })` ; `prisma/seed.ts` lit `NEXT_PUBLIC_CLIENT` et `--skeleton`.

- [ ] **Step 1 : Relever l'empreinte du seed CRESS avant découpage**

Run :
```bash
npm run seed >/dev/null && psql postgresql://pilote:pilote@localhost:5432/pilote_dev -Atc "select table_name from information_schema.tables where table_schema='public' and table_name not like '_prisma%' order by 1" | while read t; do echo "$t $(psql postgresql://pilote:pilote@localhost:5432/pilote_dev -Atc "select count(*) from \"$t\"")"; done > /tmp/seed-cress-before.txt; cat /tmp/seed-cress-before.txt | head -60
```
Expected : une ligne par table avec son compte.

- [ ] **Step 2 : Écrire `prisma/seeds/common.ts`** — le tronc commun extrait de `prisma/seed.ts` : `reset()` (lignes 58-121, inchangé), la création de `Settings` (lignes 126-135, avec `client.settings` et `client.modules`), `REF_DEFAULTS`, `DEFAULT_ROLES`, `DEFAULT_RHYTHMS`, le hachage du mot de passe de démo, `placeholderPdf`/`storePdf`, `rnd`/`between`, `today`/`d`.

```ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";
import { client } from "../../config/clients";
import { REF_DEFAULTS } from "../../lib/refs";
import { DEFAULT_ROLES, serializePermissions } from "../../lib/permissions";
import { DEFAULT_RHYTHMS } from "../../lib/time";

export type Common = { passwordHash: string; rhythmByCode: (code: string) => { id: string; code: string }; emailOf: (name: string) => string };

// Ce que toute instance a au départ (lot I) : la base vidée, Settings du client, référentiels, rôles, rythmes, et le mot de passe
// de démo (DEMO_PASSWORD, « pilote-demo-2026 »). Le résultat pour la CRESS est identique au seed d'avant le découpage.
export async function seedCommon(prisma: PrismaClient, uploads: string): Promise<Common> {
  await reset(prisma, uploads);
  await prisma.settings.create({ data: { id: 1, teamIcsToken: randomBytes(18).toString("base64url"), apiToken: randomBytes(18).toString("base64url"), serverPathTemplate: client.settings.serverPathTemplate, billingEmail: client.settings.billingEmail, ...(client.settings.billingNote ? { billingNote: client.settings.billingNote } : {}), modules: client.modules, timeRules: TIME_RULES } });
  for (const [family, defs] of Object.entries(REF_DEFAULTS)) await prisma.refValue.createMany({ data: defs.map((v, i) => ({ family, code: v.code, label: v.label, color: v.color ?? null, order: i })) });
  await prisma.role.createMany({ data: DEFAULT_ROLES.map((r, i) => ({ code: r.code, label: r.label, description: r.description, order: i, system: true, validationLevel: r.validationLevel, permissions: serializePermissions(r.permissions) })) });
  const rhythms = await Promise.all(DEFAULT_RHYTHMS.map((r, i) => prisma.rhythm.create({ data: { ...r, order: i } })));
  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD ?? "pilote-demo-2026");
  const emailOf = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "") + "@exemple.fr";
  return { passwordHash, rhythmByCode: (code) => rhythms.find((r) => r.code === code)!, emailOf };
}
// TIME_RULES = la chaîne timeRules actuelle du seed (lignes 130-133), reprise telle quelle.
// reset() = les lignes 58-121 actuelles, avec `prisma` et `uploads` en paramètres.
// Une personne avec son compte (lot F) : User + Account credential + Person.
export async function createPerson(prisma: PrismaClient, c: Common, data: { name: string; role: string; rhythm: string; poleId: string | null; days: number; order: number; jobTitle?: string; phone?: string; arrivedAt?: string }) {
  const email = c.emailOf(data.name);
  const user = await prisma.user.create({ data: { name: data.name, email, emailVerified: true } });
  await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: c.passwordHash } });
  const p = await prisma.person.create({ data: { name: data.name, firstName: data.name.split(" ")[0], lastName: data.name.split(" ").slice(1).join(" "), jobTitle: data.jobTitle ?? null, phone: data.phone ?? null, arrivedAt: data.arrivedAt ? new Date(data.arrivedAt) : null, role: data.role, workRhythm: data.rhythm, availableDays: data.days, poleId: data.poleId, order: data.order, icsToken: randomBytes(18).toString("base64url"), email, userId: user.id } });
  await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: c.rhythmByCode(data.rhythm).id, from: new Date("2026-01-01") } });
  return p;
}
```

- [ ] **Step 3 : Écrire `prisma/seeds/cress.ts`** — le corps actuel de `main()` après la ligne 141 (rythmes), déplacé **tel quel** dans `export async function seedCress(prisma: PrismaClient, c: Common, uploads: string)` (`UPLOADS` du seed actuel = ce paramètre), en remplaçant : `rhythmByCode` → `c.rhythmByCode`, `passwordHash` → `c.passwordHash`, `emailOf` → `c.emailOf`. La boucle de création des personnes (lignes 247-262) reste telle quelle (elle gère les périodes de rythme particulières de Camille et Thomas) — `createPerson` du tronc commun n'est utilisé que par TLST. Les helpers `rnd`, `between`, `today`, `d`, `placeholderPdf`, `storePdf` restent dans ce fichier (ils sont propres au jeu CRESS).

- [ ] **Step 4 : Réécrire `prisma/seed.ts`** (aiguillage)

```ts
// Seed de l'instance (lot I) : le client vient de NEXT_PUBLIC_CLIENT (cress par défaut). `--skeleton` = sans données de démo.
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { client } from "../config/clients";
import { seedCommon } from "./seeds/common";
import { seedCress } from "./seeds/cress";
import { seedTlst } from "./seeds/tlst";

const prisma = new PrismaClient();
const uploads = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
const skeleton = process.argv.includes("--skeleton");

async function main() {
  const common = await seedCommon(prisma, uploads);
  switch (client.key) { // vocab-ok — l'aiguillage du seed est le seul endroit qui lit la clé (docs/produit.md)
    case "cress": await seedCress(prisma, common, uploads); break;
    case "tlst": await seedTlst(prisma, common, { skeleton }); break;
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```
`package.json` : `"seed:tlst": "NEXT_PUBLIC_CLIENT=tlst prisma db seed"`. Note : `prisma db seed` passe les arguments après `--` : `npm run seed -- -- --skeleton` ; documenter dans `README.md`.

- [ ] **Step 5 : Vérifier l'empreinte CRESS**

Run : la même commande qu'au Step 1 vers `/tmp/seed-cress-after.txt`, puis `diff /tmp/seed-cress-before.txt /tmp/seed-cress-after.txt`
Expected : aucune différence.

- [ ] **Step 6 : Écrire `prisma/seeds/tlst.ts`**

```ts
import { PrismaClient } from "@prisma/client";
import { dayjs } from "../../lib/format";
import { createPerson, type Common } from "./common";

// Instance TLST (lot I) : le squelette (une équipe, cinq personnes, missions, codes de temps) et, sauf --skeleton, une petite démo
// à vider avant la reprise des vraies données depuis erp-tlst. Tout est fictif.
export async function seedTlst(prisma: PrismaClient, c: Common, { skeleton }: { skeleton: boolean }) {
  const today = dayjs().startOf("day");
  const year = today.year();
  const d = (n: number) => today.add(n, "day").toDate();

  const equipe = await prisma.pole.create({ data: { name: "Équipe" } });
  const missions = await Promise.all(["Nourrir le territoire", "Faire lieu et faire lien", "Transmettre et réparer"].map((name, i) => prisma.mission.create({ data: { name, order: i } })));
  const timeCodes = await Promise.all([
    { code: "FONCT", label: "Fonctionnement (réunions, vie du lieu)", kind: "operating" },
    { code: "GEST", label: "Gestion administrative et financière", kind: "operating" },
    { code: "NT", label: "Non travaillé (congés, absences)", kind: "non_worked" },
  ].map((t, i) => prisma.timeCode.create({ data: { ...t, order: i } })));

  const defs = [
    { name: "Anne Lefort", role: "director", rhythm: "option_a", days: 200, jobTitle: "Coordinatrice" },
    { name: "Bruno Maillard", role: "raf", rhythm: "part_time", days: 160, jobTitle: "Trésorier" },
    { name: "Chloé Renaud", role: "pilot", rhythm: "option_a", days: 200, jobTitle: "Responsable jardin et cantine" },
    { name: "David Ott", role: "pilot", rhythm: "option_a", days: 200, jobTitle: "Responsable ateliers" },
    { name: "Emma Sicard", role: "assistant", rhythm: "part_time", days: 160, jobTitle: "Assistante" },
  ];
  const people = [];
  for (const [i, p] of defs.entries()) people.push(await createPerson(prisma, c, { ...p, poleId: equipe.id, order: i }));
  const [coord, treso, chloe, david, emma] = people;
  await prisma.pole.update({ where: { id: equipe.id }, data: { leadId: coord.id } });
  for (const p of people) await prisma.personTimeCode.createMany({ data: timeCodes.map((t) => ({ personId: p.id, timeCodeId: t.id })) });
  console.log(`Squelette TLST : ${people.length} personnes.`);
  if (skeleton) return;

  // ── Démo ──
  const region = await prisma.organisation.create({ data: { name: "Région Centre-Val de Loire", kinds: "funder,authority" } });
  const fondation = await prisma.organisation.create({ data: { name: "Fondation Terre Solidaire", kinds: "funder" } });
  const mairie = await prisma.organisation.create({ data: { name: "Ville de Loches", kinds: "authority,partner" } });

  const projets = [
    { name: "Jardin partagé", code: "JAR-01", pilot: chloe, mission: 0, envelope: 8000, steps: ["Semis de printemps", "Chantier participatif", "Fête des récoltes"] },
    { name: "Cantine solidaire", code: "CAN-01", pilot: chloe, mission: 0, envelope: 15000, steps: ["Ouverture de saison", "Repas de quartier", "Bilan de l'année"] },
    { name: "Ateliers réparation", code: "REP-01", pilot: david, mission: 2, envelope: 4000, steps: ["Atelier vélo", "Atelier électroménager", "Atelier couture"] },
  ];
  const editions = [];
  for (const [i, p] of projets.entries()) {
    const project = await prisma.project.create({ data: { name: p.name, analyticCode: p.code, poleId: equipe.id, pilotId: p.pilot.id, missionId: missions[p.mission].id } });
    const edition = await prisma.edition.create({ data: { projectId: project.id, year, status: "in_progress", budgetEnvelope: p.envelope, directExpenseEnvelope: p.envelope, stakes: `Ce que ${p.name.toLowerCase()} apporte au lieu et au territoire.`, calendar: "Toute l'année, temps forts au printemps et à l'automne." } });
    editions.push(edition);
    await prisma.editionTeam.create({ data: { editionId: edition.id, personId: p.pilot.id } });
    for (const [j, s] of p.steps.entries()) await prisma.action.create({ data: { editionId: edition.id, name: s, ownerId: p.pilot.id, milestoneDate: d(-60 + j * 60 + i * 7), state: j === 0 ? "done" : j === 1 ? "doing" : "todo", order: j, isPublic: j === 2 } });
    const line = await prisma.fundingLine.create({ data: { editionId: edition.id, funderId: i === 2 ? fondation.id : region.id, scheme: i === 2 ? "Appel à projets réemploi" : "Soutien aux tiers-lieux", status: "contracted", amountRequested: p.envelope * 0.6, amountGranted: p.envelope * 0.5, analyticCode: `${p.code}-FIN`, contractedAt: dayjs(`${year}-02-15`).toDate() } });
    await prisma.payment.create({ data: { fundingLineId: line.id, label: "Acompte", amount: p.envelope * 0.3, expectedAt: dayjs(`${year}-03-31`).toDate(), receivedAt: dayjs(`${year}-04-08`).toDate() } });
    await prisma.payment.create({ data: { fundingLineId: line.id, label: "Solde sur bilan", amount: p.envelope * 0.2, expectedAt: dayjs(`${year + 1}-01-31`).toDate() } });
  }

  await prisma.call.create({ data: { funderId: fondation.id, label: `Appel à projets alimentation durable ${year + 1}`, deadline: d(45), recurring: true, teamStatus: "study", link: "https://exemple.org/aap" } });

  const structures = ["AMAP du Val", "Coop'Loches", "Recyclerie Sud Touraine", "Épicerie Le Panier", "Ferme des Ormeaux", "Collectif Vélo"];
  const orgs = await Promise.all(structures.map((name) => prisma.organisation.create({ data: { name, kinds: "member" } })));
  const persons = [["Marie", "Girard"], ["Paul", "Roux"], ["Inès", "Bernard"], ["Léo", "Fabre"]];
  const contacts = await Promise.all(persons.map(([firstName, lastName], i) => prisma.contact.create({ data: { firstName, lastName, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@exemple.fr`, tags: i % 2 ? "bénévole" : "" } })));
  const mairieContact = await prisma.contact.create({ data: { organisationId: mairie.id, firstName: "Sophie", lastName: "Marin", email: "s.marin@exemple.fr", primary: true } });
  const regionContact = await prisma.contact.create({ data: { organisationId: region.id, firstName: "Karim", lastName: "Haddad", email: "k.haddad@exemple.fr", primary: true } });
  for (const [i, o] of orgs.entries()) await prisma.membership.create({ data: { organisationId: o.id, year, college: "Structures", amount: 50, status: i < 4 ? "paid" : "due", paidAt: i < 4 ? dayjs(`${year}-02-1${i}`).toDate() : null, method: i < 4 ? "transfer" : null, createdById: treso.id } });
  for (const [i, ct] of contacts.entries()) await prisma.membership.create({ data: { contactId: ct.id, year, college: "Personnes physiques", amount: 15, status: i < 3 ? "paid" : "due", paidAt: i < 3 ? dayjs(`${year}-03-0${i + 1}`).toDate() : null, method: i < 3 ? "helloasso" : null, createdById: treso.id } });
  const liste = await prisma.contactList.create({ data: { ownerId: emma.id, name: "Bénévoles du jardin", visibility: "all", color: "vert", editionId: editions[0].id, fields: JSON.stringify([{ key: "dispo", label: "Disponible le samedi", type: "bool" }]) } });
  for (const ct of contacts.slice(0, 3)) await prisma.contactListItem.create({ data: { listId: liste.id, contactId: ct.id, role: "Bénévole", values: JSON.stringify({ dispo: true }) } });
  void mairieContact; void regionContact;

  const ym = today.format("YYYY-MM");
  await prisma.settings.update({ where: { id: 1 }, data: { cashOpeningBalance: 22000, cashOpeningMonth: ym, cashAlertThreshold: 5000 } });
  for (const r of [
    { label: "Loyer du lieu", direction: "out", category: "Loyer", amount: 900, period: "monthly" },
    { label: "Salaires et charges", direction: "out", category: "Salaires et charges", amount: 7800, period: "monthly", kind: "hr" },
    { label: "Assurance", direction: "out", category: "Fonctionnement", amount: 1200, period: "annual" },
    { label: "Subvention de fonctionnement Ville", direction: "in", category: "Subventions", amount: 6000, period: "annual" },
  ]) await prisma.cashRule.create({ data: { startMonth: ym, ...r, createdById: treso.id } });

  const eq = (name: string, category: string, quantity: number, location: string) => prisma.equipment.create({ data: { name, category, quantity, location } });
  const [broyeur, , , barnum] = await Promise.all([eq("Broyeur de végétaux", "Jardin", 1, "Cabane du jardin"), eq("Motoculteur", "Jardin", 1, "Cabane du jardin"), eq("Sono portable", "Événementiel", 1, "Bureau"), eq("Barnum 3 × 3", "Événementiel", 2, "Grange"), eq("Vaisselle 50 couverts", "Cuisine", 1, "Cantine")]);
  await prisma.loan.create({ data: { equipmentId: barnum.id, quantity: 1, contactId: contacts[0].id, editionId: editions[0].id, outAt: d(-5), dueAt: d(3), createdById: emma.id } });
  void broyeur;
  console.log(`Démo TLST : ${projets.length} projets, ${orgs.length + contacts.length} adhérents.`);
}
```
Adapter les noms de champs si Prisma les refuse (`npx tsc --noEmit` sur le seed) en s'alignant sur `prisma/schema.prisma` — ne jamais changer le schéma pour le seed.

- [ ] **Step 7 : Vérifier le seed TLST**

Run : `NEXT_PUBLIC_CLIENT=tlst npm run seed && psql postgresql://pilote:pilote@localhost:5432/pilote_dev -Atc 'select (select count(*) from "Person"), (select count(*) from "Project"), (select count(*) from "Membership"), (select count(*) from "Loan"), (select "billingEmail" from "Settings")'`
Expected : `5|3|10|1|compta@tlst.example`.

Run : `NEXT_PUBLIC_CLIENT=tlst npm run seed -- -- --skeleton && psql … -Atc 'select (select count(*) from "Person"), (select count(*) from "Project")'`
Expected : `5|0`.

Puis remettre la base de dev en CRESS : `npm run seed`.

- [ ] **Step 8 : Suite Playwright**

Run : `npm test`
Expected : tout vert (le globalSetup lance `prisma db seed` sans `NEXT_PUBLIC_CLIENT` → `cress`).

- [ ] **Step 9 : Commit**

```bash
git add prisma package.json
git commit -m "Lot I — un seed par client : tronc commun, seed CRESS inchangé, seed TLST (squelette + petite démo, --skeleton)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10 : Recette Playwright de l'instance TLST

**Files:**
- Create: `tests/habillage.spec.ts`
- Modify: `playwright.config.ts` (projet `tlst`), `tests/global-setup.ts` (compte de connexion selon le client), `tests/helpers.ts` si un helper de connexion y vit

**Interfaces:**
- Consumes: seed TLST (Task 9), `client` (Task 1).

- [ ] **Step 1 : Le projet `tlst` dans `playwright.config.ts`**

Après les constantes existantes :
```ts
// Instance TLST (lot I) : même code, autre client, autre base et autre port. Seul tests/habillage.spec.ts y tourne.
const TLST_PORT = PORT + 1;
export const TLST_DATABASE_URL = process.env.TEST_DATABASE_URL_TLST ?? "postgresql://pilote:pilote@localhost:5432/pilote_test_tlst";
```
`projects` :
```ts
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /habillage\.spec\.ts/ },
  { name: "tlst", testMatch: /habillage\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${TLST_PORT}`, storageState: "tests/.auth/state-tlst.json" } },
],
```
Un serveur de plus dans `webServer` (copie du serveur principal avec `NEXT_PUBLIC_CLIENT: "tlst"`, `DATABASE_URL: TLST_DATABASE_URL`, `NEXT_DIST_DIR=.next-test-tlst`, port `TLST_PORT`, `url: http://localhost:${TLST_PORT}/matrice/export`, `UPLOAD_DIR: "./uploads-test-tlst"`, `BETTER_AUTH_URL: http://localhost:${TLST_PORT}/api/auth`, `HELLOASSO_ORG_SLUG: "tlst-demo"`). Le build TLST double le temps de démarrage (≈ 2 min de plus) : acceptable ; `PW_PROJECT=chromium npx playwright test --project chromium` reste possible pour ne pas le lancer (documenter dans le README).

- [ ] **Step 2 : `tests/global-setup.ts`** — après le seed CRESS et la session CRESS, faire de même pour TLST :
```ts
// Instance TLST : sa base, son seed, sa session (la coordinatrice du seed TLST).
execSync("npx prisma migrate deploy && npx prisma db seed", { stdio: "inherit", env: { ...env, DATABASE_URL: TLST_DATABASE_URL, NEXT_PUBLIC_CLIENT: "tlst", UPLOAD_DIR: "./uploads-test-tlst" } });
await signIn(`http://localhost:${TLST_PORT}`, "anne.lefort@exemple.fr", "tests/.auth/state-tlst.json");
```
en extrayant la connexion actuelle dans `async function signIn(baseURL, email, stateFile)`. Importer `TLST_DATABASE_URL` et calculer `TLST_PORT` depuis `PW_PORT` comme dans la config. Créer la base une fois : `createdb -U pilote pilote_test_tlst` (documenter dans `env.example`).

- [ ] **Step 3 : Écrire `tests/habillage.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

// Lot I : l'instance TLST s'habille à ses couleurs et parle sa langue — aucun mot CRESS dans ce qui s'affiche.
const PAGES = ["/portefeuille", "/projets", "/matrice", "/demandes", "/admin", "/organisations", "/contacts", "/tresorerie", "/adherents", "/materiel", "/notes", "/echeances", "/codir"];
const FORBIDDEN = [/CRESS/, /\b[Éé]ditions?\b/, /\b[Pp]ôles?\b/, /\bCODIR\b/, /\bRAF\b/];

test("titre, logo, favicon, thème, police", async ({ page }) => {
  await page.goto("/portefeuille");
  await expect(page).toHaveTitle(/Pilote · Tiers-Lieu Nourricier du Sud Touraine/);
  await expect(page.locator('aside img[alt="Tiers-Lieu Nourricier du Sud Touraine"]').first()).toBeVisible();
  const icon = await page.request.get("/icon");
  expect(icon.ok()).toBeTruthy();
  expect(icon.headers()["content-type"]).toContain("image/png");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim())).toBe("#3f6b4a");
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("h1")!).fontFamily)).toMatch(/Nunito/);
});

test("les mots de TLST", async ({ page }) => {
  await page.goto("/portefeuille");
  await expect(page.getByTestId("perimeter-cress")).toHaveText("Tout le TLST");
  await page.goto("/projets");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Projets/);
  await page.getByRole("link", { name: "Jardin partagé" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Jardin partagé/);
  await expect(page.getByText(/\bAction\b/).first()).toBeVisible();
  await page.getByRole("button", { name: "Lexique" }).click();
  await expect(page.getByRole("dialog")).toContainText("Action");
  await expect(page.getByRole("dialog")).toContainText("Étape");
  await expect(page.getByRole("dialog")).not.toContainText("dition");
});

for (const path of PAGES) {
  test(`aucun mot CRESS sur ${path}`, async ({ page }) => {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    for (const re of FORBIDDEN) expect(text, `${path} contient ${re}`).not.toMatch(re);
  });
}

test("check:vocab est vert", () => {
  execSync("node scripts/check-vocab.mjs", { stdio: "inherit" });
});
```
Le bouton « Lexique » : vérifier son libellé réel dans `components/common/lexique-dialog.tsx` (le déclencheur) et adapter le sélecteur.

- [ ] **Step 4 : Lancer**

Run : `npx playwright test --project tlst`
Expected : tout vert. Une trouvaille « aucun mot CRESS sur … » = un texte oublié : corriger dans le code (Task 7/8 règles), pas dans le test.

Run : `npm test`
Expected : les deux projets verts.

- [ ] **Step 5 : Commit**

```bash
git add tests playwright.config.ts env.example
git commit -m "Lot I — recette de l'instance TLST : titre, logo, favicon, thème, police, mots, aucun mot CRESS sur treize écrans

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11 : Déploiement par instance

**Files:**
- Create: `deploy/instances/cress.env`, `deploy/instances/tlst.env`, `deploy/systemd/pilote@.service`, `deploy/nginx/tlst.bazixx.fr.conf`
- Modify: `deploy/deploy.sh`, `deploy/README.md`, `deploy/systemd/cress-pilote.service` (note de transition), `deploy/nginx/cress.bazixx.fr.conf` (commentaire), `env.example`

**Interfaces:**
- Produces: `./deploy/deploy.sh <instance> [--seed]`.

- [ ] **Step 1 : Fichiers d'instance**

`deploy/instances/cress.env` :
```bash
# Instance CRESS sur bazixx-vps (convention outilcli). Lu par deploy/deploy.sh ; pas de secret ici.
CLIENT=cress
HOST=bazixx-vps
DIR=/var/www/cress-pilote
DATA=/var/www/cress-pilote-data
MEDIAS=/var/www/cress-pilote-medias
BACKUP_DIR=/var/backups/cress
DBNAME=cress_pilote
DBUSER=cress_pilote
PORT=3002
BASE_PATH=/outilcli/cress/pilote
PUBLIC_URL=https://cress.bazixx.fr/outilcli/cress/pilote
SERVICE=pilote@cress
MAINTENANCE_FLAG=/var/www/maintenance/ACTIF-cress
```
`deploy/instances/tlst.env` : `CLIENT=tlst`, `DIR=/var/www/tlst-pilote`, `DATA=/var/www/tlst-pilote-data`, `MEDIAS=/var/www/tlst-pilote-medias`, `BACKUP_DIR=/var/backups/tlst`, `DBNAME=tlst_pilote`, `DBUSER=tlst_pilote`, `PORT=3003`, `BASE_PATH=/outilcli/tlst/pilote`, `PUBLIC_URL=https://tlst.bazixx.fr/outilcli/tlst/pilote`, `SERVICE=pilote@tlst`, `MAINTENANCE_FLAG=/var/www/maintenance/ACTIF-tlst`.

- [ ] **Step 2 : `deploy/deploy.sh`**

Remplacer l'en-tête des variables (lignes 16-26) par :
```bash
INSTANCE="${1:-}"
[ -n "$INSTANCE" ] && [ -f "$(dirname "$0")/instances/$INSTANCE.env" ] || { echo "usage : $0 <instance> [--seed]  (instances : $(ls "$(dirname "$0")/instances" | sed 's/\.env$//' | tr '\n' ' '))" >&2; exit 2; }
# shellcheck disable=SC1090
source "$(dirname "$0")/instances/$INSTANCE.env"
SEED="${2:-none}"
HEALTH="http://127.0.0.1:$PORT$BASE_PATH/connexion"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL="$(cd "$(dirname "$0")/.." && pwd)"
echo "═══ Pilote [$INSTANCE] → $HOST ($STAMP) ═══"
```
Passer au bloc `ssh … bash -s --` les variables : `"$DIR" "$DATA" "$MEDIAS" "$HEALTH" "$STAMP" "$SEED" "$DBNAME" "$DBUSER" "$CLIENT" "$BASE_PATH" "$PUBLIC_URL" "$SERVICE" "$MAINTENANCE_FLAG" "$BACKUP_DIR" "$PORT"` et les relire côté serveur (`CLIENT="$9"; BASE_PATH="${10}"; …`). Dans le corps distant :
- `mkdir -p "$DATA" "$MEDIAS" "$BACKUP_DIR"` ;
- `.env` créé : `NEXT_PUBLIC_BASE_PATH="$BASE_PATH"` et `NEXT_PUBLIC_CLIENT="$CLIENT"` ; et sur un `.env` existant : `grep -q '^NEXT_PUBLIC_CLIENT=' "$DIR/.env" || echo "NEXT_PUBLIC_CLIENT=\"$CLIENT\"" >> "$DIR/.env"` ;
- `BETTER_AUTH_URL` = `"$PUBLIC_URL/api/auth"` ;
- sauvegarde dans `"$BACKUP_DIR/$DBNAME-$STAMP.dump"` ;
- `touch "$MAINTENANCE_FLAG"`, `rm -f "$MAINTENANCE_FLAG"` ;
- `systemctl stop|start "$SERVICE"` ; si `$SERVICE` n'existe pas encore (`systemctl cat "$SERVICE" >/dev/null 2>&1 || …`), copier `deploy/systemd/pilote@.service` vers `/etc/systemd/system/` (il est dans `$NEW/deploy/systemd/`), `systemctl daemon-reload`, `systemctl enable "$SERVICE"` ; l'ancien `cress-pilote` est arrêté et désactivé la première fois que `pilote@cress` démarre (`systemctl disable --now cress-pilote 2>/dev/null || true`) ;
- message final `echo "✔ en ligne : $PUBLIC_URL"`.
Le seed prend `NEXT_PUBLIC_CLIENT` du `.env` (copié dans `$NEW/.env` avant `npx prisma db seed`, déjà le cas).

- [ ] **Step 3 : `deploy/systemd/pilote@.service`**

```ini
[Unit]
Description=Pilote — instance %i (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/%i-pilote
EnvironmentFile=/var/www/%i-pilote/.env
Environment=NODE_ENV=production
Environment=HOME=/var/www/%i-pilote-data
Environment=HOSTNAME=127.0.0.1
# Le port vient du .env de l'instance (PORT=…), posé par deploy.sh.
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
StandardOutput=append:/var/log/%i-pilote.log
StandardError=append:/var/log/%i-pilote.log

[Install]
WantedBy=multi-user.target
```
Pour que `PORT` vienne du `.env` : `deploy.sh` ajoute `grep -q '^PORT=' "$DIR/.env" || echo "PORT=$PORT" >> "$DIR/.env"`. Dans `cress-pilote.service`, ajouter en tête : `# Remplacé par pilote@.service (lot I) ; retiré du serveur au premier déploiement réussi sous pilote@cress.`

- [ ] **Step 4 : `deploy/nginx/tlst.bazixx.fr.conf`** — copie de `cress.bazixx.fr.conf` avec `tlst.bazixx.fr`, `/outilcli/tlst/pilote`, `127.0.0.1:3003`, `ACTIF-tlst`, `.htpasswd-tlst`, logs `tlst.*.log`, `auth_basic "Pilote · TLST"`. En tête : « DNS `tlst.bazixx.fr` → bazixx-vps et `certbot --nginx -d tlst.bazixx.fr` à faire à la main (étape instance TLST, hors lot I). »

- [ ] **Step 5 : `deploy/README.md` et `env.example`** — usage `./deploy/deploy.sh cress|tlst [--seed]`, la transition `cress-pilote` → `pilote@cress`, la création de `pilote_test_tlst`, `NEXT_PUBLIC_CLIENT` (ligne dans `env.example` : `# Client de l'instance (lot I) : cress (défaut) | tlst — NEXT_PUBLIC_CLIENT="cress"`), `npm run seed:tlst`, `--skeleton`.

- [ ] **Step 6 : Vérifier sans déployer**

Run : `bash -n deploy/deploy.sh && ./deploy/deploy.sh 2>&1 | head -2 ; ./deploy/deploy.sh acme 2>&1 | head -1`
Expected : syntaxe OK ; les deux appels s'arrêtent sur le message d'usage (code 2) sans toucher au serveur.

Run : `shellcheck deploy/deploy.sh` si disponible (`brew list shellcheck`) ; sinon passer.

- [ ] **Step 7 : Commit**

```bash
git add deploy env.example
git commit -m "Lot I — déploiement par instance : deploy.sh <instance>, fichiers d'instance, unité systemd pilote@, conf nginx TLST prête

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8 : Déployer la CRESS (avec l'accord de Gaël dans la conversation)**

Run : `./deploy/deploy.sh cress`
Expected : « ✔ en ligne : https://cress.bazixx.fr/outilcli/cress/pilote » ; `systemctl status pilote@cress` actif sur le serveur ; l'instance en ligne ne change rien d'apparent (titre, logo, couleurs, mots). Vérifier dans le navigateur (rideau `auth_basic`, mot de passe dans `CRESS/pilote-acces-demo.txt`).

---

### Task 12 : Documentation et clôture du lot

**Files:**
- Modify: `docs/LOTS-TLST.md` (lot I : FAIT, ce qui reste), `docs/produit.md` (« Déjà en place »), `docs/RETOURS-A-CHAUD.md` (nouveau §), `docs/charte.md` (logos dans `public/clients/`), `README.md` (variables, seeds, instances, `check:vocab`, `test:unit`)

- [ ] **Step 1 : `docs/LOTS-TLST.md`** — ligne « Multi-instance (lot I) » → **FAIT (date)** avec le résumé : fichier client, vocabulaire d'un coup (N fichiers), seeds, `deploy.sh <instance>`, recette `tlst` ; ajouter dans « Reste consigné » : « Instance TLST en ligne (DNS, certificat, `deploy.sh tlst --seed`) puis reprise des données depuis mca-vps » et « Vrai logo TLST à déposer dans `public/clients/tlst/` puis `python3 scripts/make-brand-images.py` » ; la ligne « Écran admin › Apparence » reste en feuille de route.

- [ ] **Step 2 : `docs/produit.md`** — section « Déjà en place » : « **Habillage par client** (lot I, date) : `config/clients/<client>.ts` (nom, logos, thème complet, polices, vocabulaire), `NEXT_PUBLIC_CLIENT` au build, `lib/vocab.ts` + `scripts/check-vocab.mjs`, `lib/branding.ts` = point d'entrée unique (l'écran Apparence viendra s'y brancher), seeds par client, `deploy.sh <instance>`. » Retirer de « Ce qui sera fait quand le produit sera lancé » ce qui est fait (`config/clients/`, `deploy.sh` paramétré) ; y laisser « portage des données TLST », « archivage d'erp-tlst », Entra ID.

- [ ] **Step 3 : `docs/RETOURS-A-CHAUD.md`** — nouveau paragraphe « §AR — Lot I multi-instance (date) » : ce qui a été fait, la table des mots TLST à corriger par Gaël, les placeholders de logo, la palette TLST à valider.

- [ ] **Step 4 : `README.md`** — `NEXT_PUBLIC_CLIENT`, `npm run test:unit`, `npm run check:vocab`, `npm run seed:tlst`, `--skeleton`, `./deploy/deploy.sh <instance>`, projets Playwright `chromium` / `tlst`.

- [ ] **Step 5 : Vérification finale**

Run : `npm run lint && npx tsc --noEmit && npm run test:unit && npm run check:vocab && npm test && git status --short`
Expected : tout vert, arbre propre après commit.

- [ ] **Step 6 : Commit**

```bash
git add docs README.md
git commit -m "Docs : lot I multi-instance fait — fichier client, vocabulaire, seeds, déploiement par instance ; instance TLST et écran Apparence en feuille de route

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
