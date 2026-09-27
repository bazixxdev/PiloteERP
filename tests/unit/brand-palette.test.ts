// Tests du module brand-palette.js — sans dépendance : `node --test brand-palette.test.mjs`
// (à convertir vers le runner du projet : vitest, jest…)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  paletteFromPixels, DEFAULT_PALETTE, buildVars, rgbToOklch, oklchToHex, brandStyle,
} from "../../lib/brand-palette";

/** Fabrique une image RGBA w×h ; fill(x, y) renvoie [r, g, b, a]. */
function image(w: number, h: number, fill: (x: number, y: number) => number[]): [Uint8ClampedArray, number, number] {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fill(x, y), (y * w + x) * 4);
  return [data, w, h];
}
const hex = (s: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
function contrast(a: string, b: string): number {
  const lum = (s: string) => {
    const [r, g, b2] = hex(s).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const RED = [224, 32, 32, 255];
const BLUE = [32, 64, 224, 255];
const GREEN = [32, 160, 64, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

test("logo entièrement transparent → palette par défaut", () => {
  const p = paletteFromPixels(...image(8, 8, () => CLEAR));
  assert.deepEqual(p.source, []);
  assert.equal(p.logoOnWhite, false);
  assert.deepEqual(p.vars, DEFAULT_PALETTE.vars);
});

test("fond blanc opaque détecté", () => {
  const p = paletteFromPixels(...image(10, 10, (x, y) => (x > 3 && x < 7 && y > 3 && y < 7 ? RED : WHITE)));
  assert.equal(p.logoOnWhite, true);
  assert.deepEqual(p.source, ["#e02020"]);
});

test("noir, blanc et gris ignorés", () => {
  const p = paletteFromPixels(...image(10, 10, (x) => (x < 5 ? [20, 20, 20, 255] : [128, 128, 128, 255])));
  assert.deepEqual(p.source, []);
  assert.deepEqual(p.vars, DEFAULT_PALETTE.vars);
});

test("deux couleurs, triées par surface", () => {
  const p = paletteFromPixels(...image(10, 10, (x) => (x < 6 ? RED : BLUE)));
  assert.deepEqual(p.source, ["#e02020", "#2040e0"]);
});

test("une couleur sous 6 % des pixels colorés est ignorée", () => {
  const p = paletteFromPixels(...image(20, 10, (x, y) => (x === 0 && y < 10 ? GREEN : RED))); // 5 % de vert
  assert.deepEqual(p.source, ["#e02020"]);
});

test("deux teintes proches sont fusionnées", () => {
  const p = paletteFromPixels(...image(10, 10, (x) => (x < 5 ? RED : [216, 48, 40, 255])));
  assert.equal(p.source.length, 1);
});

test("au plus 3 couleurs", () => {
  const YELLOW = [240, 200, 20, 255];
  const p = paletteFromPixels(...image(40, 10, (x) => [RED, BLUE, GREEN, YELLOW][Math.floor(x / 10)]));
  assert.equal(p.source.length, 3);
});

test("toutes les variables sont en hexadécimal", () => {
  const p = paletteFromPixels(...image(10, 10, (x) => (x < 6 ? RED : BLUE)));
  assert.deepEqual(Object.keys(p.vars), [
    "--brand-base", "--brand-glow-1", "--brand-glow-2", "--brand-glow-3", "--brand-glow-4", "--brand-ink", "--brand-accent",
  ]);
  for (const v of Object.values(p.vars)) assert.match(v, /^#[0-9a-f]{6}$/);
});

test("--brand-ink lisible sur blanc (contraste ≥ 7:1) pour toutes les teintes", () => {
  for (let H = 0; H < 360; H += 15) {
    for (const [L, C] of [[0.3, 0.1], [0.5, 0.15], [0.7, 0.15], [0.9, 0.08]]) {
      const ink = buildVars([{ L, C, H }])["--brand-ink"];
      assert.ok(contrast(ink, "#ffffff") >= 7, `${ink} (H ${H}, L ${L})`);
    }
  }
});

test("aller-retour sRGB → OKLCH → hex sans perte", () => {
  for (const s of ["#fdb42b", "#014214", "#2846c8", "#e62878", "#777777"]) {
    const o = rgbToOklch(...hex(s));
    assert.equal(oklchToHex(o.L, o.C, o.H), s);
  }
});

test("vecteur de référence : logo Tiers-Lieu Nourricier (jaune + vert)", () => {
  // Deux aplats aux couleurs exactes du logo, 70 % jaune / 30 % vert, fond transparent
  const p = paletteFromPixels(...image(20, 10, (x, y) =>
    (y === 0 || y === 9) ? CLEAR : (x < 14 ? [255, 180, 43, 255] : [0, 66, 20, 255])));
  assert.deepEqual(p, {
    version: 1,
    source: ["#ffb42b", "#004214"],
    logoOnWhite: false,
    vars: {
      "--brand-base":   "#fef2e1",
      "--brand-glow-1": "#f9ad0d",
      "--brand-glow-2": "#60a56a",
      "--brand-glow-3": "#c1e2c4",
      "--brand-glow-4": "#fdd3c4",
      "--brand-ink":    "#004214",
      "--brand-accent": "#f1a70d",
    },
  });
});

test("brandStyle ne garde que les clés connues et les couleurs #rrggbb", () => {
  const style = brandStyle({
    version: 1, source: [], logoOnWhite: false,
    vars: { "--brand-base": "#fef2e1", "--brand-glow-1": "red; background:url(x)", "--brand-glow-2": "#60a56a", "--brand-glow-3": "#C1E2C4", "--brand-glow-4": "#fdd3c4", "--brand-ink": "#004214", "--brand-accent": "#f1a70d", "--evil": "#000000" } as never,
  });
  assert.deepEqual(style, { "--brand-base": "#fef2e1", "--brand-glow-2": "#60a56a", "--brand-glow-3": "#C1E2C4", "--brand-glow-4": "#fdd3c4", "--brand-ink": "#004214", "--brand-accent": "#f1a70d" });
  assert.deepEqual(brandStyle(null), {});
});
