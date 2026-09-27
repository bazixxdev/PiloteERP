# Page de connexion aux couleurs du logo — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une page de connexion en deux colonnes dont le panneau de gauche, animé, prend automatiquement les couleurs du logo de l'organisation ; un grand et un petit logo téléversés par un admin dans Admin › Paramètres, utilisés par la connexion, la barre latérale, le bandeau et le favicon.

**Architecture:** la palette est calculée une seule fois, côté serveur, au téléversement du grand logo (`lib/brand-palette.ts`, fonctions pures reprises de la maquette ; pixels lus par `sharp`) et rangée en base avec l'image convertie en PNG (`BrandAsset`). À l'affichage, le serveur pose 7 variables CSS filtrées sur la page ; le panneau n'est que du CSS. Sans logo téléversé, tout retombe sur les images du fichier client, dont la palette est calculée une fois par démarrage.

**Tech Stack:** Next.js 15 App Router (server components, server actions, route handlers), Prisma 6 / PostgreSQL 16, `sharp` 0.35.4, Better Auth (`signIn.email`, `rememberMe`), Tailwind/shadcn, `node:test` via tsx, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-connexion-logo-design.md` ; source technique `CRESS/refonte login/NOTICE-panneau-couleurs-logo.md`, maquette `CRESS/refonte login/connexion.html`, module `CRESS/refonte login/brand-palette.js`, tests `CRESS/refonte login/brand-palette.test.mjs` (dossier hors dépôt, à lire tel quel).

## Global Constraints

- **Pas de nouveau style** pour les champs, la typographie, les boutons : on garde `Input`, `Label`, `Button` et les polices du projet ; seuls la structure (deux colonnes, panneau) et les couleurs dérivées du logo changent (spec § 1).
- Couleurs de la connexion : texte du panneau, bouton « Se connecter » et liens = `--brand-ink` ; anneau de focus = `--brand-accent` ; `--brand-accent` **jamais pour du texte**.
- Palette par défaut en dur dans le CSS (valeurs exactes du § 4 de la notice) ; variables injectées côté serveur par `brandStyle`, qui ne garde que les 7 clés `--brand-*` connues et les valeurs `#rrggbb`.
- Animations en `transform` seulement, coupées par `prefers-reduced-motion: reduce`.
- Images téléversées : PNG, JPEG, WebP, SVG ; 2 Mo au plus ; converties en PNG et réduites (grand logo 640 px de côté au plus, petit logo 256 px) ; un fichier illisible est refusé avec un message.
- Toute commande serveur : `getCurrentPerson()`, garde `canAdmin` **avant** toute lecture du formulaire ou de la base ; pas de passage par `saveField`.
- `data-testid` de connexion conservés : `login-form`, `login-email`, `login-password`, `login-error`, `login-submit`.
- Accroche : pastille = nom long de l'organisation ; titre = `` `Piloter vos ${pl(V.projet)} d'économie sociale et solidaire, de l'idée au bilan.` `` ; aucun mot client en dur (`npm run check:vocab`).
- Migration « expand » seulement (nouvelle table, rien de supprimé).
- `npm run check` vert avant chaque commit ; commits en français terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; nouvelle dépendance justifiée dans le message du commit.
- Recette : préfixe de consentement donné par Gaël pour ce plan ; recette puis sécurité l'une après l'autre ; `PW_PORT=3140` si 3100 est pris.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `lib/brand-palette.ts` (nouveau) | algorithme pur (repris de la maquette), `DEFAULT_PALETTE`, `brandStyle`, types |
| `lib/brand-images.ts` (nouveau) | `sharp` : lire, convertir en PNG, réduire, calculer la palette (serveur seulement) |
| `lib/branding-db.ts` (nouveau) | `getLogos()`, `getLoginPalette()` : téléversé sinon fichier client |
| `prisma/schema.prisma`, `prisma/migrations/20260928090000_brand_assets/` | table `BrandAsset` |
| `app/marque/[kind]/route.ts` (nouveau), `middleware.ts` | service public des images |
| `app/icon.tsx`, `components/shell/logo.tsx`, `components/shell/sidebar.tsx`, `components/shell/topbar.tsx`, `app/layout.tsx` | logos résolus partout |
| `app/actions/brand.ts` (nouveau), `app/admin/brand-logos.tsx` (nouveau), `app/admin/page.tsx` | téléversement dans Paramètres |
| `components/auth/auth-shell.tsx`, `components/auth/brand-aura.css` (nouveau), `app/connexion/page.tsx`, `app/connexion/login-form.tsx` | la page |
| `tests/unit/brand-palette.test.ts`, `tests/unit/brand-images.test.ts`, `tests/security/sec-40-brand-logos.spec.ts`, `tests/connexion.spec.ts` (nouveaux) | tests |

---

### Task 1: L'algorithme de palette

**Files:**
- Create: `lib/brand-palette.ts`, `tests/unit/brand-palette.test.ts`

**Interfaces:**
- Produces:
  - `type BrandVars = Record<"--brand-base" | "--brand-glow-1" | "--brand-glow-2" | "--brand-glow-3" | "--brand-glow-4" | "--brand-ink" | "--brand-accent", string>`
  - `type BrandPalette = { version: number; source: string[]; logoOnWhite: boolean; vars: BrandVars }`
  - `PALETTE_VERSION`, `PALETTE_OPTIONS`, `rgbToOklch`, `oklchToHex`, `extractColors`, `buildVars`, `paletteFromPixels(data: ArrayLike<number>, width: number, height: number, options?): BrandPalette`, `DEFAULT_PALETTE: BrandPalette`
  - `BRAND_KEYS: readonly (keyof BrandVars)[]`, `brandStyle(palette: BrandPalette | null | undefined): Record<string, string>`

- [ ] **Step 1: Écrire les tests qui échouent** — `tests/unit/brand-palette.test.ts` = la copie exacte de `CRESS/refonte login/brand-palette.test.mjs` (annexe C de la notice : 11 tests, vecteur de référence TLST compris), avec deux changements seulement : l'import devient `from "../../lib/brand-palette"` et le fichier est en TypeScript (typer `image`, `hex`, `contrast` : `(w: number, h: number, fill: (x: number, y: number) => number[])`…). Ajouter à la fin :

```ts
import { brandStyle } from "../../lib/brand-palette";

test("brandStyle ne garde que les clés connues et les couleurs #rrggbb", () => {
  const style = brandStyle({
    version: 1, source: [], logoOnWhite: false,
    vars: { "--brand-base": "#fef2e1", "--brand-glow-1": "red; background:url(x)", "--brand-glow-2": "#60a56a", "--brand-glow-3": "#C1E2C4", "--brand-glow-4": "#fdd3c4", "--brand-ink": "#004214", "--brand-accent": "#f1a70d", "--evil": "#000000" } as never,
  });
  assert.deepEqual(style, { "--brand-base": "#fef2e1", "--brand-glow-2": "#60a56a", "--brand-glow-3": "#C1E2C4", "--brand-glow-4": "#fdd3c4", "--brand-ink": "#004214", "--brand-accent": "#f1a70d" });
  assert.deepEqual(brandStyle(null), {});
});
```

- [ ] **Step 2: Lancer** `npx tsx --test tests/unit/brand-palette.test.ts` — attendu : échec, module introuvable.

- [ ] **Step 3: Écrire** `lib/brand-palette.ts` = la copie exacte de `CRESS/refonte login/brand-palette.js` (annexe A) portée en TypeScript : mêmes constantes, mêmes calculs, même ordre, **aucune valeur changée** ; types ajoutés (`BrandVars`, `BrandPalette`, paramètres) ; les aides navigateur `paletteFromImage` et `applyPalette` **ne sont pas reprises** (calcul côté serveur, spec § 3). En tête de fichier : « Palette du panneau de connexion tirée du logo (spec connexion du 27/09). Repris sans changement de `brand-palette.js` v1 de la maquette : toute modification de l'algorithme ou de PALETTE_OPTIONS incrémente PALETTE_VERSION et relance les tests. » Puis ajouter :

```ts
export const BRAND_KEYS = ["--brand-base", "--brand-glow-1", "--brand-glow-2", "--brand-glow-3", "--brand-glow-4", "--brand-ink", "--brand-accent"] as const;

// Variables à poser dans l'attribut style de la page : seules les 7 clés connues, seulement des #rrggbb — une donnée modifiée
// en base ne peut pas injecter de CSS (notice § 5.4).
export function brandStyle(palette: BrandPalette | null | undefined): Record<string, string> {
  const vars = (palette?.vars ?? {}) as Record<string, string>;
  return Object.fromEntries(BRAND_KEYS.filter((k) => /^#[0-9a-f]{6}$/i.test(vars[k] ?? "")).map((k) => [k, vars[k]]));
}
```

- [ ] **Step 4: Vérifier** `npx tsx --test tests/unit/brand-palette.test.ts` : 12 tests verts, dont le vecteur de référence (`#fef2e1`, `#f9ad0d`, `#60a56a`, `#c1e2c4`, `#fdd3c4`, `#004214`, `#f1a70d`). Puis `npm run check`.

- [ ] **Step 5: Commit** — « Connexion : la palette tirée du logo, algorithme de la maquette repris tel quel avec ses tests ».

---

### Task 2: Stockage, lecture des images, logos résolus

**Files:**
- Modify: `package.json` (dépendance `sharp`), `prisma/schema.prisma`
- Create: `prisma/migrations/20260928090000_brand_assets/migration.sql`, `lib/brand-images.ts`, `lib/branding-db.ts`, `tests/unit/brand-images.test.ts`

**Interfaces:**
- Consumes: `paletteFromPixels`, `DEFAULT_PALETTE`, `BrandPalette` (tâche 1) ; `branding()` (`lib/branding.ts`).
- Produces:
  - Prisma `BrandAsset { key String @id; png Bytes; width Int; height Int; palette Json?; updatedAt DateTime @updatedAt }`, clés `"logo"` et `"logo_small"`.
  - `type BrandKind = "logo" | "logo_small"` ; `BRAND_MAX_BYTES = 2 * 1024 * 1024` ; `BRAND_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]`.
  - `class BrandImageError extends Error` ; `processLogo(input: Buffer, kind: BrandKind): Promise<{ png: Buffer; width: number; height: number; palette: BrandPalette | null }>` (palette seulement pour `logo`).
  - `getLogos(): Promise<{ color: Img; mark: Img; favicon: { src: string; uploaded: boolean } }>` et `getLoginPalette(): Promise<BrandPalette>` (`lib/branding-db.ts`), `brandUrl(kind: BrandKind, updatedAt: Date): string` = `` `/marque/${kind === "logo" ? "logo" : "logo-petit"}?v=${updatedAt.getTime()}` ``.

- [ ] **Step 1: Dépendance** — `npm install --save-exact sharp@0.35.4` (même version que celle déjà verrouillée comme dépendance optionnelle de Next : vérifier que `package-lock.json` ne change que l'entrée racine). Le message de commit de cette tâche dira : « sharp (déjà installé par Next 15, même version) passe en dépendance directe : il lit les pixels du logo et le convertit en PNG côté serveur ; le calcul dans le navigateur (variante de la notice § 5.5) ferait clignoter les couleurs et refaire le calcul à chaque visite. »

- [ ] **Step 2: Schéma** — ajouter à `prisma/schema.prisma` :

```prisma
// Logos téléversés par un admin (spec connexion du 27/09) : « logo » (grand : connexion, barre latérale dépliée) et
// « logo_small » (petit : barre repliée, bandeau mobile, favicon). Toujours stockés convertis en PNG ; la palette du panneau
// de connexion n'existe que pour le grand logo. En base plutôt que dans public/ : survit aux déploiements, part dans pg_dump.
model BrandAsset {
  key       String   @id
  png       Bytes
  width     Int
  height    Int
  palette   Json?
  updatedAt DateTime @updatedAt
}
```

puis `npx prisma migrate dev --name brand_assets --create-only`, renommer le dossier en `20260928090000_brand_assets`, relire le SQL (un seul `CREATE TABLE "BrandAsset"`), `npx prisma generate`.

- [ ] **Step 3: Écrire les tests qui échouent** `tests/unit/brand-images.test.ts` :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processLogo, BrandImageError } from "../../lib/brand-images";

const png = (w: number, h: number, rgba: [number, number, number, number]) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: rgba[0], g: rgba[1], b: rgba[2], alpha: rgba[3] / 255 } } }).png().toBuffer();

test("un PNG rouge donne une palette dont la source est ce rouge, et ressort en PNG", async () => {
  const out = await processLogo(await png(200, 100, [224, 32, 32, 255]), "logo");
  assert.deepEqual(out.palette?.source, ["#e02020"]);
  const meta = await sharp(out.png).metadata();
  assert.equal(meta.format, "png");
  assert.equal(out.width, 200);
});

test("un grand logo est réduit à 640 px de côté, un petit à 256 px ; le petit n'a pas de palette", async () => {
  const big = await processLogo(await png(2000, 1000, [32, 64, 224, 255]), "logo");
  assert.equal(big.width, 640);
  assert.equal(big.height, 320);
  const small = await processLogo(await png(1000, 1000, [32, 64, 224, 255]), "logo_small");
  assert.equal(small.width, 256);
  assert.equal(small.palette, null);
});

test("un SVG est rastérisé : même palette que le PNG de même couleur", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#e02020"/></svg>');
  const out = await processLogo(svg, "logo");
  assert.deepEqual(out.palette?.source, ["#e02020"]);
  assert.equal((await sharp(out.png).metadata()).format, "png");
});

test("un JPG sur fond blanc : fond ignoré, logoOnWhite vrai", async () => {
  const jpg = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#ffffff" } })
    .composite([{ input: await png(40, 40, [224, 32, 32, 255]), left: 30, top: 30 }]).jpeg({ quality: 100 }).toBuffer();
  const out = await processLogo(jpg, "logo");
  assert.equal(out.palette?.logoOnWhite, true);
  assert.equal(out.palette?.source.length, 1);
});

test("des octets illisibles sont refusés par une BrandImageError", async () => {
  await assert.rejects(processLogo(Buffer.from("pas une image"), "logo"), BrandImageError);
});
```

- [ ] **Step 4: Lancer** `npx tsx --test tests/unit/brand-images.test.ts` — attendu : échec, module introuvable.

- [ ] **Step 5: Écrire** `lib/brand-images.ts` :

```ts
import sharp from "sharp";
import { paletteFromPixels, PALETTE_OPTIONS, type BrandPalette } from "./brand-palette";

export type BrandKind = "logo" | "logo_small";
export const BRAND_MAX_BYTES = 2 * 1024 * 1024;
export const BRAND_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_SIDE: Record<BrandKind, number> = { logo: 640, logo_small: 256 };

export class BrandImageError extends Error {}

// Un logo téléversé (spec connexion § 3) : lu par sharp (un SVG est rastérisé, donc aucun script SVG n'est jamais servi),
// réduit, converti en PNG ; pour le grand logo, la palette du panneau est calculée sur un échantillon de 160 px sans lissage
// (plus proche voisin : pas de couleur fabriquée aux bords, notice § 3.1). Illisible : BrandImageError, l'appelant refuse.
export async function processLogo(input: Buffer, kind: BrandKind): Promise<{ png: Buffer; width: number; height: number; palette: BrandPalette | null }> {
  try {
    const side = MAX_SIDE[kind];
    const { data: png, info } = await sharp(input, { density: 144 })
      .resize(side, side, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    if (kind === "logo_small") return { png, width: info.width, height: info.height, palette: null };
    const n = PALETTE_OPTIONS.sampleSize;
    const sample = await sharp(input, { density: 144 })
      .ensureAlpha()
      .resize(n, n, { fit: "inside", kernel: "nearest", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { png, width: info.width, height: info.height, palette: paletteFromPixels(sample.data, sample.info.width, sample.info.height) };
  } catch {
    throw new BrandImageError("Image illisible : envoyez un PNG, un JPEG, un WebP ou un SVG.");
  }
}
```

Pas d'`import "server-only"` : le paquet n'est pas installé et ce serait une dépendance de plus ; le module n'est importé que par du code serveur (`lib/branding-db.ts`, `app/actions/brand.ts`, `app/icon.tsx`).

- [ ] **Step 6: Écrire** `lib/branding-db.ts` :

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { branding } from "./branding";
import { DEFAULT_PALETTE, type BrandPalette } from "./brand-palette";
import { processLogo, type BrandKind } from "./brand-images";
import type { Img } from "@/config/clients/types";

export function brandUrl(kind: BrandKind, updatedAt: Date): string {
  return `/marque/${kind === "logo" ? "logo" : "logo-petit"}?v=${updatedAt.getTime()}`;
}

// Les logos affichés (spec connexion § 3) : ceux téléversés par un admin, sinon ceux du fichier client. Le logo « blanc »
// (fond sombre) reste celui du fichier client.
export async function getLogos(): Promise<{ color: Img; mark: Img; favicon: { src: string; uploaded: boolean } }> {
  const b = branding();
  const rows = await prisma.brandAsset.findMany({ select: { key: true, width: true, height: true, updatedAt: true } });
  const big = rows.find((r) => r.key === "logo");
  const small = rows.find((r) => r.key === "logo_small");
  return {
    color: big ? { src: brandUrl("logo", big.updatedAt), width: big.width, height: big.height } : b.logos.color,
    mark: small ? { src: brandUrl("logo_small", small.updatedAt), width: small.width, height: small.height } : b.logos.mark,
    favicon: small ? { src: brandUrl("logo_small", small.updatedAt), uploaded: true } : { src: b.logos.favicon, uploaded: false },
  };
}

// Palette du panneau de connexion : celle du grand logo téléversé ; sinon calculée une fois par démarrage depuis le grand logo
// du fichier client (la connexion est colorée dès le déploiement) ; sinon la palette neutre.
let configPalette: Promise<BrandPalette> | null = null;
export async function getLoginPalette(): Promise<BrandPalette> {
  const row = await prisma.brandAsset.findUnique({ where: { key: "logo" }, select: { palette: true } });
  if (row?.palette) return row.palette as unknown as BrandPalette;
  configPalette ??= readFile(path.join(process.cwd(), "public", branding().logos.color.src))
    .then((buf) => processLogo(buf, "logo"))
    .then((r) => r.palette ?? DEFAULT_PALETTE)
    .catch(() => DEFAULT_PALETTE);
  return configPalette;
}
```

(`prisma` vient de `lib/db.ts`, comme dans `app/actions/attachments.ts`.)

- [ ] **Step 7: Vérifier** `npx tsx --test tests/unit/brand-images.test.ts` (5 verts), `npm run check`. Contrôle à la main, noté dans le rapport : `processLogo` sur `public/clients/tlst/logo.png` donne une source jaune + vert et `--brand-ink` vert foncé ; sur `public/clients/cress/logo.png`, noter la palette obtenue.

- [ ] **Step 8: Commit** — « Connexion : logos téléversés rangés en base, convertis en PNG, palette calculée à l'envoi » (avec la justification de `sharp`).

---

### Task 3: Servir les logos, les afficher partout, le favicon

**Files:**
- Create: `app/marque/[kind]/route.ts`, `tests/security/sec-40-brand-logos.spec.ts` (première partie)
- Modify: `middleware.ts:8`, `app/icon.tsx`, `components/shell/logo.tsx`, `components/shell/sidebar.tsx:145-149`, `components/shell/topbar.tsx:33`, `app/layout.tsx` (données transmises au shell)

**Interfaces:**
- Consumes: `getLogos`, `BrandKind` (tâche 2).
- Produces: `GET /marque/logo`, `GET /marque/logo-petit` (publics) ; `Logo({ img, alt, className, decorative })` où `img: Img` est fourni par l'appelant (plus de lecture de `branding()` pour les variantes couleur et marque) ; `ShellLogos = { color: Img; mark: Img }` passé au shell.

- [ ] **Step 1: Test de sécurité qui échoue** `tests/security/sec-40-brand-logos.spec.ts` (première partie ; suivre le style des autres SEC : `SECURITY_ACTORS`, `expectAnonymous`, client Prisma sur la base de sécurité, remise en état en `afterAll`) :

```ts
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { expectAnonymous } from "./fixtures";

const prisma = new PrismaClient();
test.afterAll(async () => { await prisma.brandAsset.deleteMany({}); await prisma.$disconnect(); });

test.describe("SEC-40 — logos de l'organisation", () => {
  test("sans logo téléversé : /marque/logo répond 404 ; une clé inconnue aussi", async ({ page }) => {
    await prisma.brandAsset.deleteMany({});
    expect((await expectAnonymous(page, "/marque/logo")).status()).toBe(404);
    expect((await expectAnonymous(page, "/marque/autre")).status()).toBe(404);
  });

  test("un logo téléversé est servi sans session, en PNG, sans reniflage du type", async ({ page }) => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 4, background: "#e02020" } }).png().toBuffer();
    await prisma.brandAsset.upsert({ where: { key: "logo" }, create: { key: "logo", png, width: 10, height: 10 }, update: { png } });
    const r = await expectAnonymous(page, "/marque/logo");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
    expect(r.headers()["x-content-type-options"]).toBe("nosniff");
    expect((await r.body()).subarray(0, 8)).toEqual(png.subarray(0, 8));
  });
});
```

- [ ] **Step 2: Route** `app/marque/[kind]/route.ts` :

```ts
import { prisma } from "@/lib/db";

const KEYS: Record<string, "logo" | "logo_small"> = { logo: "logo", "logo-petit": "logo_small" };

// Logos téléversés (spec connexion § 3) : publics (la page de connexion les affiche), toujours en PNG (convertis à l'envoi),
// cache long — l'adresse change avec ?v=<date de mise à jour> à chaque remplacement.
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const key = KEYS[(await params).kind];
  if (!key) return new Response("Introuvable", { status: 404 });
  const row = await prisma.brandAsset.findUnique({ where: { key }, select: { png: true } });
  if (!row) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(row.png), {
    headers: { "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
```

Dans `middleware.ts:8`, ajouter `"/marque"` à `PUBLIC`.

- [ ] **Step 3: Favicon** `app/icon.tsx` : retirer `export const dynamic = "force-static"` ; si `getLogos().favicon.uploaded`, lire la ligne `logo_small`, la réduire à 64 px avec `sharp` (`resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png()`) et la renvoyer ; sinon le comportement actuel (fichier du client). Ajouter `export const revalidate = 0`.

- [ ] **Step 4: Logo** `components/shell/logo.tsx` :

```tsx
import { withBase } from "@/lib/base-path";
import { branding } from "@/lib/branding";
import type { Img } from "@/config/clients/types";
import { cn } from "@/lib/utils";

// Le logo de l'organisation : l'image est choisie par le serveur (téléversée par un admin, sinon celle du fichier client —
// lib/branding-db.ts, getLogos) et transmise ici ; `white` (fond sombre) reste celle du fichier client.
export function Logo({ img, variant, className, decorative = false }: { img?: Img; variant?: "white"; className?: string; decorative?: boolean }) {
  const b = branding();
  const src = img ?? b.logos.white;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={withBase(src.src)} alt={decorative ? "" : b.longName} width={src.width} height={src.height} className={cn("h-auto", className)} />;
}
```

Remplacer chaque usage : `grep -rn "<Logo" app components` — barre latérale : `<Logo img={logos.color} …/>` et `<Logo img={logos.mark} decorative …/>` ; bandeau : `<Logo img={logos.mark} …/>` ; un usage `variant="white"` éventuel garde `variant="white"`. `logos: ShellLogos` arrive par les props depuis `app/layout.tsx`, qui appelle `getLogos()` une fois (dans la même fonction que l'arbre de navigation) et le transmet à `Sidebar` et `Topbar` comme `tree`.

- [ ] **Step 5: Vérifier** `npm run check`, `npm run test:security` ciblé sur SEC-40, et une recette rapide (`tests/rail.spec.ts`, `tests/habillage.spec.ts`) : le logo du fichier client s'affiche toujours quand rien n'est téléversé.

- [ ] **Step 6: Commit** — « Logos : servis publiquement en PNG, affichés dans la barre, le bandeau et le favicon ; le fichier client reste le repli ».

---

### Task 4: Téléverser les logos dans Admin › Paramètres

**Files:**
- Create: `app/actions/brand.ts`, `app/admin/brand-logos.tsx`
- Modify: `app/admin/page.tsx` (section `parametres`, l.317-358), `tests/security/sec-40-brand-logos.spec.ts` (seconde partie)
- Test: `tests/connexion.spec.ts` (cas admin, écrit ici, complété en tâche 5)

**Interfaces:**
- Consumes: `processLogo`, `BrandImageError`, `BRAND_MAX_BYTES`, `BRAND_MIME`, `BrandKind` (tâche 2) ; `getCurrentPerson`, `canAdmin`.
- Produces: `uploadBrandLogo(form: FormData): Promise<{ ok: true } | { ok: false; error: string }>` (champs `kind` et `file`) ; `deleteBrandLogo(kind: BrandKind): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Tests de sécurité qui échouent** (seconde partie de SEC-40) : une contributrice appelle `uploadBrandLogo` et `deleteBrandLogo` en direct (`postServerAction`, `serverActionId("app/actions/brand.ts", …)`, cookie de `SECURITY_ACTORS.contributor`) ; `uploadBrandLogo` reçoit `[{}]` (pas de fichier : la garde doit répondre avant même de lire le formulaire) — attendu : refus, et la ligne `logo` posée par la première partie est intacte (même `updatedAt`) ; `deleteBrandLogo(["logo"])` — attendu : refus, ligne toujours là. Témoin : l'admin (`SECURITY_ACTORS.director` ou le rôle qui porte `admin.manage` dans les fixtures) supprime la ligne avec `deleteBrandLogo(["logo"])` — attendu : ligne partie.

- [ ] **Step 2: Commandes** `app/actions/brand.ts` :

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
import { processLogo, BrandImageError, BRAND_MAX_BYTES, BRAND_MIME, type BrandKind } from "@/lib/brand-images";

type Result = { ok: true } | { ok: false; error: string };
const KINDS: BrandKind[] = ["logo", "logo_small"];

// Téléverser un logo (spec connexion § 3) : réservé à qui administre l'outil, vérifié avant de lire le formulaire.
export async function uploadBrandLogo(form: FormData): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration de l'outil." };
  if (!(form instanceof FormData)) return { ok: false, error: "Formulaire invalide." };
  const kind = String(form.get("kind") ?? "") as BrandKind;
  if (!KINDS.includes(kind)) return { ok: false, error: "Logo inconnu." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier." };
  if (file.size > BRAND_MAX_BYTES) return { ok: false, error: "Image trop lourde : 2 Mo au plus." };
  if (!BRAND_MIME.includes(file.type)) return { ok: false, error: "Format non accepté : PNG, JPEG, WebP ou SVG." };
  try {
    const out = await processLogo(Buffer.from(await file.arrayBuffer()), kind);
    const data = { png: out.png, width: out.width, height: out.height, palette: out.palette ?? undefined };
    await prisma.brandAsset.upsert({ where: { key: kind }, create: { key: kind, ...data }, update: data });
  } catch (e) {
    if (e instanceof BrandImageError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Retirer un logo : l'outil revient à celui du fichier client (et à sa palette).
export async function deleteBrandLogo(kind: BrandKind): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration de l'outil." };
  if (!KINDS.includes(kind)) return { ok: false, error: "Logo inconnu." };
  await prisma.brandAsset.deleteMany({ where: { key: kind } });
  revalidatePath("/", "layout");
  return { ok: true };
}
```

(`getCurrentPerson` vient de `@/lib/session`, `prisma` de `@/lib/db`, comme dans `app/actions/attachments.ts`.)

- [ ] **Step 3: Écran** `app/admin/brand-logos.tsx` (composant client) : deux blocs « Grand logo » (connexion, barre latérale) et « Petit logo » (barre repliée, mobile, onglet du navigateur). Chacun : l'aperçu actuel (`<img src={withBase(url)}>`, ou « Logo du fichier client » quand rien n'est téléversé), un champ fichier `accept="image/png,image/jpeg,image/webp,image/svg+xml"` (`data-testid="brand-upload-logo"` / `"brand-upload-logo-small"`), un bouton « Retirer » quand un logo est téléversé (`data-testid="brand-delete-logo"` / `…-small`), le message d'erreur renvoyé (`role="alert"`). Pour le grand logo : les pastilles des couleurs `palette.source` (`data-testid="brand-swatch"`) et un aperçu de 240 × 120 px du panneau (classe `brand-aura` de la tâche 5 avec `brandStyle(palette)` en `style`). Sous le grand logo, l'avertissement : « Un logo prévu pour fond sombre (texte blanc) disparaît sur le fond blanc de la page de connexion : préférez la version pour fond clair. » L'envoi appelle `uploadBrandLogo` avec un `FormData` (`kind`, `file`) dès le choix du fichier, puis `router.refresh()`.

Dans `app/admin/page.tsx`, section `parametres`, ajouter une `Section` « Logos » (même composant que les autres sections de la page) qui reçoit, lus côté serveur : pour chaque clé, l'URL (`brandUrl`) ou `null`, la palette du grand logo. Afficher la section seulement si `canAdmin(me)` (sinon rien : lecture seule impossible pour un fichier).

- [ ] **Step 4: Recette** (dans `tests/connexion.spec.ts`, session de direction par défaut, qui administre) :

```ts
import { test, expect } from "@playwright/test";
import path from "node:path";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

test("un admin téléverse le grand logo : aperçu, couleurs repérées ; il le retire : retour au logo du fichier client", async ({ page }, info) => {
  const file = path.join(info.outputDir, "logo-rouge-bleu.png");
  const half = await sharp({ create: { width: 100, height: 100, channels: 4, background: "#e02020" } }).png().toBuffer();
  await writeFile(file, await sharp({ create: { width: 200, height: 100, channels: 4, background: "#2040e0" } }).composite([{ input: half, left: 0, top: 0 }]).png().toBuffer());
  await page.goto("/admin?section=parametres");
  await page.getByTestId("brand-upload-logo").setInputFiles(file);
  await expect(page.getByTestId("brand-swatch")).toHaveCount(2);
  await expect(page.getByTestId("brand-delete-logo")).toBeVisible();
  await page.getByTestId("brand-delete-logo").click();
  await expect(page.getByTestId("brand-delete-logo")).toHaveCount(0);
});
```

- [ ] **Step 5: Vérifier** `npm run check`, `tests/connexion.spec.ts`, puis `npm run test:security` (SEC-40 complet) — l'un après l'autre.

- [ ] **Step 6: Commit** — « Admin › Paramètres : grand et petit logo téléversés, couleurs repérées affichées, retour au logo du fichier client ».

---

### Task 5: La page de connexion

**Files:**
- Create: `components/auth/brand-aura.css`
- Modify: `components/auth/auth-shell.tsx`, `app/connexion/page.tsx:14`, `app/connexion/login-form.tsx`, `tests/connexion.spec.ts`

**Interfaces:**
- Consumes: `getLogos`, `getLoginPalette` (tâche 2), `brandStyle` (tâche 1), `Logo` (tâche 3), `branding()`.
- Produces: `AuthShell({ title, subtitle, children })` — même signature, composant serveur asynchrone, utilisé tel quel par `/connexion`, `/mot-de-passe-oublie`, `/reinitialiser`.

- [ ] **Step 1: CSS** `components/auth/brand-aura.css` = l'annexe B de la notice **telle quelle**, avec trois changements seulement : (1) la palette par défaut et `--aura-speed` sont posés sur `.auth-page` au lieu de `:root` (ne pas toucher aux variables du reste de l'outil) ; (2) ajouter à `.auth-page` : `--primary: var(--brand-ink); --primary-foreground: #ffffff; --ring: var(--brand-accent);` — le bouton, les liens `text-primary` et l'anneau de focus des champs prennent les couleurs du logo **sans changer le style des composants** ; (3) ajouter la grille de la page :

```css
.auth-page {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(440px, 1fr);
  min-height: 100dvh;
  background: var(--background);
}
.auth-side { display: flex; flex-direction: column; min-height: 100dvh; padding: 24px clamp(24px, 5vw, 64px); }
.auth-side__main { flex: 1; display: flex; flex-direction: column; justify-content: center; width: 100%; max-width: 380px; margin: 0 auto; }
.auth-side__foot { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--muted-foreground); max-width: 380px; width: 100%; margin: 0 auto; }
.auth-logo { height: 104px; width: auto; max-width: 260px; object-fit: contain; object-position: left; margin-bottom: 28px; }
@media (max-width: 900px) {
  .auth-page { grid-template-columns: 1fr; }
  .auth-side { min-height: auto; }
  .auth-logo { height: 84px; }
}
```

- [ ] **Step 2: Cadre** `components/auth/auth-shell.tsx` :

```tsx
import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/shell/logo";
import { branding } from "@/lib/branding";
import { getLogos, getLoginPalette } from "@/lib/branding-db";
import { brandStyle } from "@/lib/brand-palette";
import { V, pl } from "@/lib/vocab";
import "./brand-aura.css";

// Pages hors session (spec connexion du 27/09) : à gauche, un panneau lumineux aux couleurs du logo (palette calculée à
// l'envoi du logo, posée ici côté serveur, filtrée par brandStyle) ; à droite, le logo et le formulaire. Composants et polices
// du projet inchangés : seules les couleurs --primary et --ring viennent du logo, sur cette page seulement.
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  const b = branding();
  const [logos, palette] = await Promise.all([getLogos(), getLoginPalette()]);
  return (
    <div className="auth-page" style={brandStyle(palette) as CSSProperties} data-testid="auth-page">
      <aside className="brand-aura" data-testid="brand-aura">
        <span className="brand-aura__blob brand-aura__blob--1" aria-hidden="true" />
        <span className="brand-aura__blob brand-aura__blob--2" aria-hidden="true" />
        <span className="brand-aura__blob brand-aura__blob--3" aria-hidden="true" />
        <span className="brand-aura__blob brand-aura__blob--4" aria-hidden="true" />
        <div className="pitch">
          <span className="pitch__eyebrow">{b.longName}</span>
          <p className="pitch__title">{`Piloter vos ${pl(V.projet)} d'économie sociale et solidaire, de l'idée au bilan.`}</p>
        </div>
      </aside>
      <section className="auth-side">
        <main className="auth-side__main">
          <Logo img={logos.color} className="auth-logo" />
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.5px]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </main>
        <footer className="auth-side__foot"><span>© {new Date().getFullYear()} {b.longName}</span><span>Pilote</span></footer>
      </section>
    </div>
  );
}
```

Vérifier que `.brand-aura` (annexe B) garde `position: sticky`, la marge 12 px et le rayon 20 px, et en mobile le bandeau de `clamp(180px, 30vh, 260px)`.

- [ ] **Step 3: Page** `app/connexion/page.tsx:14` : `title="Se connecter"`, `subtitle="Content de vous revoir. Connectez-vous pour accéder à votre espace."`.

- [ ] **Step 4: Formulaire** `app/connexion/login-form.tsx` — garder tous les `data-testid` et la logique d'erreur ; ajouter :
  - le bouton œil dans le champ mot de passe : un `<div className="relative">` autour de l'`Input` (`className="pr-10"`), un `<button type="button" aria-controls="password" aria-pressed={shown} aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"} data-testid="login-toggle-password" className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground">` avec les icônes `Eye` / `EyeOff` de lucide-react (taille 18) ; `type={shown ? "text" : "password"}` ;
  - le lien « Mot de passe oublié ? » déplacé dans l'en-tête du champ mot de passe (label à gauche, lien à droite, `text-xs text-primary`), comme la maquette ;
  - la case « Rester connecté », cochée par défaut, avant le bouton : `<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--brand-ink)]" data-testid="login-remember" />Rester connecté</label>` ; l'appel devient `authClient.signIn.email({ email: email.trim(), password, rememberMe: remember })` ;
  - le bouton `className="h-12 w-full"` (hauteur de la maquette ; couleur par `--primary` posée par la page).

- [ ] **Step 5: Recette** `tests/connexion.spec.ts` (compléter) :

```ts
import { FRESH } from "./helpers";

test.describe("la page de connexion", () => {
  test.use({ storageState: FRESH });

  test("deux colonnes, panneau aux couleurs du logo, accroche, formulaire intact", async ({ page }) => {
    await page.goto("/connexion");
    const root = page.getByTestId("auth-page");
    await expect(page.getByTestId("brand-aura")).toBeVisible();
    const ink = await root.evaluate((el) => getComputedStyle(el).getPropertyValue("--brand-ink").trim());
    expect(ink).toMatch(/^#[0-9a-f]{6}$/i);
    await expect(page.getByTestId("brand-aura")).toContainText("de l'idée au bilan");
    await expect(page.getByRole("heading", { name: "Se connecter" })).toBeVisible();
    for (const id of ["login-form", "login-email", "login-password", "login-submit", "login-remember"]) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId("login-remember")).toBeChecked();
  });

  test("le bouton œil montre puis cache le mot de passe", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByTestId("login-password").fill("secret");
    await page.getByTestId("login-toggle-password").click();
    await expect(page.getByTestId("login-password")).toHaveAttribute("type", "text");
    await expect(page.getByTestId("login-toggle-password")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("login-toggle-password").click();
    await expect(page.getByTestId("login-password")).toHaveAttribute("type", "password");
  });

  test("mobile : une colonne, pas de défilement horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/connexion");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("réduire les animations fige le panneau", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/connexion");
    const anim = await page.locator(".brand-aura__blob--1").evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe("none");
  });
});
```

(l'accroche contient « projets » : si l'assertion `toContainText` gêne le contrôle du vocabulaire des tests, ne tester que la fin « de l'idée au bilan », comme ci-dessus.)

- [ ] **Step 6: Vérifier** `npm run check` ; `tests/connexion.spec.ts` ; les specs qui se connectent par le formulaire (`tests/comptes.spec.ts`, `tests/droits.spec.ts`, toute spec qui appelle `login(`) ; captures 1280, 1440, 1920 et 390 px, CRESS (port 3001) et TLST (port 3011, attendu : jaune en bas, vert à gauche, bouton vert foncé) dans le rapport.

- [ ] **Step 7: Commit** — « Connexion : deux colonnes, panneau lumineux aux couleurs du logo, accroche sur le pilotage des projets de l'ESS ».

---

### Task 6: Guide, décisions, recette complète

**Files:**
- Modify: `lib/lexique.ts` (entrée « Logos »), `docs/decisions.md`, `docs/LOTS-TLST.md` (Admin › Apparence : les logos sont faits)

- [ ] **Step 1: Guide** — ajouter dans `lib/lexique.ts`, au chapitre de l'administration, l'entrée « Logos » : « Le grand logo (page de connexion, barre latérale) et le petit logo (barre repliée, mobile, onglet du navigateur), téléversés en PNG, JPEG, WebP ou SVG (2 Mo au plus). Les couleurs du panneau de la page de connexion sont tirées du grand logo, automatiquement, à chaque remplacement. Retirer un logo revient à celui livré avec l'outil. », `where: "Admin › Paramètres › Logos"`.
- [ ] **Step 2: Décisions** — `docs/decisions.md` : une entrée datée qui résume la spec § 3 (base plutôt que `public/`, PNG seulement, fichier illisible refusé — écart à la notice —, palette du fichier client en repli, `sharp` en dépendance directe). `docs/LOTS-TLST.md` : dans la ligne « Écran admin › Apparence », noter que les logos (et la palette de connexion) sont faits le 27/09 ; restent couleurs du thème et polices.
- [ ] **Step 3: Recette complète** puis `npm run test:security`, l'une après l'autre, préfixe de consentement de Gaël. Attendu : tout vert.
- [ ] **Step 4: Commit** — « Guide et décisions : les logos téléversés et la page de connexion ».

---

## Self-review (faite à l'écriture)

- Spec § 1.1 → tâche 5 ; § 1.2 → tâches 1, 5 ; § 1.3 → tâche 5 ; § 1.4 → tâches 2, 3, 4 ; § 2 → tâches 1, 2, 5 ; § 3 (chaque puce) → algorithme T1, `sharp` T2, stockage T2, téléversement T4, service T3, injection T1/T5, favicon T3, affichage T3, page T5, admin T4 ; rattrapage : rien à faire en v1 (spec § 3, dernière puce) ; § 5 → tâches 3, 4, 5, 6.
- Notice § 9 : module et tests (T1), calcul à l'envoi et retour au neutre (T2, T4), illisible (T2 — refus assumé), variables filtrées (T1), palette par défaut en dur (T5), rendu desktop/mobile (T5), animations `transform` et mouvement réduit (T5), `--brand-accent` jamais du texte (contrainte globale ; T5 ne l'utilise que pour `--ring` et l'aperçu).
- Noms constants : `BrandPalette`, `BrandVars`, `BRAND_KEYS`, `brandStyle`, `BrandKind`, `processLogo`, `BrandImageError`, `getLogos`, `getLoginPalette`, `brandUrl`, `uploadBrandLogo`, `deleteBrandLogo`, `AuthShell`.
- Points à vérifier en exécutant : acteur admin des fixtures de sécurité ; `sharp` installé par `npm ci` sur le serveur (vérifier au premier déploiement : `node -e "require('sharp')"` dans le dossier de l'instance).
