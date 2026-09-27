// Palette du panneau de connexion tirée du logo (spec connexion du 27/09). Repris sans changement de `brand-palette.js` v1
// de la maquette : toute modification de l'algorithme ou de PALETTE_OPTIONS incrémente PALETTE_VERSION et relance les tests.
//
// Calcule, à partir des pixels d'un logo, une palette claire et lumineuse (variables CSS en hexadécimal) pour le panneau
// animé de la page de connexion.
//
// - Aucune dépendance.
// - Le cœur (paletteFromPixels) est pur : il marche dans le navigateur et côté serveur (Node).
// - Les aides navigateur de la maquette (paletteFromImage, applyPalette) ne sont pas reprises ici : le calcul se fait côté
//   serveur (spec § 3).

export const PALETTE_VERSION = 1;

export const PALETTE_OPTIONS = {
  sampleSize: 160,    // côté max de l'échantillon analysé (px)
  minAlpha: 200,      // pixels plus transparents : ignorés (fond du PNG, bords)
  minChroma: 0.04,    // en dessous : blanc, noir, gris → ignorés
  hueStep: 15,        // largeur des tranches de teinte (degrés)
  mergeDistance: 25,  // deux teintes plus proches que ça = une seule couleur
  minShare: 0.06,     // une teinte doit couvrir au moins 6 % des pixels colorés
  maxColors: 3,
};

export type BrandVars = Record<
  "--brand-base" | "--brand-glow-1" | "--brand-glow-2" | "--brand-glow-3" | "--brand-glow-4" | "--brand-ink" | "--brand-accent",
  string
>;

export type BrandPalette = {
  version: number;
  source: string[];
  logoOnWhite: boolean;
  vars: BrandVars;
};

type Oklch = { L: number; C: number; H: number };
type ExtractedColor = Oklch & { hex: string; share: number };

/* ---------- Conversions sRGB <-> OKLCH ---------- */

const toLinear = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

export function rgbToOklch(r: number, g: number, b: number): Oklch {
  r = toLinear(r); g = toLinear(g); b = toLinear(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { L, C: Math.hypot(A, B), H: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}

function oklchToLinearRgb(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos(H * Math.PI / 180);
  const b = C * Math.sin(H * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

/** OKLCH -> "#rrggbb". Hors gamut sRGB : on baisse la chroma jusqu'à rentrer (teinte conservée). */
export function oklchToHex(L: number, C: number, H: number): string {
  let c = C;
  let rgb = oklchToLinearRgb(L, c, H);
  while (c > 0 && rgb.some((v) => v < -1e-4 || v > 1 + 1e-4)) {
    c = Math.max(0, c - 0.004);
    rgb = oklchToLinearRgb(L, c, H);
  }
  return "#" + rgb
    .map((v) => Math.round(clamp(toGamma(clamp(v, 0, 1)), 0, 1) * 255).toString(16).padStart(2, "0"))
    .join("");
}

/* ---------- 1. Repérer les couleurs du logo ---------- */

/**
 * @param data   RGBA à plat (Uint8ClampedArray, Buffer, tableau…), 4 octets par pixel
 * @returns { colors: [{hex, L, C, H, share}], onWhite: boolean }
 *   colors  : 0 à 3 teintes, de la plus présente à la moins présente
 *   onWhite : true si le logo a un fond blanc opaque (JPG, PNG non détouré)
 */
export function extractColors(
  data: ArrayLike<number>,
  width: number,
  height: number,
  options: Partial<typeof PALETTE_OPTIONS> = {},
): { colors: ExtractedColor[]; onWhite: boolean } {
  const o = { ...PALETTE_OPTIONS, ...options };
  const px = (x: number, y: number) => (y * width + x) * 4;

  const isWhite = (i: number) => data[i + 3] > 250 && data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240;
  const onWhite = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)].every(isWhite);

  const step = Math.max(1, Math.floor(Math.max(width, height) / o.sampleSize));
  const bins = new Map<number, { n: number; L: number; C: number; x: number; y: number; r: number; g: number; b: number }>();
  let total = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = px(x, y);
      if (data[i + 3] < o.minAlpha) continue;
      const c = rgbToOklch(data[i], data[i + 1], data[i + 2]);
      if (c.C < o.minChroma) continue;
      const key = Math.round(c.H / o.hueStep) % Math.round(360 / o.hueStep);
      let bin = bins.get(key);
      if (!bin) bins.set(key, bin = { n: 0, L: 0, C: 0, x: 0, y: 0, r: 0, g: 0, b: 0 });
      bin.n++; bin.L += c.L; bin.C += c.C;
      bin.x += Math.cos(c.H * Math.PI / 180);   // moyenne de teinte sur le cercle
      bin.y += Math.sin(c.H * Math.PI / 180);
      bin.r += data[i]; bin.g += data[i + 1]; bin.b += data[i + 2];
      total++;
    }
  }

  const picked: (Oklch & { n: number; hex: string })[] = [];
  [...bins.values()].sort((a, b) => b.n - a.n).forEach((bin) => {
    const c = {
      n: bin.n,
      L: bin.L / bin.n,
      C: bin.C / bin.n,
      H: (Math.atan2(bin.y, bin.x) * 180 / Math.PI + 360) % 360,
      hex: "#" + [bin.r, bin.g, bin.b].map((v) => Math.round(v / bin.n).toString(16).padStart(2, "0")).join(""),
    };
    const near = picked.find((p) => hueDist(p.H, c.H) < o.mergeDistance);
    if (near) { near.n += c.n; return; }
    if (picked.length < o.maxColors && c.n >= total * o.minShare) picked.push(c);
  });

  const colors = picked.map(({ n, ...c }) => ({ ...c, share: +(n / total).toFixed(3) }));
  return { colors, onWhite };
}

/* ---------- 2. En faire une palette claire pour le panneau ---------- */

export function buildVars(colors: Oklch[]): BrandVars {
  if (!colors.length) colors = [{ L: 0.5, C: 0.02, H: 250 }];              // logo noir et blanc / pas de logo

  const glow   = [...colors].sort((a, b) => b.C - a.C)[0];                  // la plus vive = la lumière
  const second = colors.find((c) => c !== glow) || { ...glow, H: (glow.H + 35) % 360 };
  const third  = colors.find((c) => c !== glow && c !== second) || { ...glow, H: (glow.H + 325) % 360 };

  const vivid = (c: Oklch) => oklchToHex(clamp(c.L, c.C < 0.05 ? 0.80 : 0.66, 0.80), Math.min(c.C * 1.15, 0.17), c.H);
  const soft  = (c: Oklch, L: number) => oklchToHex(L, Math.min(c.C * 0.55, 0.08), c.H);

  const dark = colors.filter((c) => c.L < 0.45).sort((a, b) => a.L - b.L)[0];
  const ink  = dark ? oklchToHex(Math.min(dark.L, 0.36), dark.C, dark.H)
                    : oklchToHex(0.28, Math.min(glow.C, 0.07), glow.H);

  return {
    "--brand-base":   oklchToHex(0.965, Math.min(glow.C * 0.2, 0.03), glow.H), // fond du panneau
    "--brand-glow-1": vivid(glow),        // lumière principale
    "--brand-glow-2": vivid(second),      // tache secondaire
    "--brand-glow-3": soft(second, 0.88), // halo pâle
    "--brand-glow-4": soft(third, 0.90),  // halo pâle
    "--brand-ink":    ink,                // texte du panneau, bouton, liens (contraste garanti sur blanc)
    "--brand-accent": oklchToHex(clamp(glow.L, 0.60, 0.78), Math.min(glow.C, 0.18), glow.H), // focus, détails (jamais du texte)
  };
}

/* ---------- 3. Tout-en-un ---------- */

/** @returns { version, source: ['#hex', …], logoOnWhite, vars: { '--brand-…': '#hex' } } */
export function paletteFromPixels(
  data: ArrayLike<number>,
  width: number,
  height: number,
  options?: Partial<typeof PALETTE_OPTIONS>,
): BrandPalette {
  const { colors, onWhite } = extractColors(data, width, height, options);
  return {
    version: PALETTE_VERSION,
    source: colors.map((c) => c.hex),
    logoOnWhite: onWhite,
    vars: buildVars(colors),
  };
}

/** Palette utilisée sans logo (et pour un logo noir et blanc). */
export const DEFAULT_PALETTE: BrandPalette = {
  version: PALETTE_VERSION,
  source: [],
  logoOnWhite: false,
  vars: buildVars([]),
};

export const BRAND_KEYS = ["--brand-base", "--brand-glow-1", "--brand-glow-2", "--brand-glow-3", "--brand-glow-4", "--brand-ink", "--brand-accent"] as const;

// Variables à poser dans l'attribut style de la page : seules les 7 clés connues, seulement des #rrggbb — une donnée modifiée
// en base ne peut pas injecter de CSS (notice § 5.4).
export function brandStyle(palette: BrandPalette | null | undefined): Record<string, string> {
  const vars = (palette?.vars ?? {}) as Record<string, string>;
  return Object.fromEntries(BRAND_KEYS.filter((k) => /^#[0-9a-f]{6}$/i.test(vars[k] ?? "")).map((k) => [k, vars[k]]));
}
